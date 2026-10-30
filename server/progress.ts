// Progreso de alumnos: registro de eventos (append-only) + puntos semanales.
// Ver docs/progress.md para el modelo de datos, reglas de puntos y el futuro modo profesor.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join, resolve } from 'node:path';

const TZ = 'Europe/Madrid';
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

/** Día local de Madrid (YYYY-MM-DD) para un instante (ms). Respeta CET/CEST. */
export function madridDay(at: number): string {
  return dayFmt.format(new Date(at));
}

/** Semana ISO-8601 (YYYY-Www) del día local de Madrid. Las semanas empiezan el lunes 00:00 hora de Madrid. */
export function isoWeek(at: number): string {
  return isoWeekOfDay(madridDay(at));
}

function isoWeekOfDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = date.getUTCDay() || 7; // 1 = lunes … 7 = domingo
  date.setUTCDate(date.getUTCDate() + 4 - dow); // jueves de esa semana decide el año ISO
  const year = date.getUTCFullYear();
  const week = Math.ceil(((date.getTime() - Date.UTC(year, 0, 1)) / 86_400_000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function shiftDay(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days, 12)).toISOString().slice(0, 10);
}

// ───────────── modelo ─────────────
export type ProgressKind = 'answer' | 'session' | 'game';
export type ProgressSource = 'practice' | 'class' | 'jenga' | 'boxing' | 'road';
export interface ProgressEvent {
  at: number; profile: string; kind: ProgressKind; source: ProgressSource;
  qid?: string; topic?: string; ok?: boolean; points: number; room?: string;
  /** Parte de `points` que procede del bonus diario (transparencia para el profesor). */
  bonus?: number;
  /** Solo en `kind:'game'` del modo libre: actividad educativa completada (ver ProgressLog.activity). */
  game?: string; level?: string; total?: number; correct?: number;
}
export type ProgressInput = Omit<ProgressEvent, 'at' | 'points' | 'bonus'> & { points?: number };

/**
 * REGLAS DE PUNTOS (simples y explicables a los alumnos):
 *  - Respuesta correcta: +10. Intento fallido: +2 (premia el esfuerzo).
 *  - Anti-farming: cada pregunta (qid) puede dar puntos de acierto UNA vez por día de Madrid
 *    y puntos de intento UNA vez por día. Repetir la misma pregunta el mismo día suma 0
 *    (se registra igualmente para estadísticas). Al día siguiente vuelve a puntuar.
 *  - Bonus diario: la primera respuesta del día suma +5; con racha de 3+ días seguidos, +10.
 *  - Juegos externos (boxeo, Road to B1, Jenga): el servidor otorga 0–50 puntos por evento (award()).
 *  - Las semanas son ISO (lunes 00:00 → domingo 23:59, hora de Madrid).
 */
export const POINTS = { correct: 10, attempt: 2, dailyBonus: 5, streakBonus: 10, streakFor: 3, maxAward: 50 } as const;
/**
 * MODO LIBRE (solo cuentas `acc_…`; los invitados no puntúan ni se guardan). Los puntos salen SOLO de respuestas validadas por el servidor
 * y de actividades completadas; el tiempo conectado no puntúa nunca.
 *  - Tope diario por cuenta: 200 puntos (todas las fuentes). Lo que exceda se registra con 0 puntos (las estadísticas no se pierden).
 *  - Actividad completada: ≥ 8 preguntas respondidas y ≥ 40 % de acierto (adivinar al azar no basta); A1 +4 · A2 +6 · B1 +10;
 *    como máximo 3 actividades recompensadas por día. Los ejercicios fáciles pagan menos y cada pregunta puntúa una vez al día.
 */
export const FREEPLAY = { dailyCap: 200, minQuestions: 8, minAccuracy: 0.4, rewardedPerDay: 3, levelPoints: { A1: 4, A2: 6, B1: 10 } as Record<string, number> } as const;
export const isAccountProfile = (id: string) => id.startsWith('acc_');
const GAMES_OK = ['blackcard', 'jenga', 'boxing'] as const;
export const RETENTION_DAYS = 180;
const MAX_EVENTS = 200_000;
const KINDS: readonly ProgressKind[] = ['answer', 'session', 'game'];
const SOURCES: readonly ProgressSource[] = ['practice', 'class', 'jenga', 'boxing', 'road'];
export const PROFILE_RE = /^[\w-]{8,64}$/;
const str = (v: unknown, max: number) => (typeof v === 'string' && v.length > 0 ? v.slice(0, max) : undefined);

export interface WeekPoints { week: string; points: number }
export interface TopicStat { topic: string; attempts: number; correct: number; accuracy: number }

export class ProgressLog {
  events: ProgressEvent[] = [];
  readonly now: () => number;
  readonly file: string | null;
  private readonly saveDelay: number;
  private timer: NodeJS.Timeout | null = null;

  /** Sin dataDir el registro vive solo en memoria (tests/herramientas). */
  constructor({ dataDir, now = Date.now, saveDelay = 1000 }: { dataDir?: string; now?: () => number; saveDelay?: number } = {}) {
    this.now = now;
    this.saveDelay = saveDelay;
    this.file = dataDir ? join(dataDir, 'progress.json') : null;
    if (this.file && existsSync(this.file)) {
      try {
        const raw = JSON.parse(readFileSync(this.file, 'utf8'));
        if (Array.isArray(raw?.events)) this.events = raw.events.filter((e: ProgressEvent) => e && typeof e.at === 'number' && typeof e.profile === 'string' && typeof e.points === 'number');
      } catch (e) {
        console.error('[progress] no se pudo leer progress.json, se empieza vacío:', (e as Error).message);
      }
    }
    this.prune();
  }

  /** Descarta eventos de más de RETENTION_DAYS días (y limita el total por seguridad). */
  private prune() {
    const cutoff = this.now() - RETENTION_DAYS * 86_400_000;
    if (this.events.length && (this.events[0].at < cutoff || this.events.length > MAX_EVENTS)) {
      this.events = this.events.filter((e) => e.at >= cutoff).slice(-MAX_EVENTS);
    }
  }

  private saveSoon() {
    if (!this.file || this.timer) return;
    this.timer = setTimeout(() => { this.timer = null; this.flush(); }, this.saveDelay);
    this.timer.unref?.();
  }

  /** Escritura atómica (tmp + rename). Llamar también al apagar el servidor. */
  flush() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (!this.file) return;
    this.prune();
    mkdirSync(join(this.file, '..'), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify({ version: 1, events: this.events }), { mode: 0o600 });
    renameSync(tmp, this.file);
  }

  /** Registra un evento validado. Devuelve el evento (con puntos calculados) o null si es inválido. */
  record(input: ProgressInput): ProgressEvent | null {
    if (!input || typeof input !== 'object') return null;
    if (typeof input.profile !== 'string' || !PROFILE_RE.test(input.profile)) return null;
    if (!KINDS.includes(input.kind) || !SOURCES.includes(input.source)) return null;
    const at = this.now();
    const ev: ProgressEvent = { at, profile: input.profile, kind: input.kind, source: input.source, points: 0 };
    const qid = str(input.qid, 80), topic = str(input.topic, 60), room = str(input.room, 16);
    if (qid) ev.qid = qid;
    if (topic) ev.topic = topic;
    if (room) ev.room = room;
    if (input.kind === 'answer') {
      if (!qid || typeof input.ok !== 'boolean') return null;
      ev.ok = input.ok;
      ev.points = this.answerPoints(ev);
    } else {
      const p = Number(input.points);
      ev.points = Number.isFinite(p) ? Math.max(0, Math.min(POINTS.maxAward, Math.round(p))) : 0;
      if (input.kind === 'game') {
        const int = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 500 ? (v as number) : undefined);
        if (typeof input.game === 'string' && (GAMES_OK as readonly string[]).includes(input.game)) ev.game = input.game;
        if (typeof input.level === 'string' && input.level in FREEPLAY.levelPoints) ev.level = input.level;
        const t = int(input.total), c = int(input.correct);
        if (t !== undefined && c !== undefined && c <= t) { ev.total = t; ev.correct = c; }
      }
    }
    if (isAccountProfile(ev.profile) && ev.points > 0) {
      ev.points = Math.min(ev.points, Math.max(0, FREEPLAY.dailyCap - this.dayPoints(ev.profile, madridDay(at))));
      if (ev.bonus !== undefined && ev.bonus > ev.points) ev.bonus = ev.points;
    }
    this.events.push(ev);
    this.saveSoon();
    return ev;
  }

  private dayPoints(profile: string, day: string): number {
    let sum = 0;
    for (const e of this.events) if (e.profile === profile && madridDay(e.at) === day) sum += e.points;
    return sum;
  }

  /**
   * Registra una actividad educativa COMPLETADA del modo libre y calcula sus puntos en el servidor (ver FREEPLAY).
   * Se guarda siempre (historial), pero solo puntúa si cumple las condiciones y no se ha superado el límite diario.
   */
  activity(profile: string, a: { game: string; level?: string; total: number; correct: number; room?: string }): ProgressEvent | null {
    const day = madridDay(this.now());
    const rewardedToday = this.events.filter((e) => e.profile === profile && e.kind === 'game' && e.game && e.points > 0 && madridDay(e.at) === day).length;
    const valid = a.total >= FREEPLAY.minQuestions && a.correct / Math.max(1, a.total) >= FREEPLAY.minAccuracy;
    const points = valid && rewardedToday < FREEPLAY.rewardedPerDay ? FREEPLAY.levelPoints[a.level ?? ''] ?? 0 : 0;
    return this.record({ profile, kind: 'game', source: a.game === 'boxing' ? 'boxing' : a.game === 'jenga' ? 'jenga' : 'practice', points, room: a.room, game: a.game, level: a.level, total: a.total, correct: a.correct });
  }

  /** Para el resumen del alumno: últimas actividades completadas. */
  recentActivities(profile: string, n = 10) {
    return this.events.filter((e) => e.profile === profile && e.kind === 'game' && e.game && e.total !== undefined).slice(-n).reverse()
      .map((e) => ({ at: e.at, game: e.game!, level: e.level ?? null, correct: e.correct ?? 0, total: e.total ?? 0 }));
  }

  /** Precisión por semana ISO (últimas n), solo respuestas reales. */
  accuracyByWeek(profile: string, n = 8): { week: string; attempts: number; accuracy: number | null }[] {
    const weeks = this.weeks(n);
    const acc = new Map(weeks.map((w) => [w, { attempts: 0, correct: 0 }]));
    for (const e of this.events) {
      if (e.profile !== profile || e.kind !== 'answer' || typeof e.ok !== 'boolean') continue;
      const a = acc.get(isoWeek(e.at)); if (a) { a.attempts++; if (e.ok) a.correct++; }
    }
    return weeks.map((week) => { const a = acc.get(week)!; return { week, attempts: a.attempts, accuracy: a.attempts ? Math.round((a.correct / a.attempts) * 100) / 100 : null }; });
  }

  /** Preguntas que más falla (≥ 2 fallos), de más a menos. */
  frequentErrors(profile: string, max = 5): { qid: string; topic: string; wrong: number; attempts: number }[] {
    const m = new Map<string, { qid: string; topic: string; wrong: number; attempts: number }>();
    for (const e of this.events) {
      if (e.profile !== profile || e.kind !== 'answer' || !e.qid || typeof e.ok !== 'boolean') continue;
      const x = m.get(e.qid) ?? { qid: e.qid, topic: e.topic ?? '', wrong: 0, attempts: 0 };
      x.attempts++; if (!e.ok) x.wrong++;
      m.set(e.qid, x);
    }
    return [...m.values()].filter((x) => x.wrong >= 2).sort((a, b) => b.wrong - a.wrong || b.attempts - a.attempts).slice(0, max);
  }

  /** Borra todo el historial de un perfil (baja de la cuenta). */
  removeProfile(profile: string) {
    this.events = this.events.filter((e) => e.profile !== profile);
    this.saveSoon();
  }

  /** Puntos para juegos/sesiones (boxeo, Road…): 0–50, otorgados por el servidor, nunca por el cliente. */
  award(profile: string, source: ProgressSource, points: number, room?: string): ProgressEvent | null {
    return this.record({ profile, kind: 'game', source, points, room });
  }

  private answerPoints(ev: ProgressEvent): number {
    const day = madridDay(ev.at);
    const today = this.events.filter((e) => e.profile === ev.profile && e.kind === 'answer' && madridDay(e.at) === day);
    const scoredBefore = today.some((e) => e.qid === ev.qid && e.ok === ev.ok && e.points - (e.bonus ?? 0) > 0);
    let pts = scoredBefore ? 0 : ev.ok ? POINTS.correct : POINTS.attempt;
    if (today.length === 0) {
      const streak = this.streakEnding(ev.profile, shiftDay(day, -1)) + 1;
      ev.bonus = streak >= POINTS.streakFor ? POINTS.streakBonus : POINTS.dailyBonus;
      pts += ev.bonus;
    }
    return pts;
  }

  private activeDays(profile: string): Set<string> {
    return new Set(this.events.filter((e) => e.profile === profile).map((e) => madridDay(e.at)));
  }

  private streakEnding(profile: string, day: string): number {
    const days = this.activeDays(profile);
    let n = 0;
    while (days.has(day)) { n++; day = shiftDay(day, -1); }
    return n;
  }

  /** Racha de días seguidos con actividad. Sigue viva si hoy aún no se ha practicado pero ayer sí. */
  streak(profile: string): number {
    const today = madridDay(this.now());
    const days = this.activeDays(profile);
    return this.streakEnding(profile, days.has(today) ? today : shiftDay(today, -1));
  }

  weekPoints(profile: string, week = isoWeek(this.now())): number {
    let sum = 0;
    for (const e of this.events) if (e.profile === profile && isoWeek(e.at) === week) sum += e.points;
    return sum;
  }

  /** Las últimas `n` semanas ISO (de la más antigua a la actual). */
  weeks(n = 8): string[] {
    const today = madridDay(this.now());
    return Array.from({ length: n }, (_, i) => isoWeekOfDay(shiftDay(today, -7 * (n - 1 - i))));
  }

  /** Precisión por tema (todo el periodo retenido), ordenada por tema. */
  topics(profile: string): TopicStat[] {
    const map = new Map<string, TopicStat>();
    for (const e of this.events) {
      if (e.profile !== profile || e.kind !== 'answer' || !e.topic || typeof e.ok !== 'boolean') continue;
      const t = map.get(e.topic) ?? { topic: e.topic, attempts: 0, correct: 0, accuracy: 0 };
      t.attempts++; if (e.ok) t.correct++;
      map.set(e.topic, t);
    }
    return [...map.values()].map((t) => ({ ...t, accuracy: Math.round((t.correct / t.attempts) * 100) / 100 })).sort((a, b) => a.topic.localeCompare(b.topic));
  }

  /** Temas más flojos: al menos 2 intentos y < 85 % de acierto, del peor al mejor (máx. 3). */
  recommended(profile: string, max = 3): string[] {
    return this.topics(profile).filter((t) => t.attempts >= 2 && t.accuracy < 0.85)
      .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts).slice(0, max).map((t) => t.topic);
  }

  summary(profile: string) {
    const weeks = this.weeks(8);
    const totals = new Map(weeks.map((w) => [w, 0]));
    for (const e of this.events) if (e.profile === profile) { const w = isoWeek(e.at); if (totals.has(w)) totals.set(w, totals.get(w)! + e.points); }
    const history: WeekPoints[] = weeks.map((week) => ({ week, points: totals.get(week)! }));
    const week = weeks.at(-1)!;
    return { week, weekPoints: totals.get(week)!, streak: this.streak(profile), history };
  }
}

// ───────────── ranking ─────────────
export interface LeaderboardEntry { rank: number; name: string; points: number }
export type ProfileLookup = (id: string) => { name?: string; code?: string } | undefined;
const displayName = (lookup: ProfileLookup, id: string) => (lookup(id)?.name || '').trim().slice(0, 16) || 'Alumno';

/** Totales de la semana por perfil, de mayor a menor, con ranking de competición (empates comparten puesto). */
export function standings(log: ProgressLog, week: string, include: (profile: string) => boolean = () => true): { profile: string; points: number; rank: number }[] {
  const totals = new Map<string, number>();
  for (const e of log.events) if (isoWeek(e.at) === week && include(e.profile)) totals.set(e.profile, (totals.get(e.profile) ?? 0) + e.points);
  const rows = [...totals].filter(([, p]) => p > 0).map(([profile, points]) => ({ profile, points, rank: 0 })).sort((a, b) => b.points - a.points);
  rows.forEach((r, i) => { r.rank = i > 0 && rows[i - 1].points === r.points ? rows[i - 1].rank : i + 1; });
  return rows;
}

// ───────────── HTTP ─────────────
function json(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(value));
}

let current: ProgressLog | null = null;
const defaultDir = () => process.env.DATA_DIR || resolve(import.meta.dirname, '../data');

/**
 * Registra un evento en el registro activo (el creado por createProgressHandler, o uno perezoso en DATA_DIR).
 * Síncrono y barato: la escritura a disco va con debounce. Nunca lanza.
 */
export function recordEvent(input: ProgressInput): ProgressEvent | null {
  try { return (current ??= new ProgressLog({ dataDir: defaultDir() })).record(input); } catch (e) { console.error('[progress] evento descartado:', (e as Error).message); return null; }
}
/** Atajo para juegos (boxeo, Road to B1, Jenga): puntos 0–50 decididos por el servidor. */
export function awardPoints(profile: string, source: ProgressSource, points: number, room?: string) {
  return recordEvent({ profile, kind: 'game', source, points, room });
}

/**
 * Rutas de alumno (públicas, sin datos ajenos):
 *   GET /api/progress/me?profile=<id>   → resumen propio
 *   GET /api/progress/leaderboard       → semana actual: solo nombre + puntos
 * El modo profesor (docs/progress.md) NO se expone todavía.
 */
export function createProgressHandler({ dataDir = defaultDir(), now = Date.now, profiles = () => undefined, log }: { dataDir?: string; now?: () => number; profiles?: ProfileLookup; log?: ProgressLog } = {}) {
  const progress = log ?? new ProgressLog({ dataDir, now });
  current = progress;
  const handler = (req: IncomingMessage, res: ServerResponse): boolean => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname !== '/api/progress' && !url.pathname.startsWith('/api/progress/')) return false;
    const route = url.pathname.slice('/api/progress/'.length);
    if (route !== 'me' && route !== 'leaderboard') { json(res, 404, { error: 'Ruta desconocida.' }); return true; }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.setHeader('Allow', 'GET'); json(res, 405, { error: 'Método no permitido.' }); return true; }
    const week = isoWeek(progress.now());
    // Las cuentas del modo libre NO aparecen aquí (ni por nombre ni por puntos): tienen su propio ranking opcional.
    const table = standings(progress, week, (p) => !isAccountProfile(p) && !p.startsWith('guest_'));
    if (route === 'leaderboard') {
      json(res, 200, { week, entries: table.slice(0, 10).map(({ profile, points, rank }): LeaderboardEntry => ({ rank, name: displayName(profiles, profile), points })) });
      return true;
    }
    const id = url.searchParams.get('profile') ?? '';
    if (!PROFILE_RE.test(id) || isAccountProfile(id) || id.startsWith('guest_')) { json(res, 400, { error: 'Perfil no válido.' }); return true; }
    const s = progress.summary(id);
    const who = profiles(id);
    const known = !!who || progress.events.some((e) => e.profile === id);
    json(res, 200, {
      known, name: who?.name ?? '', code: who?.code ?? '', week: s.week, weekPoints: s.weekPoints,
      rank: table.find((r) => r.profile === id)?.rank ?? null, players: table.length,
      streak: s.streak, history: s.history, topics: progress.topics(id), recommended: progress.recommended(id),
    });
    return true;
  };
  return Object.assign(handler, { log: progress });
}

// ───────────── modelo del profesor (puro; sin ruta todavía) ─────────────
export interface ClassSession {
  key: string; day: string; room: string | null; sources: ProgressSource[];
  answers: number; correct: number; accuracy: number | null; points: number;
  topics: Record<string, { attempts: number; correct: number }>;
}

/** Agrupa eventos en sesiones: misma sala (room) + mismo día de Madrid. Sin sala = práctica libre de ese día. */
export function groupSessions(events: readonly ProgressEvent[]): ClassSession[] {
  const map = new Map<string, ClassSession>();
  for (const e of [...events].sort((a, b) => a.at - b.at)) {
    const day = madridDay(e.at), room = e.room ?? null, key = `${day}|${room ?? ''}`;
    let s = map.get(key);
    if (!s) map.set(key, s = { key, day, room, sources: [], answers: 0, correct: 0, accuracy: null, points: 0, topics: {} });
    if (!s.sources.includes(e.source)) s.sources.push(e.source);
    s.points += e.points;
    if (e.kind === 'answer' && typeof e.ok === 'boolean') {
      s.answers++; if (e.ok) s.correct++;
      if (e.topic) { const t = (s.topics[e.topic] ??= { attempts: 0, correct: 0 }); t.attempts++; if (e.ok) t.correct++; }
    }
  }
  for (const s of map.values()) s.accuracy = s.answers ? s.correct / s.answers : null;
  return [...map.values()];
}

export interface Prediction {
  sessions: number;
  predictedAccuracy: number | null;
  confidence: 'low' | 'medium' | 'high';
  participation: { trend: 'up' | 'flat' | 'down'; expectedAnswers: number };
  riskTopics: { topic: string; predicted: number; attempts: number }[];
}

const EMA_ALPHA = 0.5;
const ema = (xs: number[]) => xs.reduce<number | null>((acc, x) => (acc === null ? x : EMA_ALPHA * x + (1 - EMA_ALPHA) * acc), null);
const round2 = (x: number) => Math.round(x * 100) / 100;
function slope(ys: number[]): number {
  const n = ys.length; if (n < 2) return 0;
  const mx = (n - 1) / 2, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  ys.forEach((y, x) => { num += (x - mx) * (y - my); den += (x - mx) ** 2; });
  return num / den;
}

/**
 * Predicción transparente para la próxima clase de UN alumno (pasa solo sus eventos):
 *  - predictedAccuracy: media móvil exponencial (α=0.5) de la precisión por sesión, en orden cronológico.
 *  - riskTopics: EMA por tema sobre las sesiones donde apareció; riesgo si < 0.6 con ≥ 2 intentos (peor primero).
 *  - participation.trend: pendiente lineal de respuestas por sesión (últimas 4) relativa a la media: ±15 %.
 *  - participation.expectedAnswers: EMA de respuestas por sesión + media pendiente (redondeado, ≥ 0).
 *  - confidence: low (< 2 sesiones o < 10 respuestas), high (≥ 4 sesiones y ≥ 30 respuestas), si no medium.
 */
export function predictNext(events: readonly ProgressEvent[]): Prediction {
  const sessions = groupSessions(events).filter((s) => s.answers > 0);
  const total = sessions.reduce((a, s) => a + s.answers, 0);
  const acc = ema(sessions.map((s) => s.accuracy!));
  const counts = sessions.map((s) => s.answers);
  const recent = counts.slice(-4), mean = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
  const sl = slope(recent), rel = mean ? sl / mean : 0;
  const trend = rel <= -0.15 ? 'down' : rel >= 0.15 ? 'up' : 'flat';
  const expectedAnswers = sessions.length ? Math.max(0, Math.round((ema(counts) ?? 0) + sl / 2)) : 0;
  const perTopic = new Map<string, { series: number[]; attempts: number }>();
  for (const s of sessions) for (const [topic, t] of Object.entries(s.topics)) {
    const x = perTopic.get(topic) ?? { series: [], attempts: 0 };
    x.series.push(t.correct / t.attempts); x.attempts += t.attempts; perTopic.set(topic, x);
  }
  const riskTopics = [...perTopic].map(([topic, x]) => ({ topic, predicted: round2(ema(x.series)!), attempts: x.attempts }))
    .filter((r) => r.attempts >= 2 && r.predicted < 0.6).sort((a, b) => a.predicted - b.predicted);
  const confidence = sessions.length < 2 || total < 10 ? 'low' : sessions.length >= 4 && total >= 30 ? 'high' : 'medium';
  return { sessions: sessions.length, predictedAccuracy: acc === null ? null : round2(acc), confidence, participation: { trend, expectedAnswers }, riskTopics };
}
