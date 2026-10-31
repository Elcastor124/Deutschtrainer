// SMART LEARNING V1 · Tägliche Mission + memoria de aprendizaje.
// Sin modelos ni APIs: reglas pedagógicas explicables + repetición espaciada tipo Leitner (cajas 0–5).
//
// FUENTE ÚNICA DE EVIDENCIA: el ProgressLog (respuestas de práctica, juegos y misiones). Aquí no se duplican resultados;
// solo se guarda el estado de cada misión diaria (qué preguntas, pistas usadas, si terminó) en DATA_DIR/learning.json.
//
// Reglas del modelo (ver docs/SMART_LEARNING.md):
//  - Por pregunta solo cuenta la PRIMERA respuesta de cada día (Madrid): repetirla 20 veces no infla el dominio.
//  - Acierto independiente → sube una caja. Acierto con ayuda (pista o segundo intento) → no sube. Fallo → caja 0 (lapso).
//  - Próximo repaso = último intento + INTERVAL_DAYS[caja].
//  - Error aislado: 1 lapso en 30 días. Recurrente: ≥ 2 lapsos de la misma pregunta o ≥ 3 fallos del tema en 30 días.
// FSRS se valoró y se descartó en V1: necesita calificaciones de recuerdo (again/hard/good/easy) y bastante historial por
// ítem; con preguntas de opción múltiple y pocos repasos por alumno, Leitner es más estable y fácil de explicar.
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import type { QMc, Question, Topic } from '../shared/types.ts';
import { TOPICS } from '../shared/rules.ts';
import { madridDay, weekRange, type ProgressEvent, type ProgressLog } from './progress.ts';
import { hintFor, klausLine, type HintLevel } from './tutor.ts';
import { identify } from './play-api.ts';
import { sameOriginJson } from './cookies.ts';
import type { AccountStore } from './accounts.ts';

export type Level = 'A1' | 'A2' | 'B1';
const DAY = 86_400_000;
export const INTERVAL_DAYS = [0, 1, 3, 7, 14, 30] as const;
const MAX_BOX = 5, MAX_TRIES = 3, MISSION_SIZE = 5;
const A1_TOPICS: Topic[] = ['vorstellen', 'praesens', 'alltag', 'vocab', 'akkusativ', 'modal', 'possessiv', 'trennbar', 'imperativ', 'satzbau'];
export const LEVEL_TOPICS: Record<Level, Topic[]> = {
  A1: A1_TOPICS,
  A2: [...A1_TOPICS, 'perfekt', 'dativ', 'praep', 'nebensatz', 'adjektiv'],
  B1: [...A1_TOPICS, 'perfekt', 'dativ', 'praep', 'nebensatz', 'adjektiv'],
};
const LEVEL_DIFFS: Record<Level, string[]> = { A1: ['easy', 'medium'], A2: ['easy', 'medium'], B1: ['medium', 'hard'] };
const VOCAB_TOPICS: Topic[] = ['vocab', 'alltag', 'vorstellen'];
const topicName = (t: string) => (TOPICS as Record<string, { de: string }>)[t]?.de ?? t;

// ───────────── Memoria por pregunta (derivada del ProgressLog) ─────────────
export interface ItemStat { qid: string; topic: string; box: number; last: number; due: number; lastOk: boolean; lapses: number[]; seen: number; assisted: number }

export function itemStats(events: readonly ProgressEvent[], profile: string, topicOf: (qid: string) => string | undefined): Map<string, ItemStat> {
  const out = new Map<string, ItemStat>();
  const counted = new Set<string>(); // qid|día: solo la primera respuesta del día
  for (const e of events) {
    if (e.profile !== profile || e.kind !== 'answer' || !e.qid || typeof e.ok !== 'boolean') continue;
    const key = `${e.qid}|${madridDay(e.at)}`;
    if (counted.has(key)) continue;
    counted.add(key);
    const s = out.get(e.qid) ?? { qid: e.qid, topic: e.topic ?? topicOf(e.qid) ?? 'otros', box: 0, last: 0, due: 0, lastOk: false, lapses: [], seen: 0, assisted: 0 };
    s.seen++; s.last = e.at; s.lastOk = e.ok;
    if (e.ok && !e.assisted) s.box = Math.min(MAX_BOX, s.box + 1);
    else if (e.ok) { s.assisted++; s.box = Math.max(1, Math.min(s.box, 2)); }
    else { s.box = 0; s.lapses.push(e.at); }
    s.due = s.last + INTERVAL_DAYS[s.box] * DAY;
    out.set(e.qid, s);
  }
  return out;
}

export interface TopicMastery { topic: string; name: string; seen: number; mastery: number; errors30: number; recurring: boolean; status: 'fuerte' | 'en progreso' | 'a reforzar' }
export function topicMastery(stats: Map<string, ItemStat>, now: number): TopicMastery[] {
  const by = new Map<string, ItemStat[]>();
  for (const s of stats.values()) by.set(s.topic, [...(by.get(s.topic) ?? []), s]);
  return [...by].map(([topic, list]) => {
    const mastery = Math.round((list.reduce((m, s) => m + s.box, 0) / (list.length * MAX_BOX)) * 100) / 100;
    const errors30 = list.reduce((m, s) => m + s.lapses.filter((t) => t > now - 30 * DAY).length, 0);
    const recurring = errors30 >= 3 || list.some((s) => s.lapses.filter((t) => t > now - 30 * DAY).length >= 2);
    return { topic, name: topicName(topic), seen: list.length, mastery, errors30, recurring, status: (recurring || mastery < 0.3 ? 'a reforzar' : mastery >= 0.6 ? 'fuerte' : 'en progreso') as TopicMastery['status'] };
  }).sort((a, b) => a.mastery - b.mastery);
}

// ───────────── Generación de la misión diaria ─────────────
export type Slot = 'repaso' | 'error' | 'nivel' | 'vocab';
export interface MissionItem { qid: string; slot: Slot; topic: string; reason: string }

function seeded(seed: string) {
  let h = 2166136261; for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}

/** Pura y determinista para (perfil, día, historial): la misma entrada da la misma misión. */
export function buildMission(input: { profile: string; day: string; now: number; level: Level; stats: Map<string, ItemStat>; bank: Map<string, Question> }): MissionItem[] {
  const { day, now, level, stats, bank } = input;
  const rand = seeded(`${input.profile}:${day}`);
  const seenTopics = new Set([...stats.values()].map((s) => s.topic));
  const allowed = new Set<string>([...LEVEL_TOPICS[level], ...[...seenTopics].filter((t) => t !== 'lesen' && t in TOPICS)]);
  const pool = [...bank.values()].filter((q): q is QMc => q.type === 'mc' && q.diff !== 'special' && q.topic !== 'lesen' && allowed.has(q.topic));
  const today = (s?: ItemStat) => !!s && madridDay(s.last) === day;
  const used = new Set<string>(); const out: MissionItem[] = [];
  const shuffle = <T>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const take = (qid: string, slot: Slot, reason: string) => { const q = bank.get(qid)!; used.add(qid); out.push({ qid, slot, topic: q.topic, reason }); };
  /** Pregunta nueva (o no vista hace tiempo) de un tema, de la dificultad del nivel. */
  const fresh = (topics: string[], diffs = LEVEL_DIFFS[level]) => {
    const cands = shuffle(pool.filter((q) => topics.includes(q.topic) && !used.has(q.id) && diffs.includes(q.diff)));
    return cands.find((q) => !stats.has(q.id)) ?? cands.find((q) => { const s = stats.get(q.id); return !!s && !today(s) && s.due <= now; }) ?? cands.find((q) => !today(stats.get(q.id)));
  };
  /** Equilibrado: primero el TEMA (los que aún no salen en la misión, en orden aleatorio) y luego una pregunta de ese tema. */
  const freshByTopic = (topics: string[], diffs = LEVEL_DIFFS[level]) => {
    const order = shuffle([...new Set(topics)]).sort((a, b) => Number(out.some((o) => o.topic === a)) - Number(out.some((o) => o.topic === b)));
    for (const t of order) { const q = fresh([t], diffs); if (q) return q; }
    return undefined;
  };
  const days = (t: number) => Math.max(1, Math.round((now - t) / DAY));

  // 1–2 · Repaso: lo acertado antes cuyo intervalo ya venció (lo más atrasado primero; temas distintos si se puede).
  const due = [...stats.values()].filter((s) => s.lastOk && s.box >= 1 && s.due <= now && !today(s) && bank.get(s.qid)?.type === 'mc' && allowed.has(s.topic))
    .sort((a, b) => (now - b.due) / (INTERVAL_DAYS[b.box] + 1) - (now - a.due) / (INTERVAL_DAYS[a.box] + 1));
  for (const s of due) { if (out.length >= 2) break; if (out.some((o) => o.topic === s.topic) && due.some((x) => !used.has(x.qid) && !out.some((o) => o.topic === x.topic))) continue; take(s.qid, 'repaso', `Repaso: la acertaste hace ${days(s.last)} día${days(s.last) === 1 ? '' : 's'}.`); }
  while (out.length < 2) {
    const practiced = [...seenTopics].filter((t) => allowed.has(t));
    const q = practiced.length ? freshByTopic(practiced, ['easy', 'medium']) : freshByTopic(LEVEL_TOPICS[level].slice(0, 3), ['easy']);
    if (!q) break; take(q.id, practiced.length ? 'repaso' : 'nivel', practiced.length ? `Repaso de «${topicName(q.topic)}», que ya has trabajado.` : `Base del nivel ${level}: ${topicName(q.topic)}.`);
  }

  // 3 · Error reciente (recurrente primero). Si esa pregunta ya salió hoy, otra del mismo tema.
  const wrong = [...stats.values()].filter((s) => !s.lastOk && allowed.has(s.topic) && bank.has(s.qid))
    .sort((a, b) => (b.lapses.length >= 2 ? 1 : 0) - (a.lapses.length >= 2 ? 1 : 0) || b.last - a.last);
  const w = wrong[0];
  if (w) {
    const recurring = w.lapses.filter((t) => t > now - 30 * DAY).length >= 2;
    const label = recurring ? 'Error recurrente' : 'Error reciente';
    if (!today(w) && bank.get(w.qid)?.type === 'mc' && !used.has(w.qid)) take(w.qid, 'error', `${label}: fallaste esta pregunta de «${topicName(w.topic)}».`);
    else { const q = fresh([w.topic], ['easy', 'medium', 'hard']); if (q) take(q.id, 'error', `${label} en «${topicName(w.topic)}»: una parecida para afianzarlo.`); }
  }

  // 4 · Consolidar el nivel: el tema del nivel con menos dominio (los no vistos cuentan como 0).
  const mastery = new Map(topicMastery(stats, now).map((m) => [m.topic, m.mastery]));
  const levelTopics = shuffle([...LEVEL_TOPICS[level]]).sort((a, b) => (mastery.get(a) ?? 0) - (mastery.get(b) ?? 0));
  const target = [...levelTopics.filter((t) => !out.some((o) => o.topic === t)), ...levelTopics.filter((t) => out.some((o) => o.topic === t))];
  for (const t of target) { const q = fresh([t]); if (q) { take(q.id, 'nivel', `Consolidar ${level}: ${topicName(t)}${mastery.has(t) ? ` (dominio ${Math.round(mastery.get(t)! * 100)} %)` : ' (nuevo para ti)'}.`); break; } }
  // Si no había error que repasar, otra de consolidación.
  while (out.length < MISSION_SIZE - 1) { const q = freshByTopic(levelTopics); if (!q) break; take(q.id, 'nivel', `Consolidar ${level}: ${topicName(q.topic)}.`); }

  // 5 · Vocabulario breve.
  const v = freshByTopic(VOCAB_TOPICS.filter((t) => allowed.has(t)), ['easy']) ?? fresh(VOCAB_TOPICS.filter((t) => allowed.has(t)));
  if (v) take(v.id, 'vocab', `Vocabulario: ${topicName(v.topic)}.`);
  while (out.length < MISSION_SIZE) { const q = freshByTopic([...allowed]); if (!q) break; take(q.id, 'nivel', `Consolidar ${level}: ${topicName(q.topic)}.`); }
  return out;
}

// ───────────── Estado de misiones (persistido) ─────────────
interface ItemState { tries: number[]; hints: number; revealed: boolean; final: boolean; ok: boolean; assisted: boolean }
export interface MissionRec { id: string; profile: string; day: string; level: Level; createdAt: number; items: MissionItem[]; state: Record<string, ItemState>; completedAt?: number }
interface Data { version: 1; missions: Record<string, MissionRec[]> }

export class LearningStore {
  readonly file: string | null;
  data: Data = { version: 1, missions: {} };
  constructor(dataDir?: string) {
    this.file = dataDir ? join(dataDir, 'learning.json') : null;
    if (this.file && existsSync(this.file)) {
      try { const raw = JSON.parse(readFileSync(this.file, 'utf8')); if (raw?.missions && typeof raw.missions === 'object') this.data = { version: 1, missions: raw.missions }; }
      catch (e) { console.error('[learning] no se pudo leer learning.json; se empieza vacío:', (e as Error).message); }
    }
  }
  save() {
    if (!this.file) return;
    mkdirSync(join(this.file, '..'), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.data), { mode: 0o600 }); renameSync(tmp, this.file);
  }
  of(profile: string) { return (this.data.missions[profile] ??= []); }
  forget(profile: string) { delete this.data.missions[profile]; this.save(); }
}

export interface LearningDeps { accounts: AccountStore; log: () => ProgressLog; bank: Map<string, Question>; store: LearningStore; levelOf?: (profile: string) => Level | null; now?: () => number }

export function createLearning({ accounts, log, bank, store, levelOf, now = Date.now }: LearningDeps) {
  const guests = new Map<string, MissionRec>(); // invitados: solo en memoria, nunca en el historial
  const topicOf = (qid: string) => bank.get(qid)?.topic;
  const statsOf = (profile: string) => itemStats(log().events, profile, topicOf);

  function today(profile: string | null): MissionRec {
    const t = now(), day = madridDay(t);
    if (profile) {
      const list = store.of(profile);
      const have = list.find((m) => m.day === day);
      if (have) return have;
      const level = levelOf?.(profile) ?? 'A1';
      const rec: MissionRec = { id: `m_${randomBytes(8).toString('hex')}`, profile, day, level, createdAt: t, items: buildMission({ profile, day, now: t, level, stats: statsOf(profile), bank }), state: {} };
      list.push(rec); list.splice(0, Math.max(0, list.length - 120)); store.save();
      return rec;
    }
    for (const [k, m] of guests) if (now() - m.createdAt > DAY) guests.delete(k);
    const rec: MissionRec = { id: `g_${randomBytes(8).toString('hex')}`, profile: 'guest', day, level: 'A1', createdAt: t, items: buildMission({ profile: 'guest', day, now: t, level: 'A1', stats: new Map(), bank }), state: {} };
    guests.set(rec.id, rec);
    return rec;
  }
  function find(profile: string | null, id: string): MissionRec {
    const m = profile ? store.data.missions[profile]?.find((x) => x.id === id) : guests.get(id);
    if (!m) throw new LearningError(404, 'Esa misión no existe o no es tuya.');
    return m;
  }
  const st = (m: MissionRec, qid: string) => (m.state[qid] ??= { tries: [], hints: 0, revealed: false, final: false, ok: false, assisted: false });

  function publicItem(m: MissionRec, it: MissionItem) {
    const q = bank.get(it.qid) as QMc; const s = m.state[it.qid];
    return { qid: it.qid, slot: it.slot, reason: it.reason, topic: it.topic, topicName: topicName(it.topic), prompt: q.prompt, options: q.options,
      tries: s?.tries ?? [], hints: s?.hints ?? 0, final: !!s?.final, ok: !!s?.ok, assisted: !!s?.assisted,
      ...(s?.final ? { solution: q.answer, explain: q.explain } : {}) };
  }
  function weekDays(profile: string | null): boolean[] {
    const from = weekRange(now()).from; const [y, mo, d] = from.split('-').map(Number);
    const days = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(y, mo - 1, d + i, 12)).toISOString().slice(0, 10));
    if (!profile) return days.map(() => false);
    const active = new Set(log().events.filter((e) => e.profile === profile).map((e) => madridDay(e.at)));
    return days.map((x) => active.has(x));
  }
  function summary(m: MissionRec) {
    const items = m.items.map((it) => ({ ...it, s: m.state[it.qid] }));
    const independent = items.filter((x) => x.s?.ok && !x.s.assisted), assisted = items.filter((x) => x.s?.ok && x.s.assisted), wrong = items.filter((x) => x.s && !x.s.ok);
    const profile = m.profile === 'guest' ? null : m.profile;
    const weak = profile ? topicMastery(statsOf(profile), now()).find((t) => t.status === 'a reforzar') : undefined;
    const recover = [...new Set([...wrong, ...assisted].map((x) => topicName(x.topic)))];
    return {
      independent: independent.length, assisted: assisted.length, wrong: wrong.length, total: items.length,
      reinforced: [...new Set(independent.map((x) => topicName(x.topic)))], recover,
      next: recover.length ? `Mañana Klaus te volverá a proponer: ${recover.join(', ')}.` : weak ? `Próximo foco: ${weak.name}.` : '¡Todo en orden! Mañana, repaso espaciado y algo nuevo de tu nivel.',
    };
  }
  function view(m: MissionRec) {
    const profile = m.profile === 'guest' ? null : m.profile;
    return { id: m.id, day: m.day, level: m.level, guest: !profile, completedAt: m.completedAt ?? null, items: m.items.map((it) => publicItem(m, it)),
      topics: [...new Set(m.items.map((it) => topicName(it.topic)))], weekDays: weekDays(profile), ...(m.completedAt ? { summary: summary(m) } : {}) };
  }
  function record(m: MissionRec, qid: string, ok: boolean, assisted: boolean) {
    if (m.profile === 'guest') return; // invitados: nada se atribuye a ninguna cuenta
    log().record({ profile: m.profile, kind: 'answer', source: 'mission', qid, topic: bank.get(qid)?.topic, ok, ...(assisted ? { assisted: true } : {}) });
  }

  function answer(m: MissionRec, qid: string, choice: unknown) {
    if (m.completedAt) throw new LearningError(409, 'Esta misión ya está terminada.');
    if (!m.items.some((it) => it.qid === qid)) throw new LearningError(400, 'Esa pregunta no es de esta misión.');
    const q = bank.get(qid) as QMc; const s = st(m, qid);
    if (s.final) throw new LearningError(409, 'Esta pregunta ya está cerrada.');
    if (!Number.isInteger(choice) || (choice as number) < 0 || (choice as number) >= q.options.length) throw new LearningError(400, 'Opción no válida.');
    if (s.tries.includes(choice as number)) throw new LearningError(409, 'Ya probaste esa opción.');
    s.tries.push(choice as number);
    const ok = choice === q.answer;
    const first = s.tries.length === 1;
    if (ok) { s.final = true; s.ok = true; s.assisted = !first || s.hints > 0; record(m, qid, true, s.assisted); }
    else { if (first) record(m, qid, false, false); if (s.tries.length >= MAX_TRIES) { s.final = true; s.revealed = true; } }
    store.save();
    return { correct: ok, final: s.final, ...(ok ? {} : { klaus: klausLine(`${m.id}${qid}${s.tries.length}`) }), item: publicItem(m, m.items.find((it) => it.qid === qid)!) };
  }
  function hint(m: MissionRec, qid: string, level: unknown) {
    if (!m.items.some((it) => it.qid === qid)) throw new LearningError(400, 'Esa pregunta no es de esta misión.');
    const s = st(m, qid);
    const lv = Number(level) as HintLevel;
    if (![1, 2, 3].includes(lv)) throw new LearningError(400, 'Nivel de pista no válido.');
    if (lv > s.hints + 1 && !(lv === 3 && s.tries.length > 0)) throw new LearningError(400, 'Las pistas van de una en una.');
    if (lv === 3 && !s.final) { s.revealed = true; s.final = true; if (!s.tries.length) record(m, qid, false, true); }
    s.hints = Math.max(s.hints, lv);
    store.save();
    return { hint: hintFor(bank.get(qid)!, lv), item: publicItem(m, m.items.find((it) => it.qid === qid)!) };
  }
  function complete(m: MissionRec) {
    if (!m.completedAt) {
      if (!m.items.every((it) => m.state[it.qid]?.final)) throw new LearningError(400, 'Te quedan preguntas por terminar.');
      m.completedAt = now();
      if (m.profile !== 'guest') log().record({ profile: m.profile, kind: 'session', source: 'mission', points: 5 });
      store.save();
    }
    return view(m);
  }
  function history(profile: string) {
    const t = now(); const stats = statsOf(profile);
    const missions = store.of(profile).filter((m) => m.completedAt).slice(-30).reverse().map((m) => ({ day: m.day, completedAt: m.completedAt, ...summary(m) }));
    const mastery = topicMastery(stats, t);
    return { missions, completed: missions.length, mastery, due: [...stats.values()].filter((s) => s.due <= t).length, weekDays: weekDays(profile) };
  }

  /** HTTP: /api/mission (GET hoy) · /answer · /hint · /complete · /history, y /api/tutor/hint (práctica, sin estado, niveles 1–2). */
  const handler = function learningHandler(req: IncomingMessage, res: ServerResponse): boolean {
    const url = new URL(req.url || '/', 'http://x');
    if (!url.pathname.startsWith('/api/mission') && url.pathname !== '/api/tutor/hint') return false;
    void (async () => {
      const who = identify(accounts, req);
      if (who.kind === 'invalid') throw new LearningError(401, 'Tu sesión ha caducado. Vuelve a entrar.');
      const profile = who.kind === 'account' ? who.account.id : null;
      const route = url.pathname;
      if (req.method === 'POST' && !sameOriginJson(req)) throw new LearningError(403, 'Petición no permitida.');
      if (route === '/api/tutor/hint' && req.method === 'GET') {
        const q = bank.get(url.searchParams.get('qid') ?? ''); const lv = Number(url.searchParams.get('level'));
        if (!q) throw new LearningError(404, 'Pregunta desconocida.');
        if (lv !== 1 && lv !== 2) throw new LearningError(400, 'En la práctica Klaus da pistas de nivel 1 y 2; la solución sale al corregir.');
        return send(res, 200, { hint: hintFor(q, lv) });
      }
      if (route === '/api/mission' && req.method === 'GET') return send(res, 200, view(today(profile)));
      if (route === '/api/mission/history' && req.method === 'GET') { if (!profile) throw new LearningError(401, 'Inicia sesión para ver tu historial.'); return send(res, 200, history(profile)); }
      if (req.method !== 'POST') throw new LearningError(405, 'Método no permitido.');
      const input = await readBody(req);
      const m = find(profile, String(input.id ?? ''));
      if (route === '/api/mission/answer') return send(res, 200, answer(m, String(input.qid ?? ''), input.choice));
      if (route === '/api/mission/hint') return send(res, 200, hint(m, String(input.qid ?? ''), input.level));
      if (route === '/api/mission/complete') return send(res, 200, complete(m));
      throw new LearningError(404, 'Ruta desconocida.');
    })().catch((e: unknown) => send(res, e instanceof LearningError ? e.status : 500, { error: e instanceof LearningError ? e.message : 'Error interno.' }));
    return true;
  };
  return Object.assign(handler, { history, today, statsOf });
}

class LearningError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status; } }
function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(body));
}
async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []; let n = 0;
  for await (const c of req) { n += (c as Buffer).length; if (n > 4096) throw new LearningError(413, 'Petición demasiado grande.'); chunks.push(Buffer.from(c)); }
  try { const v = JSON.parse(Buffer.concat(chunks).toString('utf8')); if (v && typeof v === 'object' && !Array.isArray(v)) return v; } catch { /* abajo */ }
  throw new LearningError(400, 'JSON no válido.');
}
