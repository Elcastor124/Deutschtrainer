// Servidor de juego: HTTP (cliente compilado) + WebSocket (estado en tiempo real).
// Arranque: node server/index.ts   (Node ≥ 22.18 ejecuta TypeScript directamente)
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize, resolve } from 'node:path';
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
import { createProgressHandler, recordEvent } from './progress.ts';

const PORT = Number(process.env.PORT) || 4747;
const ROOT = resolve(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist');
const store = new Store<RoomState>(process.env.DATA_DIR || join(ROOT, 'data'));
const bank = loadBank();
const ROOM_TTL = 1000 * 60 * 60 * 24 * 14;

// ───────────── perfiles (historial para el modo práctica) ─────────────
function profileCodeFor(id: string) { return store.data.profiles[id]?.code ?? ''; }
function ensureProfile(id: string | undefined, name: string): Profile {
  const key = id && /^[\w-]{8,64}$/.test(id) ? id : randomUUID();
  let p = store.data.profiles[key];
  if (!p) {
    let code = newCode(6);
    while (store.profileByCode(code)) code = newCode(6);
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

const deps: Deps = { bank, now: () => Date.now(), rand: Math.random, onResult: recordResult, profileCode: profileCodeFor, seen: seenBy };

// ───────────── salas ─────────────
const rooms = new Map<string, Room>();
for (const [code, s] of Object.entries(store.data.rooms)) {
  if (Date.now() - s.updatedAt > ROOM_TTL) continue;
  for (const p of s.players) p.connected = false;
  rooms.set(code, Room.restore(s, deps));
}
console.log(`[store] ${rooms.size} sala(s) restaurada(s) · banco: ${bank.size} preguntas`);

interface Client { ws: WebSocket; room: string; role: 'teacher' | 'player' | 'practice'; pid?: string; alive: boolean }
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

function hello(c: Client, m: Extract<ClientMsg, { t: 'hello' }>) {
  if (m.role === 'teacher') {
    let room = m.room ? rooms.get(String(m.room).toUpperCase()) : undefined;
    if (m.create) {
      room = Room.create(deps, uniqueCode(4));
      // Juego por temas (/jugar?temas=…) o Wort-Jenga directo (/jenga).
      room.configure({ topics: m.topics, start: m.start });
      rooms.set(room.s.code, room);
    } else if (!room || room.s.teacherToken !== m.token) {
      return send(c.ws, { t: 'err', msg: 'Sala no encontrada o sin permiso de profesor.', fatal: true });
    }
    Object.assign(c, { room: room.s.code, role: 'teacher' });
    send(c.ws, { t: 'welcome', role: 'teacher', room: room.s.code, token: room.s.teacherToken });
    return broadcast(room);
  }

  if (m.role === 'player') {
    const room = rooms.get(String(m.room ?? '').toUpperCase());
    if (!room || room.s.mode !== 'class') return send(c.ws, { t: 'err', msg: 'No existe ninguna sala con ese código.', fatal: true });
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
    const r = openPractice({
      rooms, deps, newRoomCode: () => 'P' + uniqueCode(5),
      profileByCode: (code) => store.profileByCode(code),
      ensureProfile,
    }, m);
    if (!r.ok) return send(c.ws, { t: 'err', msg: r.error, fatal: true });
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

const progressHandler = createProgressHandler({dataDir: process.env.DATA_DIR || join(ROOT, 'data'), profiles: id => store.data.profiles[id]});
const roadHandler = createRoadHandler({ dataDir: process.env.DATA_DIR || join(ROOT, 'data') });
const boxingHandler = createBoxingHandler({ dataDir: process.env.DATA_DIR || join(ROOT, 'data') });
const server = createServer((req, res) => {
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
    return res.end(JSON.stringify({ ok: true, rooms: rooms.size, bank: bank.size }));
  }
  if (!existsSync(DIST)) {
    res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('Falta compilar el cliente: ejecuta «npm run build».');
  }
  let file = normalize(join(DIST, decodeURIComponent(url.pathname)));
  if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html');
  const ext = extname(file);
  res.writeHead(200, {
    'content-type': MIME[ext] ?? 'application/octet-stream',
    'cache-control': file.includes(`${join(DIST, 'assets')}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  createReadStream(file).pipe(res);
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });
wss.on('connection', (ws) => {
  const c: Client = { ws, room: '', role: 'player', alive: true };
  clients.add(c);
  ws.on('pong', () => { c.alive = true; });
  ws.on('message', (data) => handle(c, data.toString()));
  ws.on('close', () => {
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

process.on('SIGINT', () => { store.data.rooms = Object.fromEntries([...rooms].map(([k, r]) => [k, r.s])); store.flush(); progressHandler.log.flush(); process.exit(0); });
process.on('SIGTERM', () => { store.data.rooms = Object.fromEntries([...rooms].map(([k, r]) => [k, r.s])); store.flush(); progressHandler.log.flush(); process.exit(0); });

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
