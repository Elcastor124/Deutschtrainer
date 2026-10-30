// Servidor de juego: HTTP (cliente compilado) + WebSocket (estado en tiempo real).
// Arranque: node server/index.ts   (Node ≥ 22.18 ejecuta TypeScript directamente)
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { networkInterfaces } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { WebSocketServer, type WebSocket } from 'ws';
import type { BlockId, ChestTier, ClientMsg, CtlAction, ItemId, ServerMsg } from '../shared/types.ts';
import { CHESTS, PLAN, ITEMS } from '../shared/rules.ts';
import { loadBank } from './bank/index.ts';
import { Room, newCode, type Deps, type Result, type RoomState } from './room.ts';
import { jengaPull, taskCtl, taskPick, taskText } from './tasks.ts';
import { openPractice } from './practice-session.ts';
import { Store, type Profile } from './store.ts';
import { createBoxingHandler } from './boxing.ts';
import { createRoadHandler } from './road.ts';
import { createProgressHandler, isAccountProfile, recordEvent } from './progress.ts';
import { AccountStore } from './accounts.ts';
import { createPlayApi, identify } from './play-api.ts';
import { resolveStatic, SECURITY_HEADERS } from './static.ts';
import { createGuard } from './security.ts';
import { acquireInstanceLock } from './instance-lock.ts';
import { TokenBucket } from './limits.ts';
import { CLASS_ROOM_TTL_MS, staleRooms } from './room-ttl.ts';

const PORT = Number(process.env.PORT) || 4747;
const ROOT = resolve(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist');
const DATA_DIR = process.env.DATA_DIR || join(ROOT, 'data');
// Una sola instancia por directorio de datos (el estado vive en memoria): si hay otra viva, no arrancamos.
const instanceLock = await acquireInstanceLock(DATA_DIR, { waitMs: Number(process.env.INSTANCE_LOCK_WAIT_MS ?? 35_000) }).catch((e: Error) => { console.error(`[lock] ${e.message}`); process.exit(1); });
const guard = createGuard({ dataDir: DATA_DIR });
const store = new Store<RoomState>(DATA_DIR);
const accounts = new AccountStore(DATA_DIR);
const bank = loadBank();
const ROOM_TTL = CLASS_ROOM_TTL_MS;

// ───────────── perfiles (historial para el modo práctica) ─────────────
/** Códigos de alumno nuevos: 8 caracteres (≈2⁴⁰). Los de 6 (≈2³⁰) ya emitidos siguen valiendo. */
const PROFILE_CODE_LEN = 8;
/** Perfil de una sala reanudada con su token (de confianza): cuenta (persistente) o invitado (transitorio, vacío). */
function resumeProfile(id: string): Profile {
  if (id.startsWith('guest_')) return { id, code: '', name: 'Invitado', stats: {}, createdAt: Date.now() };
  return store.data.profiles[id] ?? ensureProfile(id, '');
}
/** Modo libre: sesión de alumno válida → su perfil de cuenta; sin sesión → invitado (nada se guarda, nada puntúa); sesión inválida → error. */
function freeProfile(m: { session?: unknown }, name: string): Profile | { error: string } {
  if (m.session !== undefined && m.session !== null && m.session !== '') {
    const acc = accounts.verify(m.session);
    if (!acc) return { error: 'Tu sesión ha caducado: vuelve a iniciar sesión o juega como invitado.' };
    return (store.data.profiles[acc.id] ??= { id: acc.id, code: '', name: acc.alias, stats: {}, createdAt: Date.now() });
  }
  return { id: `guest_${randomUUID().replaceAll('-', '')}`, code: '', name: name || 'Invitado', stats: {}, createdAt: Date.now() };
}
function profileCodeFor(id: string) { return store.data.profiles[id]?.code ?? ''; }
/** Ids reservados del modo libre: un cliente NO puede adoptar el perfil de una cuenta ni de un invitado diciendo su id. */
const RESERVED_ID = /^(acc|guest)_/;
function ensureProfile(id: string | undefined, name: string): Profile {
  const key = id && /^[\w-]{8,64}$/.test(id) && !RESERVED_ID.test(id) ? id : randomUUID();
  let p = store.data.profiles[key];
  if (!p) {
    let code = newCode(PROFILE_CODE_LEN);
    while (store.profileByCode(code)) code = newCode(PROFILE_CODE_LEN);
    p = store.data.profiles[key] = { id: key, code, name: name.slice(0, 16), stats: {}, createdAt: Date.now() };
  }
  if (name) p.name = name.slice(0, 16);
  return p;
}
function recordResult(profile: string, qid: string, ok: boolean, context?: {source: 'practice' | 'class' | 'jenga'; room: string}) {
  const p = store.data.profiles[profile];
  if (!p) return;
  const s = (p.stats[qid] ??= { n: 0, wrong: 0, last: 1, at: 0 });
  s.n++;
  if (!ok) s.wrong++;
  s.last = ok ? 1 : 0;
  s.at = Date.now();
  recordEvent({profile, kind:'answer', source:context?.source ?? 'practice', qid, topic:bank.get(qid)?.topic, ok, ...(context ? {room:context.room} : {})});
}

/** Preguntas que ya han visto estos perfiles (en clase o en práctica): id → última vez. */
function seenBy(profiles: string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const id of profiles) {
    for (const [qid, st] of Object.entries(store.data.profiles[id]?.stats ?? {})) out.set(qid, Math.max(out.get(qid) ?? 0, st.at));
  }
  return out;
}

const deps: Deps = {
  bank, now: () => Date.now(), rand: Math.random, onResult: recordResult, profileCode: profileCodeFor, seen: seenBy,
  // Solo las cuentas puntúan; el servidor valida y limita (ProgressLog.activity). Invitados: nada.
  onActivity: (profile, a) => { if (isAccountProfile(profile)) progressHandler.log.activity(profile, a); },
};

// ───────────── salas ─────────────
const rooms = new Map<string, Room>();
for (const [code, s] of Object.entries(store.data.rooms)) {
  if (Date.now() - s.updatedAt > ROOM_TTL) continue;
  for (const p of s.players) p.connected = false;
  rooms.set(code, Room.restore(s, deps));
}
console.log(`[store] ${rooms.size} sala(s) restaurada(s) · banco: ${bank.size} preguntas`);

interface Client { ws: WebSocket; room: string; role: 'teacher' | 'player' | 'practice'; pid?: string; alive: boolean; ip: string; bucket: TokenBucket }
const countRooms = (mode: 'class' | 'practice') => { let n = 0; for (const r of rooms.values()) if (r.s.mode === mode) n++; return n; };
const clients = new Set<Client>();

function persist(room: Room) {
  store.data.rooms[room.s.code] = room.s;
  store.saveSoon();
}

function send(ws: WebSocket, m: ServerMsg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(m));
}

function broadcast(room: Room) {
  for (const c of clients) {
    if (c.room !== room.s.code) continue;
    send(c.ws, { t: 'state', s: room.view(c.role === 'teacher' ? { teacher: true } : { pid: c.pid as string }) });
  }
  persist(room);
}

function uniqueCode(n: number) {
  let code = newCode(n);
  while (rooms.has(code)) code = newCode(n);
  return code;
}

function ctl(room: Room, a: CtlAction): Result {
  if (!a || typeof a !== 'object') return { ok: false, error: 'Acción desconocida.' };
  switch (a.k) {
    case 'block': return PLAN.some((b) => b.id === a.block) ? room.startBlock(a.block as BlockId) : { ok: false, error: 'Bloque desconocido.' };
    case 'next': return room.next();
    case 'pause': return room.pause();
    case 'resume': return room.resume();
    case 'addTime': return room.addTime(Number(a.s) || 0);
    case 'lock': return room.lock();
    case 'skip': return room.skip();
    case 'judge': return room.judge(String(a.pid), !!a.ok);
    case 'judgeAll': return room.judgeAll(!!a.ok);
    case 'points': return room.points(String(a.pid), Number(a.delta) || 0);
    case 'items': return room.setItems(!!a.on, a.item);
    case 'give': return room.give(String(a.pid), a.item);
    case 'chest': return a.tier in CHESTS ? room.giveChest(String(a.pid), a.tier as ChestTier) : { ok: false, error: 'Cofre desconocido.' };
    case 'task': return taskCtl(room, String(a.op), a.pid ? String(a.pid) : undefined, Number.isFinite(Number(a.n)) ? Number(a.n) : undefined, !!a.ok);
    case 'kick': return room.kick(String(a.pid));
    default: return { ok: false, error: 'Acción desconocida.' };
  }
}

class LimitError extends Error {}

function hello(c: Client, m: Extract<ClientMsg, { t: 'hello' }>) {
  if (m.role === 'teacher') {
    let room = m.room ? rooms.get(String(m.room).toUpperCase()) : undefined;
    if (!m.create && guard.roomLookupBlocked(c.ip)) return send(c.ws, { t: 'err', msg: 'Demasiados intentos con códigos de sala. Espera unos minutos.', fatal: true });
    if (m.create) {
      const adm = guard.admitCreate('class', c.ip, countRooms('class'), m.teacherKey);
      if (!adm.ok) return send(c.ws, { t: 'err', msg: adm.error, fatal: true });
      room = Room.create(deps, uniqueCode(4));
      if (adm.owner) room.s.owner = adm.owner;
      // Juego por temas (/jugar?temas=…) o Wort-Jenga directo (/jenga).
      room.configure({ topics: m.topics, start: m.start });
      rooms.set(room.s.code, room);
    } else if (!room || room.s.teacherToken !== m.token) {
      // Recuperación con credencial del servidor: solo el profesor que creó la sala (owner) la recupera sin su token.
      const owned = room?.s.owner && m.teacherKey ? guard.teacherFor(m.teacherKey, c.ip) : null;
      if (!room || !owned?.ok || owned.id !== room.s.owner) {
        if (!room) guard.roomMiss(c.ip);
        return send(c.ws, { t: 'err', msg: owned && !owned.ok ? owned.error : 'Sala no encontrada o sin permiso de profesor.', fatal: true });
      }
    }
    Object.assign(c, { room: room.s.code, role: 'teacher' });
    send(c.ws, { t: 'welcome', role: 'teacher', room: room.s.code, token: room.s.teacherToken });
    return broadcast(room);
  }

  if (m.role === 'player') {
    if (guard.roomLookupBlocked(c.ip)) return send(c.ws, { t: 'err', msg: 'Demasiados intentos con códigos de sala. Espera unos minutos.', fatal: true });
    const room = rooms.get(String(m.room ?? '').toUpperCase());
    if (!room || room.s.mode !== 'class') { guard.roomMiss(c.ip); return send(c.ws, { t: 'err', msg: 'No existe ninguna sala con ese código.', fatal: true }); }
    let p = m.token ? room.byToken(String(m.token)) : undefined;
    if (!p) {
      if (!m.name) return send(c.ws, { t: 'err', msg: 'Tu sesión ya no existe: vuelve a entrar con tu nombre.', fatal: true });
      const prof = ensureProfile(m.profile, String(m.name));
      const r = room.join(String(m.name), prof.id);
      if ('ok' in r) return send(c.ws, { t: 'err', msg: r.ok ? 'Error' : r.error, fatal: true });
      p = r;
    }
    Object.assign(c, { room: room.s.code, role: 'player', pid: p.id });
    room.setConnected(p.id, true);
    send(c.ws, { t: 'welcome', role: 'player', room: room.s.code, token: p.token, pid: p.id, profile: p.profile, profileCode: profileCodeFor(p.profile) });
    return broadcast(room);
  }

  if (m.role === 'practice') {
    // Reanudar una práctica (recarga de página) o empezar una nueva; si la sala guardada ya no existe, otra nueva con aviso.
    let locked: string | null = null;
    let r: ReturnType<typeof openPractice>;
    try {
      r = openPractice({
        rooms, deps,
        // Solo se llama al CREAR una práctica (reanudar con token no pasa por aquí): ahí se aplican los límites.
        newRoomCode: () => {
          const adm = guard.admitCreate('practice', c.ip, countRooms('practice'));
          if (!adm.ok) throw new LimitError(adm.error);
          return 'P' + uniqueCode(5);
        },
        // Recuperar historial por código de alumno: intentos fallidos limitados por IP y en global.
        profileByCode: (code) => {
          locked = guard.codeLocked(c.ip);
          if (locked) return undefined;
          const p = store.profileByCode(code);
          if (!p) guard.codeFailed(c.ip);
          return p;
        },
        ensureProfile, resumeProfile, freeProfile,
      }, m);
    } catch (e) {
      if (e instanceof LimitError) return send(c.ws, { t: 'err', msg: e.message, fatal: true });
      throw e;
    }
    if (!r.ok) return send(c.ws, { t: 'err', msg: locked ?? r.error, fatal: true });
    for (const code of Object.keys(store.data.rooms)) if (!rooms.has(code)) delete store.data.rooms[code];
    const { room, profile: prof } = r;
    const p = room.s.players[0];
    Object.assign(c, { room: room.s.code, role: 'practice', pid: p.id });
    room.setConnected(p.id, true);
    send(c.ws, { t: 'welcome', role: 'practice', room: room.s.code, token: p.token, pid: p.id, profile: prof.id, profileCode: prof.code, ...(r.notice ? { notice: r.notice } : {}) });
    return broadcast(room);
  }
}

/** Un mensaje erróneo (o un fallo inesperado) nunca debe tumbar el servidor: se registra y se avisa al cliente. */
function handle(c: Client, raw: string) {
  try {
    handleMsg(c, raw);
  } catch (e) {
    console.error('[ws] error procesando un mensaje:', e);
    const id = (() => { try { return Number(JSON.parse(raw)?.id) || 0; } catch { return 0; } })();
    send(c.ws, id ? { t: 'ack', id, ok: false, error: 'Error interno del servidor. Inténtalo de nuevo.' } : { t: 'err', msg: 'Error interno del servidor. Recarga la página.' });
  }
}

function handleMsg(c: Client, raw: string) {
  // Ritmo por conexión (ráfaga 40, 20 mensajes/s sostenidos): cada acción válida provoca un broadcast a toda la sala.
  if (!c.bucket.take()) {
    const id = (() => { try { return Number(JSON.parse(raw)?.id) || 0; } catch { return 0; } })();
    return send(c.ws, id ? { t: 'ack', id, ok: false, error: 'Demasiado rápido. Espera un momento.' } : { t: 'err', msg: 'Demasiado rápido. Espera un momento.' });
  }
  let m: ClientMsg;
  try { m = JSON.parse(raw); } catch { return; }
  if (!m || typeof m !== 'object' || Array.isArray(m)) return;
  if (m.t === 'hello') return hello(c, m);
  const room = rooms.get(c.room);
  if (!room) return send(c.ws, { t: 'err', msg: 'Sala no disponible.' });
  const id = Number((m as { id?: number }).id) || 0;
  let r: Result;
  if (m.t === 'ctl') {
    if (c.role !== 'teacher') r = { ok: false, error: 'Solo el profesor.' };
    else r = ctl(room, m.a);
  } else if (!c.pid) {
    r = { ok: false, error: 'No estás en la sala.' };
  } else if (m.t === 'answer') r = room.answer(c.pid, String(m.qid), m.a);
  else if (m.t === 'item') r = (m.item in ITEMS) ? room.useItem(c.pid, m.item as ItemId, m.target ? String(m.target) : undefined) : { ok: false, error: 'Objeto desconocido.' };
  else if (m.t === 'wild') r = room.pickWild(c.pid, m.topic);
  else if (m.t === 'pickup') r = room.resolvePickup(c.pid, Number(m.discard));
  else if (m.t === 'open') r = room.openChest(c.pid, String(m.chest));
  else if (m.t === 'text') r = taskText(room, c.pid, typeof m.text === 'string' ? m.text : '', !!m.done);
  else if (m.t === 'pick') r = taskPick(room, c.pid, Number(m.n));
  else if (m.t === 'pull') r = jengaPull(room, c.pid, Number(m.level), Number(m.slot));
  else if (m.t === 'pnext') r = room.practiceNext();
  else r = { ok: false, error: 'Mensaje desconocido.' };
  send(c.ws, r.ok ? { t: 'ack', id, ok: true, ...(r.retry ? { retry: true } : {}) } : { t: 'ack', id, ok: false, error: r.error });
  if (r.ok) broadcast(room);
}

// ───────────── HTTP ─────────────
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.pdf': 'application/pdf',
};

const progressHandler = createProgressHandler({dataDir: DATA_DIR, profiles: id => store.data.profiles[id]});
const playApi = createPlayApi({ accounts, guard, log: () => progressHandler.log, bank });
playApi.setOnRemoved((id) => { delete store.data.profiles[id]; store.saveSoon(); });
const roadHandler = createRoadHandler({ dataDir: DATA_DIR, guard });
const boxingHandler = createBoxingHandler({
  dataDir: DATA_DIR, guard, identify: (req) => identify(accounts, req),
  progress: {
    answer: (x) => { if (isAccountProfile(x.profile)) recordEvent({ profile: x.profile, kind: 'answer', source: 'boxing', qid: x.qid, topic: x.topic, ok: x.ok, room: x.room }); },
    activity: (profile, a) => { if (isAccountProfile(profile)) progressHandler.log.activity(profile, a); },
  },
});
const server = createServer((req, res) => {
  // Un fallo en una petición HTTP nunca debe tumbar el proceso (y con él todas las salas en curso).
  try { serve(req, res); } catch (e) {
    console.error('[http] error procesando', req.url, e);
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Error interno del servidor.');
  }
});

function serve(req: IncomingMessage, res: ServerResponse) {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
  if (req.url?.startsWith('/api/progress') && !guard.allow('progress', guard.ip(req))) {
    res.writeHead(429, { 'content-type': 'application/json; charset=utf-8', 'retry-after': '60' });
    return void res.end(JSON.stringify({ error: 'Demasiadas peticiones. Espera un minuto.' }));
  }
  if (playApi(req, res)) return;
  if (progressHandler(req, res)) return;
  if (roadHandler(req, res)) return;
  if (boxingHandler(req, res)) return;
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname === '/api/info') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ips: lanIps(), port: PORT }));
  }
  if (url.pathname === '/api/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, rooms: rooms.size, bank: bank.size, teacherAuth: guard.stats() }));
  }
  if (!existsSync(DIST)) {
    res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('Falta compilar el cliente: ejecuta «npm run build».');
  }
  let file = resolveStatic(DIST, url.pathname);
  if (!file) { res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('Petición no válida.'); }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html');
  const ext = extname(file);
  res.writeHead(200, {
    'content-type': MIME[ext] ?? 'application/octet-stream',
    'cache-control': file.includes(`${join(DIST, 'assets')}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  createReadStream(file).on('error', () => res.destroy()).pipe(res);
}

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });
wss.on('connection', (ws, req) => {
  const ip = guard.ip(req);
  if (!guard.wsOpen(ip)) { ws.close(1013, 'Demasiadas conexiones'); return; }
  const c: Client = { ws, room: '', role: 'player', alive: true, ip, bucket: new TokenBucket(40, 20) };
  clients.add(c);
  ws.on('pong', () => { c.alive = true; });
  ws.on('message', (data) => handle(c, data.toString()));
  ws.on('close', () => {
    guard.wsClose(ip);
    clients.delete(c);
    const room = rooms.get(c.room);
    if (room && c.pid && ![...clients].some((x) => x.room === c.room && x.pid === c.pid)) {
      room.setConnected(c.pid, false);
      broadcast(room);
    }
  });
});

// Latido: detecta conexiones muertas (Chromebook que se duerme, wifi que cae…).
setInterval(() => {
  for (const c of clients) {
    if (!c.alive) { c.ws.terminate(); continue; }
    c.alive = false;
    c.ws.ping();
  }
}, 15_000);

// Temporizadores de las salas.
setInterval(() => {
  for (const room of rooms.values()) {
    try { if (room.tick()) broadcast(room); } catch (e) { console.error(`[tick] sala ${room.s.code}:`, e); }
  }
}, 250);

const shutdown = () => {
  store.data.rooms = Object.fromEntries([...rooms].map(([k, r]) => [k, r.s]));
  store.flush(); progressHandler.log.flush(); instanceLock.release(); process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Limpieza periódica: salas abandonadas (sin nadie conectado) y contadores de los limitadores.
// Una sala con algún cliente conectado NUNCA se descarta; ver server/room-ttl.ts para los TTL.
function sweepRooms(at = Date.now()) {
  let removed = 0;
  for (const code of staleRooms([...rooms].map(([k, r]) => [k, r.s] as const), (code) => [...clients].some((c) => c.room === code), at)) {
    rooms.delete(code);
    delete store.data.rooms[code];
    removed++;
  }
  removed += roadHandler.sweep(at) + boxingHandler.sweep(at);
  guard.sweep();
  if (removed) { store.saveSoon(); console.log(`[ttl] ${removed} sala(s) caducada(s) eliminada(s)`); }
}
setInterval(() => { try { sweepRooms(); } catch (e) { console.error('[ttl] error en la limpieza:', e); } }, 10 * 60_000).unref();
sweepRooms();

/** IPs de la red local (wifi/ethernet), sin adaptadores virtuales; primero las típicas de casa/escuela. */
function lanIps(): string[] {
  const rank = (ip: string) => (ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : 2);
  return Object.entries(networkInterfaces())
    .filter(([name]) => !/vEthernet|WSL|Docker|VirtualBox|VMware|Hyper-V|vboxnet|utun|tailscale|zerotier/i.test(name))
    .flatMap(([, list]) => list ?? [])
    .filter((i) => i.family === 'IPv4' && !i.internal && !i.address.startsWith('169.254.'))
    .map((i) => i.address)
    .sort((a, b) => rank(a) - rank(b));
}

server.listen(PORT, '0.0.0.0', () => {
  const ips = lanIps();
  console.log(`\n  DEUTSCH TRAINER // BLACKCARD`);
  console.log(`  → http://localhost:${PORT}`);
  for (const ip of ips) console.log(`  → http://${ip}:${PORT}   (alumnos en la misma wifi)`);
  console.log('');
});
