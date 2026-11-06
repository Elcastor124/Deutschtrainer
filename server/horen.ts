// Hörverstehen 001 — authoritative class rooms (teacher + students on their own devices) and solo practice.
//  - The SERVER owns the timeline: start/pause/resume/next/prev/finish come from the teacher; every client derives
//    the current step from (step, stepElapsedMs, serverNow), so both students hear the same audio at the same moment.
//  - Answer keys, transcripts and evidence never leave the server until the exam is finished (room) or the student
//    finishes (practice). Practice correction is server-side too: the bundle contains no solutions.
//  - Persistence: DATA_DIR/horen.json (atomic write). Room sessions are not accounts.
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join, resolve } from 'node:path';
import type { Guard } from './security.ts';
import { roomsToExpire } from './room-ttl.ts';
import { buildTimeline, scoreOf, type HorenAction, type HorenAudioInfo, type HorenReviewItem, type HorenStep, type HorenView } from '../shared/horen.ts';
import { HOREN_EXAM, HOREN_SECRET } from './horen/content-001.ts';

const AUDIO_DIR = join(import.meta.dirname, 'horen', 'audio');
interface Player { id: string; name: string; token: string; lastSeen: number; answers: Record<string, string> }
interface Room {
  code: string; teacherToken: string; owner?: string; lastActive: number; players: Player[];
  status: 'lobby' | 'running' | 'paused' | 'finished'; step: number; stepElapsed: number; tick: number;
  minutes: Record<number, number>; finishedAt?: number;
}
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

/** Real decoded durations from the generated manifest. Missing audio → empty map (the UI says so; never faked). */
export function loadAudioManifest(dir = AUDIO_DIR): HorenAudioInfo[] {
  try {
    const m = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as { assets: { id: string; duration: number }[] };
    return m.assets.filter((a) => existsSync(join(dir, `${a.id}.mp3`))).map((a) => ({ id: a.id, duration: a.duration }));
  } catch { return []; }
}

const questions = HOREN_EXAM.parts.flatMap((p) => p.questions);
const AUDIO_IDS = new Set([...HOREN_EXAM.parts.map((p) => p.audioId), ...HOREN_EXAM.parts.map((p) => `i${p.n}`)]);

export function reviewOf(answers: Record<string, string>): HorenReviewItem[] {
  return questions.map((q) => ({ id: q.id, number: q.number, own: answers[q.id] ?? null, key: HOREN_SECRET.answers[q.id], ok: answers[q.id] === HOREN_SECRET.answers[q.id], evidence: HOREN_SECRET.evidence[q.id] }));
}

export function createHorenHandler({ dataDir = process.env.DATA_DIR || resolve(import.meta.dirname, '../data'), now = Date.now, guard, audioDir = AUDIO_DIR, ttlMs = 24 * 3_600_000 }: { dataDir?: string; now?: () => number; guard?: Guard; audioDir?: string; ttlMs?: number } = {}) {
  const file = join(dataDir, 'horen.json');
  const rooms: Record<string, Room> = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')).rooms ?? {}) : {};
  const save = () => { mkdirSync(dataDir, { recursive: true }); const tmp = `${file}.${randomUUID()}.tmp`; writeFileSync(tmp, JSON.stringify({ version: 1, rooms }), { mode: 0o600 }); renameSync(tmp, file); };
  const audio = () => loadAudioManifest(audioDir);
  const durations = () => Object.fromEntries(audio().map((a) => [a.id, a.duration]));
  const examFor = (room: Room) => ({ ...HOREN_EXAM, parts: HOREN_EXAM.parts.map((p, i) => ({ ...p, minutes: room.minutes[i] ?? p.minutes })) });
  const timeline = (room: Room) => buildTimeline(examFor(room), durations());

  /** Advance the authoritative clock; silent/audio steps roll over automatically while running. */
  function settle(room: Room) {
    const t = now(), dt = Math.max(0, t - room.tick); room.tick = t;
    if (room.status !== 'running') return;
    room.stepElapsed += dt;
    const { steps } = timeline(room);
    while (room.step < steps.length - 1 && room.stepElapsed >= steps[room.step].ms) {
      room.stepElapsed -= steps[room.step].ms; room.step++;
    }
    if (steps[room.step].kind === 'done') finish(room);
  }
  function finish(room: Room) { room.status = 'finished'; room.step = timeline(room).steps.length - 1; room.stepElapsed = 0; room.finishedAt ??= now(); }
  function roomFor(code: unknown): Room { if (typeof code !== 'string' || !/^[A-F0-9]{6}$/.test(code)) fail(400, 'Código no válido.'); return rooms[code as string] || fail(404, 'Sala desconocida.'); }
  function auth(req: IncomingMessage, room: Room): { role: 'teacher' | 'player'; player?: Player } {
    const t = req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]+)$/)?.[1]; if (!t) fail(401, 'Sesión requerida.');
    room.lastActive = now();
    if (t === room.teacherToken) return { role: 'teacher' };
    const p = room.players.find((x) => x.token === t); if (!p) fail(401, 'Sesión no válida.');
    p!.lastSeen = now(); return { role: 'player', player: p };
  }
  function validAnswer(questionId: unknown, value: unknown) {
    const q = questions.find((x) => x.id === questionId); if (!q) fail(400, 'Pregunta desconocida.');
    if (value !== null && (typeof value !== 'string' || !q!.options.some((o) => o.id === value))) fail(400, 'Respuesta no válida.');
    return q!;
  }
  function action(room: Room, who: ReturnType<typeof auth>, a: HorenAction) {
    const teacherOnly = ['start', 'pause', 'resume', 'next', 'prev', 'finish', 'adjust'];
    if (teacherOnly.includes(a.type) && who.role !== 'teacher') fail(403, 'Solo el profesor.');
    const { steps } = timeline(room);
    switch (a.type) {
      case 'start': if (room.status !== 'lobby') fail(409, 'El examen ya ha empezado.'); room.status = 'running'; room.step = 0; room.stepElapsed = 0; return;
      case 'pause': if (room.status === 'running') room.status = 'paused'; return;
      case 'resume': if (room.status === 'paused') room.status = 'running'; return;
      case 'next': if (room.status === 'lobby' || room.status === 'finished') fail(409, 'El examen no está en curso.'); room.step = Math.min(steps.length - 1, room.step + 1); room.stepElapsed = 0; if (steps[room.step].kind === 'done') finish(room); return;
      case 'prev': if (room.status === 'lobby' || room.status === 'finished') fail(409, 'El examen no está en curso.'); room.step = Math.max(0, room.step - 1); room.stepElapsed = 0; return;
      case 'finish': finish(room); return;
      case 'adjust': {
        if (room.status !== 'lobby') fail(409, 'Los tiempos se ajustan antes de empezar.');
        if (!Number.isInteger(a.part) || a.part < 0 || a.part >= HOREN_EXAM.parts.length || !Number.isInteger(a.minutes) || a.minutes < 3 || a.minutes > 30) fail(400, 'Ajuste no válido (3–30 min).');
        room.minutes[a.part] = a.minutes; return;
      }
      case 'answer': {
        if (!who.player) fail(403, 'Solo el alumno.');
        if (room.status !== 'running') fail(409, room.status === 'paused' ? 'Examen en pausa.' : room.status === 'finished' ? 'Examen terminado: respuestas bloqueadas.' : 'El examen todavía no ha empezado.');
        validAnswer(a.questionId, a.value);
        if (a.value === null) delete who.player!.answers[a.questionId]; else who.player!.answers[a.questionId] = a.value;
        return;
      }
      default: fail(400, 'Acción desconocida.');
    }
  }
  function view(room: Room, who: ReturnType<typeof auth>): HorenView {
    const { steps, warnings } = timeline(room); const done = room.status === 'finished';
    const exam = examFor(room);
    return {
      code: room.code, role: who.role, ...(who.player ? { me: who.player.id } : {}), exam,
      status: room.status, step: room.step, stepElapsedMs: room.stepElapsed, serverNow: now(), steps, warnings, audio: audio(),
      players: room.players.map((p) => ({
        id: p.id, name: p.name, connected: now() - p.lastSeen < 15000, answered: Object.keys(p.answers).length, finished: done,
        ...(who.role === 'teacher' ? { answers: p.answers, score: scoreOf(exam, p.answers, HOREN_SECRET.answers) } : {}),
      })),
      ...(who.player ? { ownAnswers: who.player.answers } : {}),
      ...(done && who.player ? { ownScore: scoreOf(exam, who.player.answers, HOREN_SECRET.answers), review: reviewOf(who.player.answers) } : {}),
      // Teacher sees transcripts only on the private panel AFTER the exam (projected screens must not leak them).
      ...(done ? { transcripts: HOREN_SECRET.scripts } : {}),
      ...(done && who.role === 'teacher' ? { key: HOREN_SECRET.answers, evidence: HOREN_SECRET.evidence } : {}),
    };
  }
  function streamAudio(res: ServerResponse, id: string) {
    const f = join(audioDir, `${id}.mp3`);
    if (!AUDIO_IDS.has(id) || !existsSync(f)) fail(404, 'Audio no disponible.');
    const bytes = readFileSync(f);
    res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': bytes.length, 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' }); res.end(bytes);
  }

  async function dispatch(req: IncomingMessage, res: ServerResponse, url: URL) {
    const route = url.pathname.slice('/api/horen/'.length);
    const methods: Record<string, string> = { exam: 'GET', audio: 'GET', 'practice/check': 'POST', create: 'POST', join: 'POST', state: 'GET', action: 'POST' };
    if (!Object.hasOwn(methods, route)) fail(404, 'Ruta desconocida.');
    if (req.method !== methods[route]) { res.setHeader('Allow', methods[route]); fail(405, 'Método no permitido.'); }
    // Public exam (questions only) + real audio durations; used by practice mode and the lobby.
    if (route === 'exam') { const a = audio(); return json(res, 200, { exam: HOREN_EXAM, audio: a, ...buildTimeline(HOREN_EXAM, Object.fromEntries(a.map((x) => [x.id, x.duration]))) }); }
    if (route === 'audio') return streamAudio(res, url.searchParams.get('id') || '');
    if (route === 'practice/check') {
      // Practice is graded only when the student finishes: whole review at once, never per question mid-exam.
      const input = await body(req); const raw = input.answers && typeof input.answers === 'object' && !Array.isArray(input.answers) ? input.answers as Record<string, unknown> : {};
      const answers: Record<string, string> = {};
      for (const q of questions) { const v = raw[q.id]; if (typeof v === 'string' && q.options.some((o) => o.id === v)) answers[q.id] = v; }
      if (input.finish !== true) fail(400, 'La corrección solo se hace al terminar.');
      return json(res, 200, { score: scoreOf(HOREN_EXAM, answers, HOREN_SECRET.answers), review: reviewOf(answers), transcripts: HOREN_SECRET.scripts });
    }
    if (route === 'create') {
      const adm = guard?.admitCreate('road', guard.ip(req), Object.keys(rooms).length, req.headers['x-teacher-key'], guard.teacherFromRequest(req)); if (adm && !adm.ok) fail(adm.status, adm.error);
      let code: string; do { code = randomBytes(3).toString('hex').toUpperCase(); } while (rooms[code]);
      rooms[code] = { code, teacherToken: token(), players: [], status: 'lobby', step: 0, stepElapsed: 0, tick: now(), lastActive: now(), minutes: {}, ...(adm?.ok && adm.owner ? { owner: adm.owner } : {}) };
      save(); return json(res, 200, { code, token: rooms[code].teacherToken, role: 'teacher' });
    }
    if (route === 'join') {
      const input = await body(req), room = roomFor(input.code);
      if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 40) fail(400, 'Nombre no válido.');
      if (room.status === 'finished') fail(409, 'Este examen ya ha terminado.');
      if (room.players.length >= 30) fail(409, 'Sala completa.');
      const p: Player = { id: randomUUID(), name: (input.name as string).trim(), token: token(), lastSeen: now(), answers: {} };
      room.players.push(p); save(); return json(res, 200, { code: room.code, token: p.token, role: 'player', pid: p.id });
    }
    if (route === 'state') { const room = roomFor(url.searchParams.get('code')), who = auth(req, room); settle(room); save(); return json(res, 200, view(room, who)); }
    if (route === 'action') {
      const input = await body(req), room = roomFor(input.code), who = auth(req, room);
      if (!input.action || typeof input.action !== 'object') fail(400, 'Acción no válida.');
      settle(room); action(room, who, input.action as HorenAction); settle(room); save(); return json(res, 200, view(room, who));
    }
    fail(404, 'Ruta desconocida.');
  }
  function sweep(at = now()): number {
    const gone = roomsToExpire(rooms, (r) => r.lastActive, (r, t) => { r.lastActive = t; }, at, ttlMs);
    for (const code of gone) delete rooms[code];
    if (gone.length) save();
    return gone.length;
  }
  const handler = function horenHandler(req: IncomingMessage, res: ServerResponse): boolean {
    const url = new URL(req.url || '/', 'http://horen.local');
    if (!url.pathname.startsWith('/api/horen/')) return false;
    const ip = guard?.ip(req);
    const lookup = /\/(join|state|action)$/.test(url.pathname);
    if (guard && ip && lookup && guard.roomLookupBlocked(ip)) { json(res, 429, { error: 'Demasiados intentos con códigos de sala. Espera unos minutos.' }); return true; }
    void dispatch(req, res, url).catch((e: unknown) => {
      if (guard && ip && e instanceof ApiError && e.status === 404 && lookup) guard.roomMiss(ip);
      if (!(e instanceof ApiError)) console.error('[horen]', e);
      json(res, e instanceof ApiError ? e.status : 500, { error: e instanceof ApiError ? e.message : 'No se pudo procesar la sala.' });
    });
    return true;
  };
  return Object.assign(handler, { sweep });
}
export type { HorenStep };
