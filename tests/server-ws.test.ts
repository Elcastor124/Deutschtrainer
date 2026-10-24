// Servidor real (proceso Node) + WebSocket: mensajes malformados no lo tumban, la práctica se recupera tras un reinicio
// y el profesor puede crear salas por temas (BlackCard) o directamente en el Wort-Jenga.
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { loadBank } from '../server/bank/index.ts';

const ROOT = resolve(import.meta.dirname, '..');
const PORT = 4300 + Math.floor(Math.random() * 300);
const DATA = mkdtempSync(join(tmpdir(), 'bc-srv-'));
const bank = loadBank();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let server: ChildProcess;
let stderr = '';

async function start() {
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server/index.ts'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), DATA_DIR: DATA }, stdio: ['ignore', 'ignore', 'pipe'] });
  server.stderr?.on('data', (d) => { stderr += String(d); });
  for (let i = 0; i < 80; i++) { if (await alive()) return; await sleep(150); }
  throw new Error('el servidor no arranca: ' + stderr);
}
async function stop() {
  if (server.exitCode !== null) return;
  const done = new Promise((r) => server.once('exit', r));
  server.kill();
  await done;
}
async function alive() { try { return (await fetch(`http://127.0.0.1:${PORT}/api/health`)).ok; } catch { return false; } }

type Msg = Record<string, any>;
async function conn(hello: Msg) {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  const msgs: Msg[] = [];
  const waiters = new Set<() => void>();
  ws.on('message', (d) => { msgs.push(JSON.parse(String(d))); for (const w of waiters) w(); });
  await new Promise((r, j) => { ws.once('open', r); ws.once('error', j); });
  ws.send(JSON.stringify(hello));
  let id = 0;
  const c = {
    ws, msgs,
    send: (m: Msg) => ws.send(JSON.stringify({ ...m, id: ++id })),
    raw: (s: string) => ws.send(s),
    async wait(pred: (m: Msg) => boolean, ms = 4000): Promise<Msg> {
      const t = Date.now();
      for (;;) {
        const hit = msgs.find(pred);
        if (hit) return hit;
        if (Date.now() - t > ms) throw new Error('timeout; recibido: ' + JSON.stringify(msgs.map((m) => m.t)));
        await new Promise<void>((r) => { const w = () => { waiters.delete(w); r(); }; waiters.add(w); setTimeout(w, 100); });
      }
    },
    last: () => [...msgs].reverse().find((m) => m.t === 'state')?.s,
    close: () => ws.close(),
  };
  return c;
}

beforeAll(start, 20_000);
afterAll(async () => { await stop(); rmSync(DATA, { recursive: true, force: true }); });

describe('servidor robusto', () => {
  it('mensajes malformados (ctl sin acción, hello raro, JSON con tipos erróneos) no tumban el proceso', async () => {
    const t = await conn({ t: 'hello', role: 'teacher', create: true });
    await t.wait((m) => m.t === 'welcome');
    for (const bad of [{ t: 'ctl', a: null }, { t: 'ctl' }, { t: 'ctl', a: { k: 'task', op: null } }, { t: 'answer', qid: {}, a: 'x' }, { t: 'item', item: null }]) t.send(bad);
    t.raw('null'); t.raw('[]'); t.raw('{"t":"hello","role":"player","room":{}}');
    await sleep(400);
    expect(await alive()).toBe(true);
    const p = await conn({ t: 'hello', role: 'practice', name: { x: 1 }, profile: 42, topics: 'dativ', size: '__proto__' });
    await p.wait((m) => m.t === 'state');
    expect(await alive()).toBe(true);
    t.close(); p.close();
    expect(stderr).not.toMatch(/TypeError/);
  });
});

describe('práctica tras un reinicio del servidor', () => {
  it('reanuda con el token; si la sala ya no existe empieza otra con aviso y conserva perfil, nombre y temas', async () => {
    const profile = 'profile-restart-test';
    const a = await conn({ t: 'hello', role: 'practice', name: 'Ana', profile, topics: ['dativ'], size: 10 });
    const w = await a.wait((m) => m.t === 'welcome');
    const s1 = (await a.wait((m) => m.t === 'state')).s;
    expect(s1.qTotal).toBe(10);
    a.close();
    // recarga normal
    const b = await conn({ t: 'hello', role: 'practice', room: w.room, token: w.token, profile, name: 'Ana', topics: ['dativ'], size: 10 });
    const wb = await b.wait((m) => m.t === 'welcome');
    expect(wb.room).toBe(w.room);
    expect(wb.notice).toBeUndefined();
    b.close();
    // sala desaparecida (como tras reiniciar Render sin disco)
    const c = await conn({ t: 'hello', role: 'practice', room: 'PZZZZZ', token: 'gone', profile, name: 'Ana', topics: ['dativ'], size: 10 });
    const wc = await c.wait((m) => m.t === 'welcome');
    expect(wc.room).not.toBe('PZZZZZ');
    expect(wc.profile).toBe(profile);
    expect(wc.notice).toMatch(/nueva/);
    const st = (await c.wait((m) => m.t === 'state')).s;
    expect(st.phase).toBe('question');
    expect(st.me.name).toBe('Ana');
    expect(bank.get(st.q.id)!.topic).toBe('dativ');
    c.close();
  });
});

describe('juegos por temas', () => {
  it('sala BlackCard con temas: las preguntas de las rondas son de esos temas', async () => {
    const t = await conn({ t: 'hello', role: 'teacher', create: true, topics: ['dativ', 'akkusativ'] });
    const w = await t.wait((m) => m.t === 'welcome');
    const st = (await t.wait((m) => m.t === 'state')).s;
    expect(st.topics).toEqual(['dativ', 'akkusativ']);
    const p = await conn({ t: 'hello', role: 'player', room: w.room, name: 'Ana', profile: 'profile-topic-test' });
    await p.wait((m) => m.t === 'welcome');
    t.send({ t: 'ctl', a: { k: 'block', block: 'r2' } });
    await t.wait((m) => m.t === 'state' && m.s.phase === 'intro' && m.s.block === 'r2');
    t.send({ t: 'ctl', a: { k: 'next' } });
    const q = (await t.wait((m) => m.t === 'state' && m.s.phase === 'question')).s;
    expect(['dativ', 'akkusativ']).toContain(bank.get(q.q.id)!.topic);
    expect(q.teacher.queueLeft).toBeGreaterThan(3);
    t.close(); p.close();
  });

  it('sala Wort-Jenga directa: el lobby lleva al Jenga y las preguntas son de los temas elegidos', async () => {
    const t = await conn({ t: 'hello', role: 'teacher', create: true, topics: ['perfekt'], start: 'jenga' });
    const w = await t.wait((m) => m.t === 'welcome');
    const st0 = (await t.wait((m) => m.t === 'state')).s;
    expect(st0.phase).toBe('lobby');
    expect(st0.start).toBe('jenga');
    const p = await conn({ t: 'hello', role: 'player', room: w.room, name: 'Ana', profile: 'profile-jenga-test' });
    await p.wait((m) => m.t === 'welcome');
    t.send({ t: 'ctl', a: { k: 'next' } });
    const st = (await t.wait((m) => m.t === 'state' && m.s.phase === 'task')).s;
    expect(st.block).toBe('jenga');
    expect(st.task.kind).toBe('jenga');
    // Varias preguntas: todas de Perfekt (o pregunta oral).
    for (let k = 0; k < 6; k++) {
      const s = t.last();
      if (s.task.q) expect(bank.get(s.task.q.id)!.topic).toBe('perfekt');
      t.send({ t: 'ctl', a: { k: 'task', op: 'skip' } });
      await sleep(120);
    }
    t.close(); p.close();
  });
});
