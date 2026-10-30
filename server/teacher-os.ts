// TEACHER OS — API privada del profesor: /api/teacher/*.
// Autorización en el servidor: toda ruta (salvo login) exige una sesión de profesor válida (cookie HttpOnly `dt_t`, emitida
// tras verificar una clave provisionada en privado con `npm run teacher`). Una sesión de alumno NUNCA vale aquí.
// FAIL-CLOSED: sin profesores registrados no hay forma de entrar (503), sea cual sea TEACHER_AUTH.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Question } from '../shared/types.ts';
import { TOPICS } from '../shared/rules.ts';
import type { AccountStore, Account } from './accounts.ts';
import type { ProgressEvent, ProgressLog } from './progress.ts';
import { isoWeek, madridDay } from './progress.ts';
import type { Guard } from './security.ts';
import { TeacherDirectory } from './teacher-auth.ts';
import { TeacherData, LEVELS_OK, type PlannedSession, type StudentLevel } from './teacher-data.ts';
import { TEACHER_COOKIE, clearCookie, readCookie, sameOriginJson, setCookie } from './cookies.ts';
import { BOXING_BANK } from './boxing-bank.ts';

class ApiError extends Error { status: number; constructor(status: number, m: string) { super(m); this.status = status; } }
const fail = (status: number, m: string): never => { throw new ApiError(status, m); };
const DAY = 86_400_000;
/** Por debajo de este número de respuestas no se muestran conclusiones: «Datos insuficientes». */
export const MIN_N = 20;
const DIFFS = ['easy', 'medium', 'hard', 'special'] as const;
const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', weekday: 'short', hour: '2-digit', hourCycle: 'h23' });
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
function madridWhen(at: number) { const p = parts.formatToParts(new Date(at)); return { wd: WEEKDAYS.indexOf(p.find((x) => x.type === 'weekday')!.value), h: Number(p.find((x) => x.type === 'hour')!.value) }; }

interface Live { code: string; owner?: string; phase: string; players: number; connected: number; review: number; block: string | null; private: boolean }
export interface TeacherOsDeps {
  accounts: AccountStore; guard: Guard; log: () => ProgressLog; bank: Map<string, Question>; data: TeacherData;
  liveRooms: () => Live[]; publicDir: string; now?: () => number;
}

/** Agregado descriptivo: n y precisión (null si n = 0). Nunca una predicción. */
type Agg = { key: string; n: number; correct: number; accuracy: number | null };
function agg(rows: Map<string, { n: number; correct: number }>, keys?: readonly string[]): Agg[] {
  const ks = keys ?? [...rows.keys()];
  return ks.map((key) => { const r = rows.get(key) ?? { n: 0, correct: 0 }; return { key, n: r.n, correct: r.correct, accuracy: r.n ? Math.round((r.correct / r.n) * 1000) / 1000 : null }; });
}
const bump = (m: Map<string, { n: number; correct: number }>, k: string, ok: boolean) => { const r = m.get(k) ?? { n: 0, correct: 0 }; r.n++; if (ok) r.correct++; m.set(k, r); };

export function createTeacherOs(d: TeacherOsDeps) {
  const now = d.now ?? Date.now;
  const teachers: TeacherDirectory = d.guard.teachers;
  const json = (res: ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' });
    res.end(JSON.stringify(body));
  };
  async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
    const chunks: Buffer[] = []; let n = 0;
    for await (const c of req) { n += (c as Buffer).length; if (n > 16_384) fail(413, 'La petición es demasiado grande.'); chunks.push(Buffer.from(c)); }
    try { const v = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); if (!v || typeof v !== 'object' || Array.isArray(v)) fail(400, 'Se esperaba un objeto JSON.'); return v; } catch (e) { if (e instanceof ApiError) throw e; return fail(400, 'JSON no válido.'); }
  }
  const qtopic = (qid: string) => d.bank.get(qid)?.topic ?? BOXING_BANK.find((q) => q.id === qid)?.topic.toLowerCase();
  const qdiff = (qid: string) => d.bank.get(qid)?.diff ?? (qid.startsWith('bx-') ? 'medium' : undefined);
  const qprompt = (qid: string) => (d.bank.get(qid)?.prompt ?? BOXING_BANK.find((q) => q.id === qid)?.prompt ?? qid).slice(0, 160);
  const studentEvents = () => { const by = new Map<string, ProgressEvent[]>(); for (const e of d.log().events) if (e.profile.startsWith('acc_')) { const l = by.get(e.profile) ?? []; l.push(e); by.set(e.profile, l); } return by; };
  const student = (sid: string): Account => d.accounts.byId(sid) ?? fail(404, 'Alumno desconocido.');

  function rowOf(a: Account, evs: ProgressEvent[]) {
    const t = now();
    const answers = evs.filter((e) => e.kind === 'answer');
    const last = evs.reduce((m, e) => Math.max(m, e.at), 0);
    const recent = answers.filter((e) => e.at > t - 30 * DAY);
    const meta = d.data.peek(a.id);
    return {
      id: a.id, alias: a.alias, level: meta?.level ?? null, groups: meta?.groups ?? [], disabled: !!a.disabled, createdAt: a.createdAt, createdByTeacher: a.createdBy === 'teacher',
      lastActive: last || null, answers7: answers.filter((e) => e.at > t - 7 * DAY).length, answers30: recent.length,
      accuracy30: recent.length ? Math.round((recent.filter((e) => e.ok).length / recent.length) * 100) / 100 : null,
      activities: evs.filter((e) => e.kind === 'game' && e.game).length, streak: d.log().streak(a.id),
    };
  }

  function overview() {
    const t = now(); const by = studentEvents(); const all = d.accounts.all();
    const active = all.filter((a) => (by.get(a.id) ?? []).some((e) => e.at > t - 7 * DAY));
    const weeks = d.log().weeks(8);
    const wk = new Map(weeks.map((w) => [w, { n: 0, correct: 0, students: new Set<string>() }]));
    const topic = new Map<string, { n: number; correct: number; students: Set<string> }>();
    let acts7 = 0, actsAll = 0;
    for (const [sid, evs] of by) for (const e of evs) {
      if (e.kind === 'game' && e.game) { actsAll++; if (e.at > t - 7 * DAY) acts7++; }
      if (e.kind !== 'answer' || typeof e.ok !== 'boolean') continue;
      const w = wk.get(isoWeek(e.at)); if (w) { w.n++; if (e.ok) w.correct++; w.students.add(sid); }
      if (e.at > t - 30 * DAY && e.topic) { const x = topic.get(e.topic) ?? { n: 0, correct: 0, students: new Set() }; x.n++; if (e.ok) x.correct++; x.students.add(sid); topic.set(e.topic, x); }
    }
    const weakTopics = [...topic].filter(([, x]) => x.n >= MIN_N).map(([k, x]) => ({ topic: k, name: (TOPICS as Record<string, { de: string }>)[k]?.de ?? k, n: x.n, accuracy: Math.round((x.correct / x.n) * 100) / 100, students: x.students.size }))
      .sort((a, b) => a.accuracy - b.accuracy).slice(0, 5);
    const sessionsDone = d.data.data.sessions.filter((s) => s.status === 'done');
    const rooms30 = new Set<string>(); for (const evs of by.values()) for (const e of evs) if (e.room && !e.room.startsWith('P') && e.at > t - 30 * DAY) rooms30.add(e.room);
    // Qué necesita atención: hechos observables, nunca etiquetas sobre la persona.
    const attention: { id: string; alias: string; reason: string }[] = [];
    for (const a of all) {
      if (a.disabled) continue;
      const evs = by.get(a.id) ?? []; const last = evs.reduce((m, e) => Math.max(m, e.at), 0);
      if (last && last < t - 14 * DAY) attention.push({ id: a.id, alias: a.alias, reason: `Sin actividad desde hace ${Math.floor((t - last) / DAY)} días` });
      const recent = evs.filter((e) => e.kind === 'answer' && e.at > t - 14 * DAY);
      if (recent.length >= MIN_N && recent.filter((e) => e.ok).length / recent.length < 0.5) attention.push({ id: a.id, alias: a.alias, reason: `Precisión por debajo del 50 % en sus últimas ${recent.length} respuestas: quizá convenga repasar` });
      if (!last && a.createdBy === 'teacher' && a.createdAt < t - 7 * DAY) attention.push({ id: a.id, alias: a.alias, reason: 'Cuenta creada hace más de una semana y aún sin usar' });
    }
    const live = d.liveRooms();
    return {
      academy: d.data.data.academy.name,
      students: { total: all.filter((a) => !a.disabled).length, active7: active.length, disabled: all.filter((a) => a.disabled).length },
      sessions: { planned: d.data.data.sessions.filter((s) => s.status === 'planned').length, done: sessionsDone.length, classRooms30: rooms30.size },
      activities: { week: acts7, total: actsAll },
      upcoming: d.data.data.sessions.filter((s) => s.status !== 'done' && s.date >= madridDay(t)).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5),
      trend: weeks.map((w) => { const x = wk.get(w)!; return { week: w, n: x.n, students: x.students.size, accuracy: x.n ? Math.round((x.correct / x.n) * 100) / 100 : null }; }),
      weakTopics, attention: attention.slice(0, 12),
      review: live.filter((r) => r.review > 0).map((r) => ({ code: r.code, pending: r.review, mine: true })),
      live: live.filter((r) => !r.private),
      minN: MIN_N,
    };
  }

  function detail(a: Account) {
    const evs = d.log().events.filter((e) => e.profile === a.id).sort((x, y) => x.at - y.at);
    const answers = evs.filter((e) => e.kind === 'answer' && typeof e.ok === 'boolean');
    const weeks = d.log().weeks(12);
    const wk = new Map(weeks.map((w) => [w, { n: 0, correct: 0, points: 0, acts: 0 }]));
    for (const e of evs) { const w = wk.get(isoWeek(e.at)); if (!w) continue; w.points += e.points; if (e.kind === 'answer') { w.n++; if (e.ok) w.correct++; } if (e.kind === 'game' && e.game) w.acts++; }
    // Gramática: por tema Y por dificultad (no es lo mismo 5 fáciles que 100 de nivel A2).
    const grammar = new Map<string, { n: number; correct: number; byDiff: Map<string, { n: number; correct: number }> }>();
    const errors = new Map<string, { qid: string; wrong: number; n: number }>();
    for (const e of answers) {
      const tp = e.topic ?? qtopic(e.qid ?? '') ?? 'otros';
      const g = grammar.get(tp) ?? { n: 0, correct: 0, byDiff: new Map() }; g.n++; if (e.ok) g.correct++;
      bump(g.byDiff, qdiff(e.qid ?? '') ?? 'desconocida', !!e.ok); grammar.set(tp, g);
      if (e.qid) { const x = errors.get(e.qid) ?? { qid: e.qid, wrong: 0, n: 0 }; x.n++; if (!e.ok) x.wrong++; errors.set(e.qid, x); }
    }
    const meta = d.data.peek(a.id);
    const t = now();
    const days = new Set(evs.filter((e) => e.at > t - 28 * DAY).map((e) => madridDay(e.at)));
    return {
      student: rowOf(a, evs),
      overview: {
        answers: answers.length, correct: answers.filter((e) => e.ok).length, activities: evs.filter((e) => e.kind === 'game' && e.game).length,
        activeDays28: days.size, firstSeen: evs[0]?.at ?? null, recommended: d.log().recommended(a.id),
      },
      progress: weeks.map((w) => { const x = wk.get(w)!; return { week: w, n: x.n, accuracy: x.n ? Math.round((x.correct / x.n) * 100) / 100 : null, points: x.points, activities: x.acts }; }),
      grammar: [...grammar].map(([topic, g]) => ({ topic, name: (TOPICS as Record<string, { de: string }>)[topic]?.de ?? topic, n: g.n, accuracy: Math.round((g.correct / g.n) * 100) / 100, byDiff: agg(g.byDiff, [...DIFFS, ...(g.byDiff.has('desconocida') ? ['desconocida'] : [])]) })).sort((x, y) => y.n - x.n),
      errors: [...errors.values()].filter((x) => x.wrong >= 2).sort((x, y) => y.wrong - x.wrong).slice(0, 10).map((x) => ({ ...x, prompt: qprompt(x.qid), topic: qtopic(x.qid) ?? '' })),
      activities: evs.filter((e) => e.kind === 'game' && e.game).slice(-50).reverse().map((e) => ({ at: e.at, game: e.game, level: e.level ?? null, total: e.total ?? 0, correct: e.correct ?? 0, points: e.points, room: e.room ?? null })),
      notes: meta?.notes ?? [], attendance: meta?.attendance ?? [], reviews: meta?.reviews ?? [],
      minN: MIN_N,
    };
  }

  /** Estadística DESCRIPTIVA con filtros. Cada grupo lleva su n; con menos de MIN_N el cliente muestra «Datos insuficientes». */
  function analytics(q: URLSearchParams) {
    const days = Math.max(1, Math.min(365, Number(q.get('days')) || 30));
    const sid = q.get('student'), tp = q.get('topic'), df = q.get('diff');
    const since = now() - days * DAY;
    const wd = new Map<string, { n: number; correct: number }>(), hr = new Map<string, { n: number; correct: number }>(), top = new Map<string, { n: number; correct: number }>(), dif = new Map<string, { n: number; correct: number }>(), src = new Map<string, { n: number; correct: number }>();
    let n = 0, correct = 0; const students = new Set<string>();
    for (const e of d.log().events) {
      if (e.kind !== 'answer' || typeof e.ok !== 'boolean' || e.at < since || !e.profile.startsWith('acc_')) continue;
      if (sid && e.profile !== sid) continue;
      const topic = e.topic ?? qtopic(e.qid ?? '') ?? 'otros';
      const diff = qdiff(e.qid ?? '') ?? 'desconocida';
      if (tp && topic !== tp) continue;
      if (df && diff !== df) continue;
      n++; if (e.ok) correct++; students.add(e.profile);
      const w = madridWhen(e.at);
      bump(wd, WEEKDAYS[w.wd], e.ok); bump(hr, w.h < 12 ? 'mañana (0–12)' : w.h < 16 ? 'mediodía (12–16)' : w.h < 20 ? 'tarde (16–20)' : 'noche (20–24)', e.ok);
      bump(top, topic, e.ok); bump(dif, diff, e.ok); bump(src, e.source, e.ok);
    }
    return {
      filters: { days, student: sid, topic: tp, diff: df }, n, students: students.size, accuracy: n ? Math.round((correct / n) * 1000) / 1000 : null, minN: MIN_N, sufficient: n >= MIN_N,
      byWeekday: agg(wd, WEEKDAYS), byHour: agg(hr, ['mañana (0–12)', 'mediodía (12–16)', 'tarde (16–20)', 'noche (20–24)']),
      byTopic: agg(top).sort((a, b) => b.n - a.n), byDiff: agg(dif, [...DIFFS]), bySource: agg(src).sort((a, b) => b.n - a.n),
      note: 'Estadística descriptiva: describe lo ocurrido en estas respuestas; no predice ni explica por qué. Compara solo grupos con suficientes observaciones.',
    };
  }

  function sessionResults(s: PlannedSession) {
    if (!s.room) return { students: [] };
    const per = new Map<string, { n: number; correct: number }>();
    for (const e of d.log().events) if (e.room === s.room && e.kind === 'answer' && typeof e.ok === 'boolean' && e.profile.startsWith('acc_')) bump(per, e.profile, e.ok);
    return { students: agg(per).map((r) => ({ ...r, alias: d.accounts.byId(r.key)?.alias ?? '—' })) };
  }

  function library() {
    let pres: { id: string; title: string; description?: string; file: string; pdf?: string; topics: string[]; level?: string; unit?: number }[] = [];
    try { pres = JSON.parse(readFileSync(join(d.publicDir, 'presentaciones', 'catalogo.json'), 'utf8')); } catch { /* catálogo ausente */ }
    const levelsOf = (l?: string) => (!l ? ['A1', 'A2'] : l.includes('B1') ? ['B1'] : l.includes('A1') && l.includes('A2') ? ['A1', 'A2'] : [l]);
    const items = [
      ...pres.map((p) => ({ id: `pres:${p.id}`, type: 'presentacion', title: p.title, description: p.description ?? '', topics: p.topics, levels: levelsOf(p.level), unit: p.unit ?? null, open: p.file, pdf: p.pdf ?? null, launch: null })),
      { id: 'game:blackcard', type: 'juego', title: 'BlackCard', description: 'Quiz por rondas con cofres, objetos y la BlackCard. Por temas.', topics: [], levels: ['A1', 'A2', 'B1'], unit: null, open: null, pdf: null, launch: 'blackcard' },
      { id: 'game:jenga', type: 'juego', title: 'Wort-Jenga', description: 'La torre de preguntas por turnos.', topics: [], levels: ['A1', 'A2', 'B1'], unit: null, open: null, pdf: null, launch: 'jenga' },
      { id: 'game:boxing', type: 'juego', title: 'Boxeo', description: 'Duelo de casos (Akkusativ, Dativ, preposiciones) para dos alumnos.', topics: ['Akkusativ', 'Dativ'], levels: ['A2'], unit: null, open: '/boxeo', pdf: null, launch: 'boxing' },
      { id: 'exam:road-b1-1', type: 'examen', title: 'Road to B1 · Die erste Prüfung', description: 'Sesión guiada de 105 min: lectura, dictado y audios. No es un examen oficial.', topics: ['Leseverstehen', 'Hören', 'Diktat'], levels: ['B1'], unit: null, open: '/road-to-b1', pdf: null, launch: 'road' },
      { id: 'act:taller', type: 'actividad', title: 'Taller de escritura y escenas', description: 'Reescritura, historias con palabras dadas, escritura libre y ensayo de escenas.', topics: ['Schreiben'], levels: ['A1', 'A2'], unit: 1, open: '/tema/1/taller', pdf: null, launch: null },
      ...Object.entries(TOPICS).map(([k, v]) => ({ id: `rep:${k}`, type: 'repaso', title: `Repaso: ${v.de}`, description: v.es, topics: [k], levels: ['A1', 'A2', 'B1'], unit: null, open: `/practica?temas=${k}`, pdf: null, launch: 'blackcard' })),
    ];
    return { items, units: [...new Set(pres.map((p) => p.unit).filter((u) => u !== undefined))] };
  }

  async function dispatch(req: IncomingMessage, res: ServerResponse, url: URL) {
    const path = url.pathname.slice('/api/teacher/'.length).split('/').filter(Boolean);
    const method = req.method ?? 'GET';
    if (method === 'POST' && !sameOriginJson(req)) fail(403, 'Petición no permitida.');
    if (path[0] === 'login' && method === 'POST') {
      if (teachers.activeCount === 0) fail(503, 'No hay profesores registrados en este servidor. Se crean en privado con «npm run teacher -- add».');
      const input = await body(req);
      if (typeof input.key !== 'string' || !input.key.trim()) fail(400, 'Escribe tu clave de profesor.'); // no cuenta como intento fallido
      const t = d.guard.teacherFor((input.key as string).trim(), d.guard.ip(req));
      if (!t.ok) return fail(401, t.error);
      setCookie(res, req, TEACHER_COOKIE, teachers.startSession(t.id), TeacherDirectory.SESSION_SECONDS);
      return json(res, 200, { name: teachers.nameOf(t.id) });
    }
    if (path[0] === 'logout' && method === 'POST') { const tok = readCookie(req, TEACHER_COOKIE); if (tok) teachers.endSession(tok); clearCookie(res, req, TEACHER_COOKIE); return json(res, 200, { ok: true }); }
    // ── a partir de aquí, SOLO profesor (comprobado en el servidor, en cada petición)
    const me = d.guard.teacherFromRequest(req);
    if (!me) return fail(401, 'Acceso solo para profesores.');
    const r0 = path[0], r1 = path[1], r2 = path[2];
    if (r0 === 'me' && method === 'GET') return json(res, 200, { name: teachers.nameOf(me), academy: d.data.data.academy, teachers: teachers.list().filter((x) => !x.revokedAt).map((x) => ({ name: x.name })), mode: d.guard.mode });
    if (r0 === 'overview' && method === 'GET') return json(res, 200, overview());
    if (r0 === 'analytics' && method === 'GET') return json(res, 200, analytics(url.searchParams));
    if (r0 === 'library' && method === 'GET') return json(res, 200, library());
    if (r0 === 'settings' && method === 'POST') {
      const input = await body(req);
      if (typeof input.academy !== 'string' || !input.academy.trim() || input.academy.length > 60) fail(400, 'Nombre de academia no válido (1–60 caracteres).');
      d.data.data.academy.name = (input.academy as string).trim(); d.data.save();
      return json(res, 200, { academy: d.data.data.academy });
    }
    if (r0 === 'groups') {
      if (!r1 && method === 'GET') return json(res, 200, { groups: d.data.data.groups });
      if (!r1 && method === 'POST') { const input = await body(req); const name = typeof input.name === 'string' ? input.name.trim().slice(0, 40) : ''; if (!name) fail(400, 'Escribe un nombre para el grupo.'); return json(res, 200, d.data.addGroup(name)); }
      if (r1 && r2 === 'delete' && method === 'POST') { d.data.removeGroup(r1); return json(res, 200, { ok: true }); }
    }
    if (r0 === 'students') {
      if (!r1 && method === 'GET') {
        const by = studentEvents();
        return json(res, 200, { students: d.accounts.all().map((a) => rowOf(a, by.get(a.id) ?? [])).sort((x, y) => (y.lastActive ?? 0) - (x.lastActive ?? 0)), groups: d.data.data.groups });
      }
      if (!r1 && method === 'POST') {
        const input = await body(req);
        const r = await d.accounts.createByTeacher(input.alias);
        if (!r.ok) return fail(r.status, r.error);
        if (typeof input.level === 'string' && (LEVELS_OK as readonly string[]).includes(input.level)) { d.data.meta(r.account.id).level = input.level as StudentLevel; d.data.save(); }
        return json(res, 200, { id: r.account.id, alias: r.account.alias, password: r.password });
      }
      const a = student(r1);
      if (!r2 && method === 'GET') return json(res, 200, detail(a));
      if (!r2 && method === 'POST') {
        const input = await body(req); const m = d.data.meta(a.id);
        if (input.level !== undefined) { if (input.level !== null && !(LEVELS_OK as readonly unknown[]).includes(input.level)) fail(400, 'Nivel no válido.'); m.level = (input.level ?? undefined) as StudentLevel | undefined; }
        if (input.groups !== undefined) { if (!Array.isArray(input.groups)) fail(400, 'Grupos no válidos.'); m.groups = (input.groups as unknown[]).filter((g): g is string => typeof g === 'string' && d.data.data.groups.some((x) => x.id === g)); }
        if (input.disabled !== undefined) { if (typeof input.disabled !== 'boolean') fail(400, 'Valor no válido.'); d.accounts.setDisabled(a, input.disabled as boolean); }
        d.data.save();
        return json(res, 200, detail(a).student);
      }
      if (r2 === 'notes' && method === 'POST') {
        const input = await body(req);
        if (input.delete) { d.data.removeNote(a.id, String(input.delete)); return json(res, 200, { notes: d.data.meta(a.id).notes }); }
        const text = typeof input.text === 'string' ? input.text.trim() : ''; if (!text || text.length > 2000) fail(400, 'La nota debe tener entre 1 y 2000 caracteres.');
        d.data.addNote(a.id, teachers.nameOf(me), text); return json(res, 200, { notes: d.data.meta(a.id).notes });
      }
      if (r2 === 'attendance' && method === 'POST') {
        const input = await body(req);
        if (typeof input.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) fail(400, 'Fecha no válida (AAAA-MM-DD).');
        if (!['present', 'absent', 'late'].includes(input.status as string)) fail(400, 'Estado no válido.');
        d.data.setAttendance(a.id, { date: input.date as string, status: input.status as 'present', ...(typeof input.sessionId === 'string' ? { sessionId: input.sessionId } : {}), by: teachers.nameOf(me) });
        return json(res, 200, { attendance: d.data.meta(a.id).attendance });
      }
      if (r2 === 'review' && method === 'POST') {
        const input = await body(req);
        if (input.delete) { d.data.removeReview(a.id, String(input.delete)); return json(res, 200, { reviews: d.data.meta(a.id).reviews }); }
        const topics = Array.isArray(input.topics) ? [...new Set((input.topics as unknown[]).filter((t): t is string => typeof t === 'string' && Object.hasOwn(TOPICS, t)))] : [];
        if (!topics.length) fail(400, 'Elige al menos un tema.');
        d.data.addReview(a.id, teachers.nameOf(me), topics, typeof input.note === 'string' ? input.note.slice(0, 200) : undefined);
        return json(res, 200, { reviews: d.data.meta(a.id).reviews });
      }
      if (r2 === 'reset-password' && method === 'POST') return json(res, 200, { password: await d.accounts.resetByTeacher(a) });
    }
    if (r0 === 'sessions') {
      if (!r1 && method === 'GET') return json(res, 200, { sessions: d.data.data.sessions, groups: d.data.data.groups, live: d.liveRooms().filter((r) => !r.private) });
      if (!r1 && method === 'POST') {
        const input = await body(req);
        const title = typeof input.title === 'string' ? input.title.trim().slice(0, 80) : ''; if (!title) fail(400, 'Ponle un título a la clase.');
        if (typeof input.date !== 'string' || !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(input.date)) fail(400, 'Fecha no válida.');
        const game = ['blackcard', 'jenga', 'boxing', 'road', 'none'].includes(input.game as string) ? input.game as PlannedSession['game'] : 'blackcard';
        const topics = Array.isArray(input.topics) ? (input.topics as unknown[]).filter((t): t is string => typeof t === 'string' && Object.hasOwn(TOPICS, t)) : [];
        const groupId = typeof input.groupId === 'string' && d.data.data.groups.some((g) => g.id === input.groupId) ? input.groupId : undefined;
        const studentIds = Array.isArray(input.studentIds) ? (input.studentIds as unknown[]).filter((x): x is string => typeof x === 'string' && !!d.accounts.byId(x)) : undefined;
        return json(res, 200, d.data.addSession({ title, date: input.date as string, game, topics, ...(groupId ? { groupId } : {}), ...(studentIds?.length ? { studentIds } : {}),
          ...((LEVELS_OK as readonly unknown[]).includes(input.level) ? { level: input.level as StudentLevel } : {}), ...(typeof input.presentation === 'string' ? { presentation: input.presentation.slice(0, 120) } : {}), by: teachers.nameOf(me) }));
      }
      const s = d.data.session(r1) ?? fail(404, 'Clase desconocida.');
      if (!r2 && method === 'GET') return json(res, 200, { session: s, results: sessionResults(s) });
      if (r2 === 'start' && method === 'POST') { const input = await body(req); if (typeof input.room === 'string' && /^[A-Z2-9]{4,6}$/.test(input.room)) s.room = input.room; s.status = 'live'; s.startedAt = now(); d.data.save(); return json(res, 200, s); }
      if (r2 === 'end' && method === 'POST') { s.status = 'done'; s.endedAt = now(); d.data.save(); return json(res, 200, s); }
      if (r2 === 'delete' && method === 'POST') { d.data.data.sessions = d.data.data.sessions.filter((x) => x.id !== s.id); d.data.save(); return json(res, 200, { ok: true }); }
    }
    fail(404, 'Ruta desconocida.');
  }
  return function teacherOs(req: IncomingMessage, res: ServerResponse): boolean {
    const url = new URL(req.url ?? '/', 'http://t.local');
    if (!url.pathname.startsWith('/api/teacher/')) return false;
    dispatch(req, res, url).catch((e: unknown) => { if (!(e instanceof ApiError)) console.error('[teacher-os]', e); json(res, e instanceof ApiError ? e.status : 500, { error: e instanceof ApiError ? e.message : 'Error interno.' }); });
    return true;
  };
}

/** Lo que un ALUMNO ve de los datos de la academia sobre sí mismo: nivel, repasos asignados y clases de sus grupos. Nunca notas ni asistencia. */
export function studentView(data: TeacherData, a: { id: string }, today: string) {
  const m = data.peek(a.id);
  const groups = m?.groups ?? [];
  return {
    level: m?.level ?? null,
    reviews: (m?.reviews ?? []).map((r) => ({ id: r.id, at: r.at, topics: r.topics, ...(r.note ? { note: r.note } : {}) })),
    classes: data.data.sessions.filter((s) => s.status !== 'done' && s.date >= today && ((!!s.groupId && groups.includes(s.groupId)) || !!s.studentIds?.includes(a.id)))
      .map((s) => ({ id: s.id, title: s.title, date: s.date, game: s.game, topics: s.topics, status: s.status, ...(s.status === 'live' && s.room ? { room: s.room } : {}) })),
    groups: groups.map((g) => data.data.groups.find((x) => x.id === g)?.name).filter(Boolean),
  };
}
