import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join, resolve } from 'node:path';
import type { Guard } from './security.ts';
import { roomsToExpire } from './room-ttl.ts';
import type { RoadActivity, RoadRole, RoadSection, RoadView, RoadSecret, RoadScore } from '../shared/road.ts';
import { ROAD_LEVEL, ROAD_SECRET } from './road-content.ts';

const token = () => randomBytes(32).toString('base64url');
const flags = (): Record<RoadActivity, boolean> => ({ lesen: false, diktat: false, horen: false });
interface Player { id: string; name: string; token: string; lastSeen: number; answers: Record<string,string>; dictation: string; submitted: Record<RoadActivity,boolean>; listens: Record<string,number>; attempts?: Record<string,{audioId:string; started:boolean}>; pendingAudio?: Record<string,string>; listenLimits?: Record<string,number>; rubric?: boolean[] }
interface Room { code: string; teacherToken: string; owner?: string; lastActive?: number; projectors: string[]; players: Player[]; section: RoadSection; paused: boolean; locked: Record<RoadActivity,boolean>; released: Record<RoadActivity,boolean>; exposed: Record<RoadActivity,boolean>; elapsed: number; sectionTimes: Record<string,number>; tick: number; cue?: {serial:number; audioId:string} }
class ApiError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status; } }
function fail(status: number, message: string): never { throw new ApiError(status, message); }
function json(res: ServerResponse, status: number, value: unknown) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(value)); }
async function body(req: IncomingMessage): Promise<Record<string,unknown>> {
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of req) { const b = Buffer.from(chunk); size += b.length; if (size > 65536) fail(413, 'Petición demasiado grande.'); chunks.push(b); }
  let value: unknown; try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail(400, 'JSON no válido.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400, 'Se esperaba un objeto.');
  return value as Record<string,unknown>;
}

/**
 * Authoritative room sessions, not accounts: profileId never establishes identity.
 * Current-room results only; no cross-device/account history is inferred from names/codes.
 * Timers are advisory wall-clock totals, paused intervals excluded, including across restart.
 * Explicit solution release is irreversible for assessment writes (hiding solutions does not
 * erase students' knowledge). Entering Ergebnisse likewise seals all original work before
 * exposing own scores. Reopen works only before exposure; it never overwrites released work.
 * A listen reserves one logical attempt (normally two per audio). Pending attempts are
 * persisted per player/audio, including across tab changes and restart. Recovery reissues
 * a 60s single-use media token, never another charge. Authenticated audioStarted retires
 * the attempt idempotently after play() succeeds; old media tokens are invalidated.
 * Only teachers may restore one extra attempt for a particular player/audio.
 * Two starts are an educational restriction, not DRM: a downloaded/recorded blob can be replayed
 * outside the app. This must not be advertised as high-stakes anti-cheating/proctoring.
 */
export function createRoadHandler({ dataDir = process.env.DATA_DIR || resolve(import.meta.dirname, '../data'), now = Date.now, guard, ttlMs = Number(process.env.ROAD_ROOM_TTL_HOURS || 24) * 3_600_000 }: { dataDir?: string; now?: () => number; guard?: Guard; ttlMs?: number } = {}) {
  interface Grant { audioId: string; code: string; owner: string; expires: number; attemptId: string; playerId?: string }
  const grants = new Map<string, Grant>();
  const latest = new Map<string, {id:string; url:string}>();
  function invalidate(owner: string, attemptId: string) {
    for (const [key,g] of grants) if (g.owner === owner && g.attemptId === attemptId) grants.delete(key);
    if (latest.get(owner)?.id === attemptId) latest.delete(owner);
  }
  function settle(room: Room) { const t = now(), dt = Math.max(0, t - room.tick); if (!room.paused) { room.elapsed += dt; room.sectionTimes[room.section] = (room.sectionTimes[room.section] || 0) + dt; } room.tick = t; }
  const file = join(dataDir, 'road.json');
  const rooms: Record<string,Room> = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).rooms : {};
  function save() { mkdirSync(dataDir, { recursive: true }); const tmp = `${file}.${randomUUID()}.tmp`; writeFileSync(tmp, JSON.stringify({ version: 1, rooms }), { mode: 0o600 }); renameSync(tmp, file); }
  function roomFor(code: unknown): Room { if (typeof code !== 'string' || !/^[A-F0-9]{6}$/.test(code)) fail(400, 'Código no válido.'); return rooms[code] || fail(404, 'Sala desconocida.'); }
  /** Solo una petición autenticada cuenta como actividad (un token inválido no mantiene viva una sala). */
  function auth(req: IncomingMessage, room: Room): { role: RoadRole; player?: Player } { const who = authenticated(req, room); room.lastActive = now(); return who; }
  function authenticated(req: IncomingMessage, room: Room): { role: RoadRole; player?: Player } {
    const t = req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]+)$/)?.[1];
    if (!t) fail(401, 'Sesión requerida.');
    if (t === room.teacherToken) return { role: 'teacher' };
    if (room.projectors.includes(t)) return { role: 'projector' };
    const player = room.players.find(p => p.token === t); if (!player) fail(401, 'Sesión no válida.'); player.lastSeen = now(); return { role: 'player', player };
  }
  const reading = ROAD_LEVEL.reading.flatMap(p => p.questions);
  const listening = ROAD_LEVEL.listening.flatMap(p => p.questions);
  const questions = [...reading, ...listening];
  const activities = ['lesen', 'diktat', 'horen'] as const;
  const sections = ['intro', 'lesen', 'korrektur', 'diktat', 'horen', 'ergebnisse'] as const;
  function activity(value: unknown): RoadActivity { if (!activities.includes(value as RoadActivity)) fail(400, 'Actividad desconocida.'); return value as RoadActivity; }
  function writable(room: Room, p: Player, a: RoadActivity) {
    if (room.paused || room.section !== a || room.locked[a] || room.exposed[a] || p.submitted[a]) fail(409, 'Actividad cerrada o en pausa.');
  }
  function action(room: Room, who: ReturnType<typeof auth>, value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400, 'Acción no válida.');
    const a = value as Record<string,unknown>;
    const teacherActions = ['section', 'pause', 'resume', 'lock', 'release', 'reopen', 'review', 'cue', 'restoreListen'];
    if (teacherActions.includes(a.type as string) && who.role !== 'teacher') fail(403, 'Solo el profesor.');
    if (a.type === 'section') { if (!sections.includes(a.section as RoadSection)) fail(400, 'Sección desconocida.'); room.section = a.section as RoadSection; if (room.section === 'ergebnisse') room.exposed = { lesen: true, horen: true, diktat: true }; return; }
    if (a.type === 'pause' || a.type === 'resume') { room.paused = a.type === 'pause'; return; }
    if (a.type === 'lock' || a.type === 'release') {
      const act = activity(a.activity), field = a.type === 'lock' ? 'locked' : 'released';
      const flag = a[field]; if (typeof flag !== 'boolean') fail(400, 'Se esperaba booleano.');
      room[field][act] = flag;
      if (a.type === 'release' && flag) room.exposed[act] = true;
      return;
    }
    if (a.type === 'listen' || a.type === 'cue') {
      if (who.role === 'projector') fail(403, 'Proyección de solo lectura.');
      if (typeof a.audioId !== 'string') fail(400, 'Audio desconocido.');
      const audioId = a.audioId;
      const listeningAudio = ROAD_LEVEL.listening.some(p => p.audio.id === audioId);
      const dictationAudio = audioId === 'diktat' || ROAD_SECRET.dictationFragments.some((_,i) => audioId === `diktat-${i + 1}`);
      if (!listeningAudio && !dictationAudio) fail(400, 'Audio desconocido.');
      if (who.player && dictationAudio) fail(403, 'Dictado: reproducción del profesor.');
      if (room.paused) fail(409, 'Actividad en pausa.');
      if (who.player) writable(room, who.player, 'horen');
      if (a.type === 'cue') { room.cue = {serial:(room.cue?.serial || 0) + 1, audioId}; return; }
      if (!existsSync(join(import.meta.dirname, 'road-audio', `${audioId}.mp3`))) fail(503, 'Audio no disponible.');
      for (const [key,g] of grants) if (g.expires <= now()) grants.delete(key);
      const owner = who.player?.token || room.teacherToken, mediaToken = token();
      let id: string = randomUUID();
      if (who.player) {
        const p = who.player; p.pendingAudio ??= {}; p.attempts ??= {};
        if (p.pendingAudio[audioId]) id = p.pendingAudio[audioId];
        else {
          if ((p.listens[audioId] || 0) >= (p.listenLimits?.[audioId] ?? 2)) fail(409, 'Escuchas agotadas.');
          p.listens[audioId] = (p.listens[audioId] || 0) + 1;
          p.pendingAudio[audioId] = id; p.attempts[id] = {audioId, started:false};
        }
        invalidate(owner,id);
      } else {
        const previous = latest.get(owner); if (previous) invalidate(owner,previous.id);
      }
      grants.set(mediaToken,{ audioId, code: room.code, owner, attemptId:id, expires: now() + 60000, ...(who.player ? {playerId:who.player.id} : {}) });
      const audioGrant = {id, url: `/api/road/audio?grant=${mediaToken}`}; latest.set(owner,audioGrant);
      return audioGrant;
    }
    if (a.type === 'audioStarted') {
      if (!who.player) fail(403, 'Solo el alumno.');
      const p = who.player;
      const attempt = typeof a.grantId === 'string' && p.attempts && Object.hasOwn(p.attempts,a.grantId) && p.attempts[a.grantId];
      if (!attempt) fail(404, 'Intento no emitido a esta sesión.');
      attempt.started = true;
      if (p.pendingAudio && p.pendingAudio[attempt.audioId] === a.grantId) delete p.pendingAudio[attempt.audioId];
      invalidate(p.token,a.grantId as string); return;
    }
    if (a.type === 'restoreListen') {
      if (typeof a.audioId !== 'string' || !ROAD_LEVEL.listening.some(x => x.audio.id === a.audioId)) fail(400, 'Audio desconocido.');
      const p = room.players.find(p => p.id === a.pid); if (!p) fail(404, 'Alumno desconocido.');
      p.listenLimits ??= {}; p.listenLimits[a.audioId] = (p.listenLimits[a.audioId] ?? 2) + 1; return;
    }
    if (a.type === 'review') {
      const p = room.players.find(p => p.id === a.pid); if (!p) fail(404, 'Alumno desconocido.');
      if (!Array.isArray(a.rubric) || a.rubric.length !== 10 || a.rubric.some(v => typeof v !== 'boolean')) fail(400, 'Se requieren diez marcas booleanas.');
      p.rubric = a.rubric as boolean[]; return;
    }
    if (a.type === 'reopen') {
      const act = activity(a.activity), p = room.players.find(p => p.id === a.pid);
      if (!p) fail(404, 'Alumno desconocido.');
      // Published solutions cannot be unlearned: reopening preserves the original work.
      if (room.exposed[act] || p.submitted[act]) fail(409, 'Entrega ya autocorregida; se conserva el original.');
      p.submitted[act] = false; return;
    }
    if (a.type === 'answer' || a.type === 'dictation' || a.type === 'submit') {
      if (!who.player) fail(403, 'Solo el alumno.'); const p = who.player;
      if (a.type === 'answer') {
        const q = questions.find(q => q.id === a.questionId); if (!q || typeof a.value !== 'string' || !q.options.includes(a.value)) fail(400, 'Respuesta no válida.');
        const act = reading.some(r => r.id === q.id) ? 'lesen' : 'horen'; writable(room, p, act);
        if (q.type === 'matching') {
          if (a.value === 'A' || (a.value !== '0' && reading.some(r => r.id !== q.id && r.type === 'matching' && r.options.includes(a.value as string) && p.answers[r.id] === a.value))) fail(400, 'Anuncio ya usado o reservado al ejemplo.');
        }
        p.answers[q.id] = a.value; return;
      }
      if (a.type === 'dictation') { writable(room, p, 'diktat'); if (typeof a.text !== 'string' || a.text.length > 12000) fail(400, 'Texto no válido (máximo 12000).'); p.dictation = a.text; delete p.rubric; return; }
      const act = activity(a.activity); writable(room, p, act); p.submitted[act] = true; return;
    }
    fail(400, 'Acción desconocida.');
  }
  // Auto-correction: one point per rubric element written exactly (case-sensitive, spacing tolerant).
  function autoRubric(text: string): boolean[] {
    const norm = (s: string) => ' ' + s.replace(/[.,!?;:„“"]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
    const t = norm(text); return ROAD_LEVEL.dictation.rubric.map(k => t.includes(norm(k)));
  }
  function score(p: Player): RoadScore {
    const lesen = reading.filter(q => p.answers[q.id] === ROAD_SECRET.answers[q.id]).length;
    const horen = listening.filter(q => p.answers[q.id] === ROAD_SECRET.answers[q.id]).length;
    const diktat = p.rubric ? p.rubric.filter(Boolean).length : p.submitted.diktat ? autoRubric(p.dictation).filter(Boolean).length : null;
    const total = diktat === null ? null : lesen + horen + diktat;
    return { lesen, horen, diktat, total, outOf: 50, grade: total === null ? null : total / 5, percent: total === null ? null : total * 2, pending: diktat === null };
  }
  function view(room: Room, who: ReturnType<typeof auth>): RoadView {
    const solutions: Partial<RoadSecret> = {};
    const released = who.player ? { lesen: room.released.lesen || who.player.submitted.lesen, horen: room.released.horen || who.player.submitted.horen, diktat: room.released.diktat || who.player.submitted.diktat } : room.released;
    if (who.role === 'teacher') Object.assign(solutions, ROAD_SECRET);
    else {
      const answers: Record<string,string> = {};
      if (released.lesen) for (const q of reading) answers[q.id] = ROAD_SECRET.answers[q.id];
      if (released.horen) { for (const q of listening) answers[q.id] = ROAD_SECRET.answers[q.id]; solutions.scripts = ROAD_SECRET.scripts; }
      if (Object.keys(answers).length) solutions.answers = answers;
      if (released.diktat) { solutions.dictation = ROAD_SECRET.dictation; solutions.dictationFragments = ROAD_SECRET.dictationFragments; }
    }
    const audioGrant = latest.get(who.player?.token || (who.role === 'teacher' ? room.teacherToken : ''));
    return {
      code: room.code, role: who.role,
      level: who.role === 'teacher' || released.diktat ? ROAD_LEVEL : {
        ...ROAD_LEVEL, dictation: { ...ROAD_LEVEL.dictation, rubric: [] },
      },
      section: room.section, paused: room.paused, serverNow: now(),
      elapsedMs: room.elapsed, sectionElapsedMs: room.sectionTimes[room.section] || 0,
      locked: room.locked, released, sealed: who.player ? { lesen: room.exposed.lesen || released.lesen, horen: room.exposed.horen || released.horen, diktat: room.exposed.diktat || released.diktat } : room.exposed,
      ...(room.cue ? { cue: room.cue } : {}),
      ...(audioGrant ? { audioGrant } : {}),
      ...(Object.keys(solutions).length ? { solutions } : {}),
      ...(who.player ? {
        me: who.player.id, ownAnswers: who.player.answers, ownDictation: who.player.dictation,
        ownSubmitted: who.player.submitted,
        ...(room.section === 'ergebnisse' || Object.values(who.player.submitted).some(Boolean) ? { ownScore: score(who.player) } : {}),
      } : {}),
      players: room.players.map(p => ({
        id: p.id, name: p.name, connected: now() - p.lastSeen < 20000,
        progress: {
          lesen: reading.filter(q => p.answers[q.id] !== undefined).length,
          horen: listening.filter(q => p.answers[q.id] !== undefined).length,
          diktat: p.dictation.length,
        },
        submitted: p.submitted,
        ...(who.role === 'teacher' ? {
          answers: p.answers, dictation: p.dictation, score: score(p), listens:p.listens, listenLimits:p.listenLimits || {},
          ...(p.rubric ? { rubric: p.rubric } : {}),
        } : {}),
      })),
      listens: who.player?.listens || {},
      ...(who.player ? {pendingAudio:who.player.pendingAudio || {},listenLimits:who.player.listenLimits || {}} : {}),
    };
  }
  async function dispatch(req: IncomingMessage, res: ServerResponse, url: URL) {
    const methods: Record<string,string> = { levels: 'GET', create: 'POST', join: 'POST', projector: 'POST', state: 'GET', action: 'POST', audio: 'GET' };
    const route = url.pathname.slice('/api/road/'.length);
    if (!Object.hasOwn(methods, route)) fail(404, 'Ruta desconocida.');
    if (req.method !== methods[route]) { res.setHeader('Allow', methods[route]); fail(405, 'Método no permitido.'); }
    if (route === 'audio') {
      const id = url.searchParams.get('grant') || '', grant = grants.get(id); grants.delete(id);
      if (!grant || grant.expires <= now()) fail(410, 'Permiso de audio caducado o consumido.');
      if (req.headers.range) fail(416, 'No se permiten rangos de audio.');
      const room = rooms[grant.code]; if (!room || room.paused) fail(409, 'Actividad cerrada o en pausa.');
      if (grant.playerId) { const p = room.players.find(p => p.id === grant.playerId); if (!p || p.pendingAudio?.[grant.audioId] !== grant.attemptId) fail(410, 'Intento retirado.'); writable(room, p, 'horen'); }
      const bytes = readFileSync(join(import.meta.dirname, 'road-audio', `${grant.audioId}.mp3`));
      res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': bytes.length, 'Cache-Control': 'no-store, private', 'Accept-Ranges': 'none', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' }); res.end(bytes); return;
    }
    if (route === 'levels') { const { id, version, title, schedule, maxPoints } = ROAD_LEVEL; return json(res, 200, [{ id, version, title, schedule, maxPoints }]); }
    if (route === 'create') {
      const input = await body(req); if (input.levelId !== ROAD_LEVEL.id) fail(400, 'Nivel desconocido.');
      const adm = guard?.admitCreate('road', guard.ip(req), Object.keys(rooms).length, req.headers['x-teacher-key'], guard.teacherFromRequest(req)); if (adm && !adm.ok) fail(adm.status, adm.error);
      let code: string; do { code = randomBytes(3).toString('hex').toUpperCase(); } while (rooms[code]);
      const room: Room = { code, teacherToken: token(), projectors: [], players: [], section: 'intro', paused: false, locked: flags(), released: flags(), exposed: flags(), elapsed: 0, sectionTimes: {}, tick: now(), lastActive: now(), ...(adm?.ok && adm.owner ? { owner: adm.owner } : {}) }; rooms[code] = room; save();
      return json(res, 200, { code, token: room.teacherToken, role: 'teacher' });
    }
    if (route === 'join') {
      const input = await body(req), room = roomFor(input.code);
      if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 80) fail(400, 'Nombre no válido.');
      if (room.players.length >= 30) fail(409, 'Sala completa.');
      const p: Player = { id: randomUUID(), token: token(), name: input.name.trim(), lastSeen: now(), answers: {}, dictation: '', submitted: flags(), listens: {} }; room.players.push(p); save(); return json(res, 200, { code: room.code, token: p.token, role: 'player', pid: p.id });
    }
    if (route === 'projector') {
      const input = await body(req), room = roomFor(input.code), who = auth(req, room);
      if (who.role !== 'teacher') fail(403, 'Solo el profesor.');
      const t = token(); room.projectors.push(t); save(); return json(res, 200, { code: room.code, token: t, role: 'projector' });
    }
    if (route === 'action') {
      const input = await body(req), room = roomFor(input.code), who = auth(req, room);
      settle(room); const audioGrant = action(room, who, input.action); save(); return json(res, 200, { ok: true, ...(audioGrant ? {audioGrant} : {}) });
    }
    if (route === 'state') { const room = roomFor(url.searchParams.get('code')), who = auth(req, room); settle(room); save(); return json(res, 200, view(room, who)); }
    fail(404, 'Ruta desconocida.');
  }
  /** Elimina las salas sin actividad autenticada durante `ttlMs` (y sus permisos de audio). Una sala con tráfico nunca caduca. */
  function sweep(at = now()): number {
    const gone = roomsToExpire(rooms, (r) => r.lastActive, (r, t) => { r.lastActive = t; }, at, ttlMs);
    for (const code of gone) {
      const tokens = new Set([rooms[code].teacherToken, ...rooms[code].projectors, ...rooms[code].players.map((p) => p.token)]);
      for (const [key, g] of grants) if (g.code === code) grants.delete(key);
      for (const t of tokens) latest.delete(t);
      delete rooms[code];
    }
    if (gone.length) save();
    return gone.length;
  }
  const handler = function roadHandler(req: IncomingMessage, res: ServerResponse): boolean {
    const url = new URL(req.url || '/', 'http://road.local');
    if (url.pathname !== '/api/road' && !url.pathname.startsWith('/api/road/')) return false;
    const ip = guard?.ip(req);
    const lookup = !/\/(create|levels|audio)$/.test(url.pathname);
    if (guard && ip && lookup && guard.roomLookupBlocked(ip)) { json(res, 429, { error: 'Demasiados intentos con códigos de sala. Espera unos minutos.' }); return true; }
    void dispatch(req, res, url).catch((e: unknown) => {
      if (guard && ip && e instanceof ApiError && e.status === 404) guard.roomMiss(ip);
      json(res, e instanceof ApiError ? e.status : 500, { error: e instanceof ApiError ? e.message : 'No se pudo procesar o guardar la sala.' });
    }); return true;
  };
  return Object.assign(handler, { sweep });
}
