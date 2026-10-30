import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join, resolve } from 'node:path';
import { BOXING_MOVES, type BoxingMove, type BoxingFighter, type BoxingPhase, type BoxingQuestion, type BoxingResolution, type BoxingView } from '../shared/boxing.ts';
import { BOXING_BANK } from './boxing-bank.ts';
import type { Guard } from './security.ts';
import { roomsToExpire } from './room-ttl.ts';

const DECK_TOPICS = ['Akkusativ', 'Dativ', 'Präpositionen', 'Pronomen', 'Wo/Wohin'];
function shuffled<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) { const j = randomInt(i + 1); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
// Mazo equilibrado: rondas en las que cada tema de casos aparece una vez, en
// orden aleatorio. Así ningún tema sale más de dos veces seguidas y no hay repetidas.
function buildDeck(size: number): BoxingQuestion[] {
  const buckets = new Map(DECK_TOPICS.map((t) => [t, shuffled(BOXING_BANK.filter((q) => q.topic === t))]));
  const deck: BoxingQuestion[] = [];
  while (deck.length < size && [...buckets.values()].some((b) => b.length)) {
    for (const t of shuffled(DECK_TOPICS)) {
      const q = buckets.get(t)!.pop();
      if (q && deck.length < size) deck.push(q);
    }
  }
  return deck;
}

interface Fighter extends Omit<BoxingFighter, 'connected' | 'answered' | 'lockedMove'> {
  token: string;
  lastSeen: number;
  answer?: number;
  answerCorrect?: boolean;
  move?: BoxingMove | 'recover';
}
interface Room {
  code: string;
  teacherToken: string;
  owner?: string;
  lastActive?: number;
  phase: BoxingPhase;
  exchange: number;
  maxExchanges: number;
  paused: boolean;
  fighters: Fighter[];
  deck?: BoxingQuestion[];
  result?: BoxingResolution;
  winner?: string;
}
class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
function fail(status: number, message: string): never { throw new ApiError(status, message); }
function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(body));
}
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk); length += buffer.length;
    if (length > 32_768) fail(413, 'La petición es demasiado grande.');
    chunks.push(buffer);
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) fail(400, 'Se esperaba un objeto JSON.');
    return parsed as Record<string, unknown>;
  } catch { return fail(400, 'JSON no válido.'); }
}

/** Mount before the existing HTTP routes. Returns synchronously, even for POSTs. */
export function createBoxingHandler({ dataDir = process.env.DATA_DIR || resolve(import.meta.dirname, '../data'), now = Date.now, guard, ttlMs = Number(process.env.BOXING_ROOM_TTL_HOURS || 24) * 3_600_000 }: { dataDir?: string; now?: () => number; guard?: Guard; ttlMs?: number } = {}) {
  const file = join(dataDir, 'boxing.json');
  const rooms: Record<string, Room> = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).rooms : {};
  function save() {
    mkdirSync(dataDir, { recursive: true });
    const temporary = `${file}.${randomUUID()}.tmp`;
    writeFileSync(temporary, JSON.stringify({ version: 1, rooms }), { mode: 0o600 });
    renameSync(temporary, file);
  }
  function roomFor(value: unknown) {
    if (typeof value !== 'string' || !/^[A-Z2-9]{4}$/.test(value)) fail(400, 'Código de sala no válido.');
    return rooms[value] || fail(404, 'No existe esa sala.');
  }
  /** Solo una petición autenticada cuenta como actividad (un token inválido no mantiene viva una sala). */
  function authenticate(req: IncomingMessage, room: Room) { const who = authenticated(req, room); room.lastActive = now(); return who; }
  function authenticated(req: IncomingMessage, room: Room) {
    const token = req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]+)$/)?.[1];
    if (!token) fail(401, 'Falta una sesión válida.');
    if (token === room.teacherToken) return undefined;
    const fighter = room.fighters.find((f) => f.token === token);
    if (!fighter) fail(401, 'Sesión no válida.');
    fighter.lastSeen = Date.now();
    save();
    return fighter;
  }
  function view(room: Room, me?: Fighter): BoxingView {
    const q = room.deck?.[room.exchange - 1];
    return {
      code: room.code, phase: room.phase, exchange: room.exchange, maxExchanges: room.maxExchanges, paused: room.paused,
      role: me ? 'player' : 'teacher', ...(me ? { me: me.id } : {}),
      ...(q ? { question: { id: q.id, prompt: q.prompt, options: q.options, topic: q.topic } } : {}),
      ...(me?.answer !== undefined ? { ownAnswer: me.answer, ownCorrect: me.answerCorrect } : {}),
      ...(me?.move && me.move !== 'recover' ? { ownMove: me.move } : {}),
      ...(room.result ? { result: room.result } : {}),
      ...(room.winner ? { winner: room.winner } : {}),
      fighters: room.fighters.map((f) => ({ id: f.id, name: f.name, hp: f.hp, stamina: f.stamina,
        correct: f.correct, wrong: f.wrong, damage: f.damage, connected: Date.now() - f.lastSeen < 20_000,
        answered: f.answerCorrect !== undefined, lockedMove: f.move !== undefined })),
    };
  }
  function resolveExchange(room: Room) {
    const q = room.deck![room.exchange - 1];
    const power = { jab: 8, cross: 12, hook: 16, guard: 0, dodge: 0, recover: 0 };
    const outcomes = room.fighters.map((f, i) => {
      const opponent = room.fighters[1 - i];
      const incoming = power[opponent.move!];
      const blocked = f.move === 'guard' && incoming > 0;
      const dodged = f.move === 'dodge' && (opponent.move === 'cross' || opponent.move === 'hook');
      const damageTaken = Math.min(f.hp, dodged ? 0 : blocked ? incoming / 4 : incoming);
      return { id: f.id, move: f.move!, correct: f.answerCorrect === true, damageDealt: 0, damageTaken, blocked, dodged };
    });
    for (let i = 0; i < room.fighters.length; i++) {
      const f = room.fighters[i];
      const cost = BOXING_MOVES.find((m) => m.id === f.move)?.cost ?? 0;
      outcomes[i].damageDealt = outcomes[1 - i].damageTaken;
      f.hp -= outcomes[i].damageTaken; f.damage += outcomes[i].damageDealt;
      f.stamina = Math.min(5, f.stamina - cost + 1 + (f.move === 'guard' ? 1 : 0));
    }
    room.result = { exchange: room.exchange, fighters: outcomes, explanation: q.explanation, answer: q.options[q.answer] };
    room.phase = 'result';
    if (room.exchange >= room.maxExchanges || room.fighters.some((f) => f.hp === 0)) {
      room.phase = 'finished';
      const [a, b] = room.fighters;
      room.winner = a.hp === 0 && b.hp === 0 ? 'draw' : a.hp !== b.hp ? (a.hp > b.hp ? a.id : b.id) : a.correct !== b.correct ? (a.correct > b.correct ? a.id : b.id) : 'draw';
    }
  }
  function action(room: Room, me: Fighter | undefined, input: unknown) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) fail(400, 'Acción no válida.');
    const a = input as Record<string, unknown>;
    if (a.type === 'pause' || a.type === 'resume') {
      if (me) fail(403, 'Solo el profesor puede pausar o reanudar.');
      room.paused = a.type === 'pause';
      return;
    }
    if (a.type === 'restart') {
      if (me) fail(403, 'Solo el profesor puede reiniciar.');
      room.phase = 'lobby'; room.exchange = 0; room.paused = false;
      delete room.deck; delete room.result; delete room.winner;
      for (const f of room.fighters) {
        f.hp = 100; f.stamina = 4; f.correct = 0; f.wrong = 0; f.damage = 0;
        delete f.answer; delete f.answerCorrect; delete f.move;
      }
      return;
    }
    if (a.type === 'reveal') {
      if (me) fail(403, 'Solo el profesor puede revelar.');
      if (room.phase !== 'question' && room.phase !== 'action') fail(409, 'No hay intercambio pendiente.');
      for (const f of room.fighters) {
        if (f.answerCorrect === undefined) { f.answerCorrect = false; f.wrong++; }
        f.move ??= 'recover';
      }
      resolveExchange(room);
      return;
    }
    if (room.paused) fail(409, 'La partida está en pausa.');
    if (a.type === 'next') {
      if (me) fail(403, 'Solo el profesor puede avanzar.');
      if (room.phase !== 'result') fail(409, 'Primero termina el intercambio.');
      room.exchange++; room.phase = 'question'; delete room.result;
      for (const f of room.fighters) { delete f.answer; delete f.answerCorrect; delete f.move; }
      return;
    }
    if (a.type === 'start') {
      if (me) fail(403, 'Solo el profesor puede iniciar.');
      if (room.phase !== 'lobby' || room.fighters.length !== 2) fail(409, 'Espera a los dos boxeadores en el vestíbulo.');
      room.deck = buildDeck(room.maxExchanges);
      room.phase = 'question'; room.exchange = 1;
      return;
    }
    if (a.type === 'answer') {
      if (!me) fail(403, 'Solo los boxeadores responden.');
      if (room.phase !== 'question' || me.answerCorrect !== undefined) fail(409, 'La respuesta ya está cerrada.');
      const q = room.deck![room.exchange - 1];
      if (a.questionId !== q.id) fail(409, 'La pregunta ya ha cambiado.');
      if (!Number.isInteger(a.answer) || (a.answer as number) < 0 || (a.answer as number) >= q.options.length) fail(400, 'Opción no válida.');
      me.answer = a.answer as number; me.answerCorrect = me.answer === q.answer;
      if (me.answerCorrect) me.correct++; else { me.wrong++; me.move = 'recover'; }
      if (room.fighters.every((f) => f.answerCorrect !== undefined)) {
        room.phase = 'action';
        if (room.fighters.every((f) => f.move !== undefined)) resolveExchange(room);
      }
      return;
    }
    if (a.type === 'move') {
      if (!me) fail(403, 'Solo los boxeadores eligen movimientos.');
      if (room.phase !== 'action' || me.move !== undefined || !me.answerCorrect) fail(409, 'No puedes elegir otro movimiento.');
      if (a.questionId !== room.deck![room.exchange - 1].id) fail(409, 'La pregunta ya ha cambiado.');
      const move = BOXING_MOVES.find((m) => m.id === a.move);
      if (!move) fail(400, 'Movimiento desconocido.');
      if (me.stamina < move.cost) fail(409, 'No tienes energía suficiente para ese movimiento.');
      me.move = move.id;
      if (room.fighters.every((f) => f.move !== undefined)) resolveExchange(room);
      return;
    }
    fail(400, 'Acción desconocida.');
  }
  async function dispatch(req: IncomingMessage, res: ServerResponse, url: URL) {
    const methods: Record<string, string> = { '/api/boxing/create': 'POST', '/api/boxing/join': 'POST', '/api/boxing/state': 'GET', '/api/boxing/action': 'POST' };
    if (methods[url.pathname] && req.method !== methods[url.pathname]) {
      res.setHeader('Allow', methods[url.pathname]);
      fail(405, 'Método HTTP no permitido.');
    }
    if (url.pathname === '/api/boxing/create' && req.method === 'POST') {
      await body(req);
      const adm = guard?.admitCreate('boxing', guard.ip(req), Object.keys(rooms).length, req.headers['x-teacher-key']); if (adm && !adm.ok) fail(adm.status, adm.error);
      let code: string;
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      do { code = Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join(''); } while (rooms[code]);
      const room: Room = { code, teacherToken: randomBytes(32).toString('base64url'), phase: 'lobby', exchange: 0,
        maxExchanges: 12, paused: false, fighters: [], lastActive: now(), ...(adm?.ok && adm.owner ? { owner: adm.owner } : {}) };
      rooms[code] = room; save();
      return json(res, 200, { code, token: room.teacherToken, role: 'teacher' });
    }
    if (url.pathname === '/api/boxing/join' && req.method === 'POST') {
      const input = await body(req);
      const room = roomFor(input.code);
      if (room.fighters.length >= 2) fail(409, 'La sala ya tiene dos boxeadores.');
      if (typeof input.name !== 'string' || !input.name.trim()) fail(400, 'Escribe tu nombre.');
      const fighter: Fighter = { id: randomUUID(), name: input.name.trim().slice(0, 24), token: randomBytes(32).toString('base64url'),
        hp: 100, stamina: 4, correct: 0, wrong: 0, damage: 0, lastSeen: Date.now() };
      room.fighters.push(fighter); save();
      return json(res, 200, { code: room.code, token: fighter.token, role: 'player', pid: fighter.id });
    }
    if (url.pathname === '/api/boxing/state' && req.method === 'GET') {
      const room = roomFor(url.searchParams.get('code'));
      return json(res, 200, view(room, authenticate(req, room)));
    }
    if (url.pathname === '/api/boxing/action' && req.method === 'POST') {
      const input = await body(req);
      const room = roomFor(input.code);
      const me = authenticate(req, room);
      action(room, me, input.action); save();
      return json(res, 200, { ok: true });
    }
    fail(404, 'Ruta de boxeo no encontrada.');
  }
  /** Elimina las salas sin actividad autenticada durante `ttlMs`. Una sala con tráfico (sondeos incluidos) nunca caduca. */
  function sweep(at = now()): number {
    const gone = roomsToExpire(rooms, (r) => r.lastActive, (r, t) => { r.lastActive = t; }, at, ttlMs);
    for (const code of gone) delete rooms[code];
    if (gone.length) save();
    return gone.length;
  }
  const handler = function boxingHandler(req: IncomingMessage, res: ServerResponse): boolean {
    const url = new URL(req.url || '/', 'http://boxing.local');
    if (url.pathname !== '/api/boxing' && !url.pathname.startsWith('/api/boxing/')) return false;
    const ip = guard?.ip(req);
    if (guard && ip && !url.pathname.endsWith('/create') && guard.roomLookupBlocked(ip)) { json(res, 429, { error: 'Demasiados intentos con códigos de sala. Espera unos minutos.' }); return true; }
    void dispatch(req, res, url).catch((error: unknown) => {
      if (guard && ip && error instanceof ApiError && error.status === 404) guard.roomMiss(ip);
      json(res, error instanceof ApiError ? error.status : 500, { error: error instanceof ApiError ? error.message : 'No se pudo guardar o procesar la partida.' });
    });
    return true;
  };
  return Object.assign(handler, { sweep });
}
