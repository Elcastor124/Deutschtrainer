import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join, resolve } from 'node:path';
import { BOXING_MOVES, type BoxingMove, type BoxingFighter, type BoxingPhase, type BoxingQuestion, type BoxingResolution, type BoxingView } from '../shared/boxing.ts';
import { BOXING_BANK } from './boxing-bank.ts';
import type { Guard } from './security.ts';
import { roomsToExpire } from './room-ttl.ts';
import { FREE_BOXING, botAnswer, botMove, cleanName } from './boxing-free.ts';
import { BOXING_TOPICS } from '../shared/play.ts';
import type { Identity } from './play-api.ts';

const DECK_TOPICS = ['Akkusativ', 'Dativ', 'Präpositionen', 'Pronomen', 'Wo/Wohin'];
function shuffled<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) { const j = randomInt(i + 1); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
// Mazo equilibrado: rondas en las que cada tema de casos aparece una vez, en
// orden aleatorio. Así ningún tema sale más de dos veces seguidas y no hay repetidas.
function buildDeck(size: number, topics: string[] = DECK_TOPICS): BoxingQuestion[] {
  const buckets = new Map(topics.map((t) => [t, shuffled(BOXING_BANK.filter((q) => q.topic === t))]));
  const deck: BoxingQuestion[] = [];
  while (deck.length < size && [...buckets.values()].some((b) => b.length)) {
    for (const t of shuffled(topics)) {
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
  /** Modo libre: sparring del sistema / cuenta del alumno (para guardar su progreso). */
  bot?: boolean;
  account?: string;
}
/** Estado propio de las partidas del modo libre (sin profesor). */
interface FreeState { mode: 'solo' | 'private'; topics: string[]; ready: string[]; phaseAt: number; reported?: boolean }
interface Room {
  code: string;
  teacherToken: string;
  owner?: string;
  lastActive?: number;
  free?: FreeState;
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

/** Progreso del modo libre: lo registra el servidor (nunca el cliente) y solo para cuentas. */
export interface BoxingProgress {
  answer(a: { profile: string; qid: string; topic: string; ok: boolean; room: string }): void;
  activity(profile: string, a: { game: 'boxing'; level: 'A2'; total: number; correct: number; room: string }): void;
}

/** Mount before the existing HTTP routes. Returns synchronously, even for POSTs. */
export function createBoxingHandler({ dataDir = process.env.DATA_DIR || resolve(import.meta.dirname, '../data'), now = Date.now, guard, ttlMs = Number(process.env.BOXING_ROOM_TTL_HOURS || 24) * 3_600_000, identify, progress, random = Math.random }: { dataDir?: string; now?: () => number; guard?: Guard; ttlMs?: number; identify?: (req: IncomingMessage) => Identity; progress?: BoxingProgress; random?: () => number } = {}) {
  const file = join(dataDir, 'boxing.json');
  const rooms: Record<string, Room> = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).rooms : {};
  function save() {
    mkdirSync(dataDir, { recursive: true });
    const temporary = `${file}.${randomUUID()}.tmp`;
    writeFileSync(temporary, JSON.stringify({ version: 1, rooms }), { mode: 0o600 });
    renameSync(temporary, file);
  }
  /** Las salas del profesor y las del modo libre son espacios separados: un código de una no abre la otra por la API contraria. */
  function roomFor(value: unknown, free = false) {
    if (typeof value !== 'string' || !/^[A-Z2-9]{4}$/.test(value)) fail(400, 'Código de sala no válido.');
    const room = rooms[value];
    if (!room || !!room.free !== free) fail(404, 'No existe esa sala.');
    return room;
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
      ...(room.free ? { free: { mode: room.free.mode, ready: room.free.ready, deadline: deadlineOf(room) } } : {}),
      fighters: room.fighters.map((f) => ({ id: f.id, name: f.name, hp: f.hp, stamina: f.stamina,
        correct: f.correct, wrong: f.wrong, damage: f.damage, connected: !!f.bot || Date.now() - f.lastSeen < 20_000,
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
      finishFree(room);
    }
    if (room.free) room.free.phaseAt = now();
  }

  // ───────────── modo libre (sin profesor) ─────────────
  function deadlineOf(room: Room): number | null {
    const f = room.free; if (!f || room.paused) return null;
    const span = room.phase === 'question' ? FREE_BOXING.questionMs : room.phase === 'action' ? FREE_BOXING.actionMs : room.phase === 'result' ? FREE_BOXING.resultMs : 0;
    return span ? f.phaseAt + span : null;
  }
  /** Al terminar el combate se comunica la actividad COMPLETADA (una vez) por cada cuenta; los invitados no guardan nada. */
  function finishFree(room: Room) {
    if (!room.free || room.free.reported) return;
    room.free.reported = true;
    for (const f of room.fighters) if (f.account && !f.bot) progress?.activity(f.account, { game: 'boxing', level: 'A2', total: f.correct + f.wrong, correct: f.correct, room: room.code });
  }
  function startFree(room: Room) {
    const size = room.free!.mode === 'solo' ? FREE_BOXING.soloExchanges : FREE_BOXING.privateExchanges;
    room.maxExchanges = size;
    room.deck = buildDeck(size, room.free!.topics);
    room.phase = 'question'; room.exchange = 1; room.free!.phaseAt = now();
  }
  function nextExchange(room: Room) {
    room.exchange++; room.phase = 'question'; delete room.result;
    for (const f of room.fighters) { delete f.answer; delete f.answerCorrect; delete f.move; }
    if (room.free) room.free.phaseAt = now();
  }
  /** Cierra la fase de preguntas cuando todos han respondido (misma regla que el motor). */
  function closeAnswers(room: Room) {
    if (!room.fighters.every((f) => f.answerCorrect !== undefined)) return;
    room.phase = 'action';
    if (room.free) room.free.phaseAt = now();
    if (room.fighters.every((f) => f.move !== undefined)) resolveExchange(room);
  }
  function botStep(room: Room): boolean {
    const bot = room.fighters.find((f) => f.bot);
    if (!bot || !room.deck || room.paused) return false;
    const human = room.fighters.find((f) => !f.bot);
    if (room.phase === 'question' && bot.answerCorrect === undefined && human?.answerCorrect !== undefined) {
      const q = room.deck[room.exchange - 1];
      bot.answer = botAnswer(q.answer, q.options.length, random);
      bot.answerCorrect = bot.answer === q.answer;
      if (bot.answerCorrect) bot.correct++; else { bot.wrong++; bot.move = 'recover'; }
      closeAnswers(room);
      return true;
    }
    if (room.phase === 'action' && bot.answerCorrect && bot.move === undefined) {
      bot.move = botMove(bot.hp, bot.stamina, random);
      if (room.fighters.every((f) => f.move !== undefined)) resolveExchange(room);
      return true;
    }
    return false;
  }
  /** Plazos del servidor: quien no actúa a tiempo pierde el turno (nadie queda bloqueando la partida) + avance automático + sparring. */
  function settle(room: Room): boolean {
    const f = room.free;
    if (!f || room.paused || room.phase === 'lobby' || room.phase === 'finished') return false;
    const t = now();
    let changed = false;
    if (room.phase === 'question' && t - f.phaseAt > FREE_BOXING.questionMs) {
      for (const x of room.fighters) if (x.answerCorrect === undefined) { x.answerCorrect = false; x.wrong++; x.move = 'recover'; }
      closeAnswers(room); changed = true;
    } else if (room.phase === 'action' && t - f.phaseAt > FREE_BOXING.actionMs) {
      for (const x of room.fighters) x.move ??= 'recover';
      resolveExchange(room); changed = true;
    } else if (room.phase === 'result' && t - f.phaseAt > FREE_BOXING.resultMs) { nextExchange(room); changed = true; }
    return botStep(room) || changed;
  }
  const topicKey = (name: string) => Object.entries(BOXING_TOPICS).find(([, n]) => n === name)?.[0] ?? name.toLowerCase();
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
      if (me && !room.free) fail(403, 'Solo el profesor puede avanzar.');
      if (room.phase !== 'result') fail(409, 'Primero termina el intercambio.');
      nextExchange(room);
      return;
    }
    if (a.type === 'ready') {
      if (!room.free || !me) fail(403, 'Solo en las partidas privadas del modo libre.');
      if (room.phase !== 'lobby') fail(409, 'La partida ya ha empezado.');
      if (room.free.mode !== 'private') fail(409, 'Esta partida empieza sola.');
      if (!room.free.ready.includes(me.id)) room.free.ready.push(me.id);
      if (room.fighters.length === 2 && room.fighters.every((f) => room.free!.ready.includes(f.id))) startFree(room);
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
      // Progreso (solo cuentas, solo modo libre): lo decide el servidor con la respuesta ya corregida.
      if (room.free && me.account) progress?.answer({ profile: me.account, qid: q.id, topic: topicKey(q.topic), ok: me.answerCorrect, room: room.code });
      closeAnswers(room);
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
  // ───────────── API de JUGADOR (modo libre): /api/play/boxing/* ─────────────
  // Nada de aquí crea salas de profesor ni da acceso a acciones de profesor: la sala libre no tiene token de profesor entregado a nadie,
  // y el motor rechaza pausa/reanudar/revelar/reiniciar/empezar a cualquier luchador.
  const newFighter = (name: string, account?: string, bot = false): Fighter => ({
    id: randomUUID(), name, token: randomBytes(32).toString('base64url'), hp: 100, stamina: 4, correct: 0, wrong: 0, damage: 0, lastSeen: now(),
    ...(account ? { account } : {}), ...(bot ? { bot: true } : {}),
  });
  function who(req: IncomingMessage): { account?: string; alias?: string } {
    const id = identify?.(req);
    if (id?.kind === 'invalid') fail(401, 'Tu sesión ha caducado: vuelve a iniciar sesión o juega como invitado.');
    return id?.kind === 'account' ? { account: id.account.id, alias: id.account.alias } : {};
  }
  function cleanTopics(v: unknown): string[] {
    if (v === undefined || v === null) return Object.values(BOXING_TOPICS);
    if (!Array.isArray(v)) fail(400, 'Los temas deben ser una lista.');
    const names = [...new Set((v as unknown[]).map((t) => (typeof t === 'string' ? (BOXING_TOPICS as Record<string, string>)[t] : undefined)))];
    if (names.some((n) => !n)) fail(400, 'Tema desconocido.');
    return names.length ? names as string[] : Object.values(BOXING_TOPICS);
  }
  async function dispatchFree(req: IncomingMessage, res: ServerResponse, url: URL) {
    const route = url.pathname.slice('/api/play/boxing/'.length);
    const methods: Record<string, string> = { solo: 'POST', create: 'POST', join: 'POST', state: 'GET', action: 'POST' };
    if (!Object.hasOwn(methods, route)) fail(404, 'Ruta de boxeo libre no encontrada.');
    if (req.method !== methods[route]) { res.setHeader('Allow', methods[route]); fail(405, 'Método HTTP no permitido.'); }
    const me = who(req);
    const free = () => Object.values(rooms).filter((r) => r.free).length;
    const code = () => { let c: string; const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; do { c = Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join(''); } while (rooms[c]); return c; };
    if (route === 'solo' || route === 'create') {
      const input = await body(req);
      if (input.level !== undefined && input.level !== 'A2') fail(400, 'El boxeo solo tiene nivel A2.');
      const topics = cleanTopics(input.topics);
      const adm = guard?.admitFree(route === 'solo' ? 'solo' : 'private', guard.ip(req), free(), me.account); if (adm && !adm.ok) fail(adm.status, adm.error);
      const human = newFighter(me.alias ?? cleanName(input.name, 'Invitado'), me.account);
      const room: Room = { code: code(), teacherToken: randomBytes(32).toString('base64url'), phase: 'lobby', exchange: 0, maxExchanges: 12, paused: false, fighters: [human],
        lastActive: now(), free: { mode: route === 'solo' ? 'solo' : 'private', topics, ready: [], phaseAt: now() } };
      if (route === 'solo') { room.fighters.push(newFighter('Sparring', undefined, true)); startFree(room); }
      rooms[room.code] = room; save();
      return json(res, 200, { code: room.code, token: human.token, role: 'player', pid: human.id, free: true });
    }
    if (route === 'join') {
      const input = await body(req);
      const room = roomFor(input.code, true);
      if (room.free!.mode !== 'private') fail(404, 'No existe esa sala.');
      if (room.phase !== 'lobby') fail(409, 'La partida ya ha empezado.');
      if (room.fighters.length >= 2) fail(409, 'La sala ya tiene dos jugadores.');
      if (me.account && room.fighters.some((f) => f.account === me.account)) fail(409, 'Ya estás en esta sala con tu cuenta.');
      const fighter = newFighter(me.alias ?? cleanName(input.name, 'Invitado'), me.account);
      if (room.fighters.some((f) => f.name.toLowerCase() === fighter.name.toLowerCase())) fighter.name = `${fighter.name.slice(0, 13)} 2`;
      room.lastActive = now(); room.fighters.push(fighter); save();
      return json(res, 200, { code: room.code, token: fighter.token, role: 'player', pid: fighter.id, free: true });
    }
    // state / action: solo los luchadores de esa sala (token de jugador); el token de profesor de una sala libre no existe para nadie.
    const input = route === 'action' ? await body(req) : {};
    const room = roomFor(route === 'state' ? url.searchParams.get('code') : input.code, true);
    const token = req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]+)$/)?.[1];
    const fighter = token ? room.fighters.find((f) => !f.bot && f.token === token) : undefined;
    if (!fighter) fail(401, 'Sesión no válida.');
    fighter!.lastSeen = now(); room.lastActive = now();
    const changedBefore = settle(room);
    if (route === 'action') { action(room, fighter, input.action); settle(room); save(); return json(res, 200, { ok: true }); }
    if (changedBefore) save();
    return json(res, 200, view(room, fighter));
  }
  async function dispatch(req: IncomingMessage, res: ServerResponse, url: URL) {
    if (url.pathname.startsWith('/api/play/boxing/')) return dispatchFree(req, res, url);
    const methods: Record<string, string> = { '/api/boxing/create': 'POST', '/api/boxing/join': 'POST', '/api/boxing/state': 'GET', '/api/boxing/action': 'POST' };
    if (methods[url.pathname] && req.method !== methods[url.pathname]) {
      res.setHeader('Allow', methods[url.pathname]);
      fail(405, 'Método HTTP no permitido.');
    }
    if (url.pathname === '/api/boxing/create' && req.method === 'POST') {
      await body(req);
      const adm = guard?.admitCreate('boxing', guard.ip(req), Object.values(rooms).filter((r) => !r.free).length, req.headers['x-teacher-key'], guard.teacherFromRequest(req)); if (adm && !adm.ok) fail(adm.status, adm.error);
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
    // Las partidas libres caducan antes: terminadas a los 10 min, abandonadas a las 2 h; las del profesor, ttlMs.
    const gone = roomsToExpire(rooms, (r) => r.lastActive, (r, t) => { r.lastActive = t; }, at, (r) => (r.free ? (r.phase === 'finished' ? FREE_BOXING.finishedTtlMs : FREE_BOXING.idleTtlMs) : ttlMs));
    for (const code of gone) delete rooms[code];
    if (gone.length) save();
    return gone.length;
  }
  const handler = function boxingHandler(req: IncomingMessage, res: ServerResponse): boolean {
    const url = new URL(req.url || '/', 'http://boxing.local');
    if (url.pathname !== '/api/boxing' && !url.pathname.startsWith('/api/boxing/') && !url.pathname.startsWith('/api/play/boxing/')) return false;
    const ip = guard?.ip(req);
    if (guard && ip && !/\/(create|solo)$/.test(url.pathname) && guard.roomLookupBlocked(ip)) { json(res, 429, { error: 'Demasiados intentos con códigos de sala. Espera unos minutos.' }); return true; }
    void dispatch(req, res, url).catch((error: unknown) => {
      if (guard && ip && error instanceof ApiError && error.status === 404) guard.roomMiss(ip);
      json(res, error instanceof ApiError ? error.status : 500, { error: error instanceof ApiError ? error.message : 'No se pudo guardar o procesar la partida.' });
    });
    return true;
  };
  return Object.assign(handler, { sweep });
}
