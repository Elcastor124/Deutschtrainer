// Salas privadas de BlackCard y Wort-Jenga contra un servidor real: las crea un alumno, se entra por código y avanzan sin profesor.
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { loadBank } from '../server/bank/index.ts';

const ROOT = resolve(import.meta.dirname, '..');
const bank = loadBank();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Puerto libre asignado por el SO (los ficheros de test corren en paralelo: los rangos aleatorios chocaban). */
const freePort = () => new Promise<number>((res, rej) => { const s = createServer(); s.once('error', rej); s.listen(0, '127.0.0.1', () => { const { port } = s.address() as AddressInfo; s.close(() => res(port)); }); });
type Msg = Record<string, any>;
interface Srv { port: number; dir: string; proc: ChildProcess; stop: () => Promise<void>; url: (p: string) => string }
const running: Srv[] = [], dirs: string[] = [], socks: WebSocket[] = [];
afterEach(async () => { for (const w of socks.splice(0)) w.terminate(); for (const s of running.splice(0)) await s.stop(); for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

async function start(env: Record<string, string> = {}, dir?: string): Promise<Srv> {
  const d = dir ?? mkdtempSync(join(tmpdir(), 'bc-free-')); if (!dir) dirs.push(d);
  const port = await freePort();
  let err = '';
  const proc = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server/index.ts'], { cwd: ROOT, env: { ...process.env, PORT: String(port), DATA_DIR: d, ...env }, stdio: ['ignore', 'ignore', 'pipe'] });
  proc.stderr?.on('data', (x) => { err += String(x); });
  const srv: Srv = { port, dir: d, proc, url: (p) => `http://127.0.0.1:${port}${p}`, async stop() { if (proc.exitCode === null) { const done = new Promise((r) => proc.once('exit', r)); proc.kill(); await done; } } };
  running.push(srv);
  for (let i = 0; i < 100; i++) { try { if ((await fetch(srv.url('/api/health'))).ok) return srv; } catch { /* arrancando */ } if (proc.exitCode !== null) throw new Error('el servidor terminó: ' + err); await sleep(120); }
  throw new Error('el servidor no arranca: ' + err);
}
async function conn(srv: Srv, hello: Msg) {
  const ws = new WebSocket(`ws://127.0.0.1:${srv.port}/ws`); socks.push(ws);
  const msgs: Msg[] = []; ws.on('message', (d) => msgs.push(JSON.parse(String(d))));
  await new Promise((r, j) => { ws.once('open', r); ws.once('error', j); });
  ws.send(JSON.stringify(hello));
  let id = 0;
  const until = async (pred: (m: Msg) => boolean, ms = 5000): Promise<Msg> => { const t = Date.now(); for (;;) { const hit = [...msgs].reverse().find(pred); if (hit) return hit; if (Date.now() - t > ms) throw new Error('timeout; recibido: ' + JSON.stringify(msgs.map((m) => m.t === 'err' ? m : m.t))); await sleep(20); } };
  return {
    ws, msgs, until,
    call: async (m: Msg) => { const mine = ++id; ws.send(JSON.stringify({ ...m, id: mine })); return until((x) => x.t === 'ack' && x.id === mine); },
    state: () => [...msgs].reverse().find((m) => m.t === 'state')?.s,
    stateWhere: (pred: (s: Msg) => boolean) => until((m) => m.t === 'state' && pred(m.s)).then((m) => m.s),
  };
}
const http = async (srv: Srv, path: string, input?: unknown, token?: string) => {
  const r = await fetch(srv.url(path), { method: input === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json', 'x-token-response': '1', ...(token ? { 'x-student-session': token } : {}) }, ...(input === undefined ? {} : { body: JSON.stringify(input) }) });
  return { status: r.status, body: await r.json() as Msg };
};
const PW = 'correct-horse-battery';
const register = async (srv: Srv, alias: string, extra: Msg = {}) => (await http(srv, '/api/account/register', { alias, password: PW, ...extra })).body;
/** Respuesta correcta para una pregunta de opción múltiple vista por el alumno (las opciones llegan barajadas). */
const rightMc = (q: Msg) => { const b = bank.get(q.id)!; if (b.type !== 'mc') throw new Error('se esperaba mc: ' + b.type); return { choice: q.options.indexOf(b.options[b.answer]) }; };
type C = Awaited<ReturnType<typeof conn>>;


const createRoom = (s: Srv, input: Msg, token?: string) => http(s, '/api/play/room', input, token);
/** Todos los jugadores responden bien (si es opción múltiple) la pregunta abierta y votan para seguir. */
async function playUntilFinal(cs: C[]) {
  for (let k = 0; k < 300; k++) {
    const st = cs[0].state();
    if (st?.phase === 'final') return st;
    if (st?.phase === 'question' && st.q) {
      for (const c of cs) { const mine = c.state(); if (mine?.me?.state === 'idle' && mine.q?.id === st.q.id) await c.call({ t: 'answer', qid: st.q.id, a: bank.get(st.q.id)!.type === 'mc' ? rightMc(st.q) : {} }); }
    } else if (st && ['intro', 'reveal', 'roundEnd'].includes(st.phase)) {
      for (const c of cs) await c.call({ t: 'pnext' });
    }
    await sleep(40);
  }
  throw new Error('la partida no terminó: ' + cs[0].state()?.phase);
}

describe('crear y entrar sin profesor', () => {
  it('un invitado crea la sala con un endpoint de jugador; otro entra por código; empiezan al estar todos listos', async () => {
    const s = await start();
    const r = await createRoom(s, { game: 'blackcard', level: 'A1', topics: ['akkusativ'], name: 'Lola' });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ game: 'blackcard' });
    expect(r.body.code).toMatch(/^[A-Z2-9]{4}$/);
    const host = await conn(s, { t: 'hello', role: 'player', room: r.body.code, token: r.body.token });
    expect((await host.until((m) => m.t === 'welcome')).pid).toBe(r.body.pid);
    const ben = await conn(s, { t: 'hello', role: 'player', room: r.body.code, name: 'Ben <script>' });
    const bw = await ben.until((m) => m.t === 'welcome');
    expect(bw.profile).toMatch(/^guest_/);                                    // invitado: nada persistente
    const lobby = await host.stateWhere((x) => x.players.length === 2);
    expect(lobby.private).toMatchObject({ host: r.body.pid, game: 'blackcard', ready: [] });
    expect(lobby.players.map((p: Msg) => p.name).sort()).toEqual(['Ben script', 'Lola']);
    expect((await host.call({ t: 'pnext' })).ok).toBe(true);
    expect(host.state().phase).toBe('lobby');
    expect((await ben.call({ t: 'pnext' })).ok).toBe(true);
    await host.stateWhere((x) => x.phase === 'intro');
    // ya empezó: nadie más entra
    const late = await conn(s, { t: 'hello', role: 'player', room: r.body.code, name: 'Tarde' });
    expect((await late.until((m) => m.t === 'err')).msg).toMatch(/ya ha empezado/);
  });

  it('con cuenta: se muestra su alias; la misma cuenta no ocupa dos plazas; sesión caducada → 401', async () => {
    const s = await start();
    const ana = await register(s, 'Ana_Lee'), ben = await register(s, 'Ben_Box');
    const r = await createRoom(s, { game: 'jenga', level: 'A1', topics: ['akkusativ'], name: 'esto se ignora' }, ana.token);
    const host = await conn(s, { t: 'hello', role: 'player', room: r.body.code, token: r.body.token });
    await host.until((m) => m.t === 'welcome');
    const dup = await conn(s, { t: 'hello', role: 'player', room: r.body.code, session: ana.token });
    expect((await dup.until((m) => m.t === 'err')).msg).toMatch(/con tu cuenta/);
    const b = await conn(s, { t: 'hello', role: 'player', room: r.body.code, session: ben.token, name: 'NombreReal' });
    expect((await b.until((m) => m.t === 'welcome')).profile).toMatch(/^acc_/);
    expect((await host.stateWhere((x) => x.players.length === 2)).players.map((p: Msg) => p.name).sort()).toEqual(['Ana_Lee', 'Ben_Box']);
    expect((await createRoom(s, { game: 'blackcard' }, 'dts_caducada')).status).toBe(401);
  });

  it('validación y límites: juego/nivel desconocidos, combinación sin preguntas, cupo por IP', async () => {
    const s = await start({ FREE_PRIVATE_PER_HOUR: '2' });
    expect((await createRoom(s, { game: 'deck' })).status).toBe(400);
    expect((await createRoom(s, { game: 'blackcard', level: 'C2' })).status).toBe(400);
    expect((await createRoom(s, { game: 'blackcard', level: 'A1', topics: ['praep'] })).status).toBe(400);
    expect((await createRoom(s, { game: 'blackcard' })).status).toBe(200);
    expect((await createRoom(s, { game: 'jenga' })).status).toBe(200);
    expect((await createRoom(s, { game: 'blackcard' })).status).toBe(429);
  });
});

describe('roles: una sala privada no da poderes de profesor a nadie', () => {
  it('nadie entra como profesor (ni con el token del anfitrión ni con una sesión de alumno), y ningún ctl vale', async () => {
    const s = await start();
    const acc = await register(s, 'Ana_Lee');
    const r = await createRoom(s, { game: 'blackcard' }, acc.token);
    for (const hello of [{ token: r.body.token }, { teacherKey: acc.token }, {}]) {
      const t = await conn(s, { t: 'hello', role: 'teacher', room: r.body.code, ...hello });
      expect((await t.until((m) => m.t === 'err')).fatal).toBe(true);
    }
    const host = await conn(s, { t: 'hello', role: 'player', room: r.body.code, token: r.body.token });
    await host.until((m) => m.t === 'welcome');
    for (const a of [{ k: 'next' }, { k: 'points', pid: r.body.pid, delta: 50 }, { k: 'give', pid: r.body.pid, item: 'blackcard' }, { k: 'skip' }, { k: 'kick', pid: r.body.pid }]) {
      expect((await host.call({ t: 'ctl', a })).ok, JSON.stringify(a)).toBe(false);
    }
    expect(host.state().players[0]).toMatchObject({ score: 0, items: 0 });
  });
  it('solo el anfitrión expulsa, y solo en el vestíbulo', async () => {
    const s = await start();
    const r = await createRoom(s, { game: 'blackcard', name: 'Host' });
    const host = await conn(s, { t: 'hello', role: 'player', room: r.body.code, token: r.body.token }); await host.until((m) => m.t === 'welcome');
    const a = await conn(s, { t: 'hello', role: 'player', room: r.body.code, name: 'Ana' }); const aw = await a.until((m) => m.t === 'welcome');
    const b = await conn(s, { t: 'hello', role: 'player', room: r.body.code, name: 'Ben' }); const bw = await b.until((m) => m.t === 'welcome');
    expect((await a.call({ t: 'pkick', pid: bw.pid })).ok).toBe(false);
    expect((await host.call({ t: 'pkick', pid: bw.pid })).ok).toBe(true);
    await host.stateWhere((x) => x.players.length === 2);
    void aw;
  });
  it('TEACHER_AUTH=required (fail-closed): no se crean salas de profesor, pero sí salas privadas de alumnos', async () => {
    const s = await start({ TEACHER_AUTH: 'required' });
    const t = await conn(s, { t: 'hello', role: 'teacher', create: true });
    expect((await t.until((m) => m.t === 'err')).fatal).toBe(true);
    expect((await createRoom(s, { game: 'jenga' })).status).toBe(200);
  });
});

describe('partida completa, reconexión y persistencia', () => {
  it('BlackCard privada de principio a fin sin profesor; los resultados de la cuenta quedan guardados', async () => {
    const s = await start();
    const ana = await register(s, 'Ana_Lee');
    const r = await createRoom(s, { game: 'blackcard', level: 'A1', topics: ['akkusativ'] }, ana.token);
    const host = await conn(s, { t: 'hello', role: 'player', room: r.body.code, token: r.body.token }); await host.until((m) => m.t === 'welcome');
    const ben = await conn(s, { t: 'hello', role: 'player', room: r.body.code, name: 'Ben' }); await ben.until((m) => m.t === 'welcome');
    await host.call({ t: 'pnext' }); await ben.call({ t: 'pnext' });
    const final = await playUntilFinal([host, ben]);
    expect(final.final.players).toHaveLength(2);
    const p = (await http(s, '/api/account/progress', undefined, ana.token)).body;
    expect(p.activities).toEqual([expect.objectContaining({ game: 'blackcard', level: 'A1' })]);
    expect(p.activities[0].total).toBeGreaterThanOrEqual(8);
    expect(p.activities[0].correct).toBeGreaterThan(0);
    expect(p.activities[0].correct).toBeLessThanOrEqual(p.activities[0].total);
    expect(p.topics.find((t: Msg) => t.topic === 'akkusativ').attempts).toBe(p.activities[0].total);
  }, 60_000);

  it('reconexión con token a mitad de partida y recuperación tras reiniciar el servidor', async () => {
    const s = await start();
    const r = await createRoom(s, { game: 'blackcard', level: 'A1', topics: ['akkusativ'], name: 'Host' });
    const host = await conn(s, { t: 'hello', role: 'player', room: r.body.code, token: r.body.token }); await host.until((m) => m.t === 'welcome');
    const ben = await conn(s, { t: 'hello', role: 'player', room: r.body.code, name: 'Ben' }); const bw = await ben.until((m) => m.t === 'welcome');
    await host.call({ t: 'pnext' }); await ben.call({ t: 'pnext' });
    await host.stateWhere((x) => x.phase === 'intro');
    ben.ws.terminate(); await sleep(150);
    const ben2 = await conn(s, { t: 'hello', role: 'player', room: r.body.code, token: bw.token });
    expect((await ben2.until((m) => m.t === 'welcome')).pid).toBe(bw.pid);
    await ben2.stateWhere((x) => x.private?.game === 'blackcard' && x.phase !== 'lobby');
    host.ws.terminate(); ben2.ws.terminate();
    await s.stop();
    const s2 = await start({}, s.dir);
    const back = await conn(s2, { t: 'hello', role: 'player', room: r.body.code, token: r.body.token });
    expect((await back.until((m) => m.t === 'welcome')).pid).toBe(r.body.pid);
    const st = await back.stateWhere((x) => !!x.private);
    expect(st.private.host).toBe(r.body.pid);
    expect(st.phase).not.toBe('lobby');
  }, 30_000);
});
