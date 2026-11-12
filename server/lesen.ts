// Leseverstehen 001 — práctica individual + salas de clase. Mismo patrón que server/horen.ts:
//  - La clave y las explicaciones (LESEN_SECRET) nunca salen del servidor antes de terminar.
//  - Práctica: el cliente guarda sus respuestas; al terminar manda todo a /practice/check con un `attempt` (id aleatorio).
//    Con cuenta, el resultado se guarda UNA vez por intento (refrescar o reenviar devuelve el mismo resultado sin duplicar).
//  - Clase: el profesor crea la sala, empieza y termina. Los alumnos responden en su dispositivo; el servidor guarda las respuestas.
//  - Persistencia: DATA_DIR/lesen.json (escritura atómica). Fichero nuevo: no toca ningún otro dato.
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join, resolve } from 'node:path';
import type { Guard } from './security.ts';
import { roomsToExpire } from './room-ttl.ts';
import { scoreOf, type LesenAction, type LesenResult, type LesenReviewItem, type LesenView } from '../shared/lesen.ts';
import { LESEN_EXAM, LESEN_SECRET } from './lesen/content-001.ts';

interface Player { id: string; name: string; token: string; lastSeen: number; answers: Record<string, string>; account?: string; recorded?: boolean }
interface Room { code: string; teacherToken: string; owner?: string; lastActive: number; players: Player[]; status: 'lobby' | 'running' | 'finished'; startedAt: number | null; finishedAt: number | null }
interface Saved { attempt: string; at: number; answers: Record<string, string>; points: number; byPart: number[]; mode: 'practice' | 'class'; room?: string }
interface Data { version: 1; rooms: Record<string, Room>; results: Record<string, Saved[]> }

class ApiError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status; } }
const fail = (status: number, message: string): never => { throw new ApiError(status, message); };
const token = () => randomBytes(32).toString('base64url');
function json(res: ServerResponse, status: number, value: unknown) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(value)); }
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of req) { const b = Buffer.from(chunk); size += b.length; if (size > 32768) fail(413, 'Petición demasiado grande.'); chunks.push(b); }
  let value: unknown; try { value = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { fail(400, 'JSON no válido.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400, 'Se esperaba un objeto.');
  return value as Record<string, unknown>;
}

const QUESTIONS = LESEN_EXAM.parts.flatMap((p, part) => p.questions.map((q) => ({ ...q, part })));
const MAX_SAVED = 20;

/** Solo respuestas válidas (opción existente). Teil 3: un anuncio A–H solo una vez; si se repite, cuenta la primera. */
export function cleanAnswers(raw: unknown): Record<string, string> {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const out: Record<string, string> = {}; const used = new Set<string>();
  for (const q of QUESTIONS) {
    const v = src[q.id];
    if (typeof v !== 'string' || !q.options.some((o) => o.id === v)) continue;
    if (q.type === 'matching' && v !== '0') { if (used.has(v)) continue; used.add(v); }
    out[q.id] = v;
  }
  return out;
}
export function reviewOf(answers: Record<string, string>): LesenReviewItem[] {
  return QUESTIONS.map((q) => ({ id: q.id, number: q.number, part: q.part, own: answers[q.id] ?? null, key: LESEN_SECRET.answers[q.id], ok: answers[q.id] === LESEN_SECRET.answers[q.id], explain: LESEN_SECRET.explain[q.id], tags: LESEN_SECRET.tags[q.id] }));
}
/** «Temas que conviene repasar»: categorías con fallos, ordenadas por nº de fallos. */
export function repasarOf(review: LesenReviewItem[]) {
  const m = new Map<string, { wrong: number; of: number }>();
  for (const r of review) for (const t of r.tags) { const x = m.get(t) ?? { wrong: 0, of: 0 }; x.of++; if (!r.ok) x.wrong++; m.set(t, x); }
  return [...m].filter(([, x]) => x.wrong > 0).map(([tag, x]) => ({ tag, ...x })).sort((a, b) => b.wrong / b.of - a.wrong / a.of || b.wrong - a.wrong);
}
export function resultOf(answers: Record<string, string>, saved: boolean, at: number): LesenResult {
  const review = reviewOf(answers);
  return { score: scoreOf(LESEN_EXAM, answers, LESEN_SECRET.answers), review, repasar: repasarOf(review), saved, at };
}

export interface LesenDeps {
  dataDir?: string; now?: () => number; guard?: Guard; ttlMs?: number;
  /** Cuenta de alumno de la petición (cookie). null = invitado: se corrige igual, pero no se guarda. */
  accountOf?: (req: IncomingMessage) => string | null;
  /** Se llama UNA vez por intento guardado (progreso del alumno / Teacher OS). */
  onResult?: (account: string, r: { total: number; correct: number; room?: string }) => void;
}

export function createLesenHandler({ dataDir = process.env.DATA_DIR || resolve(import.meta.dirname, '../data'), now = Date.now, guard, ttlMs = 24 * 3_600_000, accountOf = () => null, onResult }: LesenDeps = {}) {
  const file = join(dataDir, 'lesen.json');
  let data: Data = { version: 1, rooms: {}, results: {} };
  if (existsSync(file)) { try { const raw = JSON.parse(readFileSync(file, 'utf8')); data = { version: 1, rooms: raw.rooms ?? {}, results: raw.results ?? {} }; } catch (e) { console.error('[lesen] no se pudo leer lesen.json; se empieza vacío:', (e as Error).message); } }
  const save = () => { mkdirSync(dataDir, { recursive: true }); const tmp = `${file}.${randomUUID()}.tmp`; writeFileSync(tmp, JSON.stringify(data), { mode: 0o600 }); renameSync(tmp, file); };

  /** Guarda el intento si es nuevo. Devuelve el guardado (nuevo o el existente con ese id). */
  function record(account: string, attempt: string, answers: Record<string, string>, mode: Saved['mode'], room?: string): Saved {
    const list = data.results[account] ??= [];
    const old = list.find((s) => s.attempt === attempt); if (old) return old;
    const sc = scoreOf(LESEN_EXAM, answers, LESEN_SECRET.answers);
    const s: Saved = { attempt, at: now(), answers, points: sc.points, byPart: sc.byPart.map((b) => b.points), mode, ...(room ? { room } : {}) };
    list.push(s); if (list.length > MAX_SAVED) list.splice(0, list.length - MAX_SAVED);
    save();
    try { onResult?.(account, { total: LESEN_EXAM.maxPoints, correct: sc.points, ...(room ? { room } : {}) }); } catch (e) { console.error('[lesen] onResult', e); }
    return s;
  }

  function roomFor(code: unknown): Room { if (typeof code !== 'string' || !/^[A-F0-9]{6}$/.test(code)) fail(400, 'Código no válido.'); return data.rooms[code as string] || fail(404, 'Sala desconocida.'); }
  function auth(req: IncomingMessage, room: Room): { role: 'teacher' | 'player'; player?: Player } {
    const t = req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]+)$/)?.[1]; if (!t) fail(401, 'Sesión requerida.');
    room.lastActive = now();
    if (t === room.teacherToken) return { role: 'teacher' };
    const p = room.players.find((x) => x.token === t); if (!p) fail(401, 'Sesión no válida.');
    p!.lastSeen = now(); return { role: 'player', player: p };
  }
  function finish(room: Room) {
    if (room.status === 'finished') return;
    room.status = 'finished'; room.finishedAt = now();
    for (const p of room.players) if (p.account && !p.recorded) { record(p.account, `room:${room.code}:${p.id}`, p.answers, 'class', room.code); p.recorded = true; }
  }
  function action(room: Room, who: ReturnType<typeof auth>, a: LesenAction) {
    switch (a?.type) {
      case 'start': if (who.role !== 'teacher') fail(403, 'Solo el profesor.'); if (room.status !== 'lobby') fail(409, 'El examen ya ha empezado.'); room.status = 'running'; room.startedAt = now(); return;
      case 'finish': if (who.role !== 'teacher') fail(403, 'Solo el profesor.'); if (room.status === 'lobby') fail(409, 'El examen todavía no ha empezado.'); finish(room); return;
      case 'answer': {
        if (!who.player) fail(403, 'Solo el alumno.');
        if (room.status !== 'running') fail(409, room.status === 'finished' ? 'Examen terminado: respuestas bloqueadas.' : 'El examen todavía no ha empezado.');
        const q = QUESTIONS.find((x) => x.id === a.questionId); if (!q) fail(400, 'Pregunta desconocida.');
        const v = a.value;
        if (v !== null && (typeof v !== 'string' || !q!.options.some((o) => o.id === v))) fail(400, 'Respuesta no válida.');
        const answers = who.player!.answers;
        if (v === null) { delete answers[q!.id]; return; }
        if (q!.type === 'matching' && v !== '0' && QUESTIONS.some((x) => x.type === 'matching' && x.id !== q!.id && answers[x.id] === v)) fail(409, `La Anzeige ${v} ya está usada en otra situación.`);
        answers[q!.id] = v; return;
      }
      default: fail(400, 'Acción desconocida.');
    }
  }
  function view(room: Room, who: ReturnType<typeof auth>): LesenView {
    const done = room.status === 'finished';
    return {
      code: room.code, role: who.role, ...(who.player ? { me: who.player.id } : {}), exam: LESEN_EXAM,
      status: room.status, startedAt: room.startedAt, finishedAt: room.finishedAt, serverNow: now(),
      players: room.players.map((p) => ({
        id: p.id, name: p.name, connected: now() - p.lastSeen < 15000, answered: Object.keys(p.answers).length,
        // El profesor ve en su panel privado lo que marca cada alumno; la nota solo al terminar.
        ...(who.role === 'teacher' ? { answers: p.answers, ...(done ? { score: scoreOf(LESEN_EXAM, p.answers, LESEN_SECRET.answers) } : {}) } : {}),
      })),
      ...(who.player ? { ownAnswers: who.player.answers } : {}),
      ...(done && who.player ? { result: resultOf(who.player.answers, !!who.player.account, room.finishedAt ?? now()) } : {}),
      ...(done && who.role === 'teacher' ? { key: LESEN_SECRET.answers, explain: LESEN_SECRET.explain } : {}),
    };
  }

  async function dispatch(req: IncomingMessage, res: ServerResponse, url: URL) {
    const route = url.pathname.slice('/api/lesen/'.length);
    const methods: Record<string, string> = { exam: 'GET', 'practice/check': 'POST', mine: 'GET', create: 'POST', join: 'POST', state: 'GET', action: 'POST' };
    if (!Object.hasOwn(methods, route)) fail(404, 'Ruta desconocida.');
    if (req.method !== methods[route]) { res.setHeader('Allow', methods[route]); fail(405, 'Método no permitido.'); }
    // Examen público: textos, preguntas y opciones. Sin clave ni explicaciones.
    if (route === 'exam') return json(res, 200, { exam: LESEN_EXAM });
    if (route === 'practice/check') {
      const input = await body(req);
      if (input.finish !== true) fail(400, 'La corrección solo se hace al terminar.');
      const attempt = typeof input.attempt === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(input.attempt) ? input.attempt : fail(400, 'Intento no válido.');
      const account = accountOf(req);
      if (!account) { const a = cleanAnswers(input.answers); return json(res, 200, resultOf(a, false, now())); }
      const saved = record(account, attempt as string, cleanAnswers(input.answers), 'practice');
      // Si el intento ya existía, se corrige lo GUARDADO (no lo reenviado): reenviar no cambia la nota ni suma otra vez.
      return json(res, 200, resultOf(saved.answers, true, saved.at));
    }
    if (route === 'mine') {
      const account = accountOf(req); if (!account) fail(401, 'Inicia sesión para ver tus resultados.');
      return json(res, 200, { results: (data.results[account as string] ?? []).slice().reverse().map((s) => ({ at: s.at, points: s.points, outOf: LESEN_EXAM.maxPoints, byPart: s.byPart, mode: s.mode })) });
    }
    if (route === 'create') {
      const adm = guard?.admitCreate('road', guard.ip(req), Object.keys(data.rooms).length, req.headers['x-teacher-key'], guard.teacherFromRequest(req)); if (adm && !adm.ok) fail(adm.status, adm.error);
      let code: string; do { code = randomBytes(3).toString('hex').toUpperCase(); } while (data.rooms[code]);
      data.rooms[code] = { code, teacherToken: token(), players: [], status: 'lobby', startedAt: null, finishedAt: null, lastActive: now(), ...(adm?.ok && adm.owner ? { owner: adm.owner } : {}) };
      save(); return json(res, 200, { code, token: data.rooms[code].teacherToken, role: 'teacher' });
    }
    if (route === 'join') {
      const input = await body(req), room = roomFor(input.code);
      if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 40) fail(400, 'Nombre no válido.');
      if (room.status === 'finished') fail(409, 'Este examen ya ha terminado.');
      if (room.players.length >= 30) fail(409, 'Sala completa.');
      const account = accountOf(req);
      const p: Player = { id: randomUUID(), name: (input.name as string).trim(), token: token(), lastSeen: now(), answers: {}, ...(account ? { account } : {}) };
      room.players.push(p); save(); return json(res, 200, { code: room.code, token: p.token, role: 'player', pid: p.id });
    }
    if (route === 'state') { const room = roomFor(url.searchParams.get('code')), who = auth(req, room); return json(res, 200, view(room, who)); }
    if (route === 'action') {
      const input = await body(req), room = roomFor(input.code), who = auth(req, room);
      if (!input.action || typeof input.action !== 'object') fail(400, 'Acción no válida.');
      action(room, who, input.action as LesenAction); save(); return json(res, 200, view(room, who));
    }
    fail(404, 'Ruta desconocida.');
  }
  function sweep(at = now()): number {
    const gone = roomsToExpire(data.rooms, (r) => r.lastActive, (r, t) => { r.lastActive = t; }, at, ttlMs);
    for (const code of gone) delete data.rooms[code];
    if (gone.length) save();
    return gone.length;
  }
  const handler = function lesenHandler(req: IncomingMessage, res: ServerResponse): boolean {
    const url = new URL(req.url || '/', 'http://lesen.local');
    if (!url.pathname.startsWith('/api/lesen/')) return false;
    const ip = guard?.ip(req);
    const lookup = /\/(join|state|action)$/.test(url.pathname);
    if (guard && ip && lookup && guard.roomLookupBlocked(ip)) { json(res, 429, { error: 'Demasiados intentos con códigos de sala. Espera unos minutos.' }); return true; }
    void dispatch(req, res, url).catch((e: unknown) => {
      if (guard && ip && e instanceof ApiError && e.status === 404 && lookup) guard.roomMiss(ip);
      if (!(e instanceof ApiError)) console.error('[lesen]', e);
      json(res, e instanceof ApiError ? e.status : 500, { error: e instanceof ApiError ? e.message : 'No se pudo procesar la petición.' });
    });
    return true;
  };
  return Object.assign(handler, { sweep, results: (id: string) => data.results[id] ?? [], forget: (id: string) => { if (data.results[id]) { delete data.results[id]; save(); } } });
}
