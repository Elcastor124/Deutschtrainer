// Frontera de privilegios y robustez HTTP. Ver SECURITY_AUDIT.md.
// Un alumno nunca puede ejecutar acciones del profesor ni alterar puntos, inventario o estado; el servidor decide siempre.
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { resolveStatic } from '../server/static.ts';

const ROOT = resolve(import.meta.dirname, '..');
const PORT = 4600 + Math.floor(Math.random() * 300);
const DATA = mkdtempSync(join(tmpdir(), 'bc-sec-'));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let server: ChildProcess;
let stderr = '';
const alive = async () => { try { return (await fetch(`http://127.0.0.1:${PORT}/api/health`)).ok; } catch { return false; } };

type Msg = Record<string, any>;
async function conn(hello: Msg) {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  const msgs: Msg[] = [];
  ws.on('message', (d) => msgs.push(JSON.parse(String(d))));
  await new Promise((r, j) => { ws.once('open', r); ws.once('error', j); });
  ws.send(JSON.stringify(hello));
  let id = 0;
  const until = async (pred: (m: Msg) => boolean, ms = 4000): Promise<Msg> => {
    const t = Date.now();
    for (;;) {
      const hit = msgs.find(pred);
      if (hit) return hit;
      if (Date.now() - t > ms) throw new Error('timeout; recibido: ' + JSON.stringify(msgs));
      await sleep(30);
    }
  };
  return {
    msgs, close: () => ws.close(), until,
    /** Envía y espera el ack de ese mensaje. */
    async call(m: Msg): Promise<Msg> { const mine = ++id; ws.send(JSON.stringify({ ...m, id: mine })); return until((x) => x.t === 'ack' && x.id === mine); },
    state: () => [...msgs].reverse().find((m) => m.t === 'state')?.s,
  };
}

beforeAll(async () => {
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server/index.ts'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), DATA_DIR: DATA }, stdio: ['ignore', 'ignore', 'pipe'] });
  server.stderr?.on('data', (d) => { stderr += String(d); });
  for (let i = 0; i < 80; i++) { if (await alive()) return; await sleep(150); }
  throw new Error('el servidor no arranca: ' + stderr);
}, 20_000);
afterAll(async () => {
  if (server.exitCode === null) { const done = new Promise((r) => server.once('exit', r)); server.kill(); await done; }
  rmSync(DATA, { recursive: true, force: true });
});

describe('resolveStatic', () => {
  const root = '/srv/app/dist';
  it('acepta rutas normales y la raíz', () => {
    expect(resolveStatic(root, '/')).toBe('/srv/app/dist/');
    expect(resolveStatic(root, '/assets/a%20b.js')).toBe('/srv/app/dist/assets/a b.js');
  });
  it('rechaza % mal formado, bytes nulos y salidas de la raíz (incluido un hermano con el mismo prefijo)', () => {
    for (const p of ['/%E0%A4%A', '/%', '/a%00b', '/../secret', '/..%2Fsecret', '/..%2Fdist-evil/x', '/%2e%2e/%2e%2e/etc/passwd', '/a/../../dist2/x']) expect(resolveStatic(root, p), p).toBeNull();
  });
});

describe('HTTP', () => {
  it('una URL malformada no tumba el servidor y devuelve 400', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/%E0%A4%A`);
    expect([400, 503]).toContain(res.status); // 503 si dist/ no está compilado: en ambos casos el proceso sigue vivo
    expect(await alive()).toBe(true);
    expect(stderr).not.toMatch(/URIError/);
  });
  it('envía cabeceras de endurecimiento', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/health`);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('referrer-policy')).toBeTruthy();
  });
});

describe('sala de clase: el servidor decide', () => {
  async function classroom() {
    const t = await conn({ t: 'hello', role: 'teacher', create: true });
    const tw = await t.until((m) => m.t === 'welcome');
    const a = await conn({ t: 'hello', role: 'player', room: tw.room, name: 'Ana', profile: 'profile-sec-ana' });
    const aw = await a.until((m) => m.t === 'welcome');
    const b = await conn({ t: 'hello', role: 'player', room: tw.room, name: 'Ben', profile: 'profile-sec-ben' });
    const bw = await b.until((m) => m.t === 'welcome');
    await t.until((m) => m.t === 'state' && m.s.players?.length === 2);
    return { t, tw, a, aw, b, bw, close: () => { t.close(); a.close(); b.close(); } };
  }

  it('un alumno no puede enviar ninguna acción de profesor (puntos, objetos, cofres, bloques, expulsiones, tareas)', async () => {
    const r = await classroom();
    const actions = [
      { k: 'points', pid: r.aw.pid, delta: 50 }, { k: 'give', pid: r.aw.pid, item: 'blackcard' }, { k: 'chest', pid: r.aw.pid, tier: 'black' },
      { k: 'block', block: 'r1' }, { k: 'next' }, { k: 'skip' }, { k: 'lock' }, { k: 'judgeAll', ok: true }, { k: 'judge', pid: r.aw.pid, ok: true },
      { k: 'items', on: true }, { k: 'kick', pid: r.bw.pid }, { k: 'addTime', s: 999 }, { k: 'task', op: 'skip' }, { k: 'pause' },
    ];
    for (const a of actions) {
      const ack = await r.a.call({ t: 'ctl', a });
      expect(ack.ok, JSON.stringify(a)).toBe(false);
    }
    const s = r.t.state();
    expect(s.players.find((p: Msg) => p.id === r.aw.pid)).toMatchObject({ score: 0, items: 0, chests: 0 });
    expect(s.players).toHaveLength(2);
    expect(s.phase).toBe('lobby');
    r.close();
  });

  it('no se puede entrar como profesor sin su token (ni con el de un alumno ni con uno inventado)', async () => {
    const r = await classroom();
    for (const token of [undefined, '', 'x', r.aw.token, r.bw.token, '0'.repeat(32)]) {
      const intruder = await conn({ t: 'hello', role: 'teacher', room: r.tw.room, token });
      const err = await intruder.until((m) => m.t === 'err');
      expect(err.fatal).toBe(true);
      expect(intruder.msgs.some((m) => m.t === 'welcome')).toBe(false);
      intruder.close();
    }
    r.close();
  });

  it('el alumno no recibe soluciones ni el token del profesor en su vista', async () => {
    const r = await classroom();
    const raw = JSON.stringify(r.a.msgs);
    expect(raw).not.toContain(r.tw.token);
    expect(r.a.state().teacher).toBeUndefined();
    expect(JSON.stringify(r.a.state())).not.toContain('teacherToken');
    r.close();
  });

  it('un alumno no puede fabricarse objetos, abrir cofres ajenos ni responder fuera de turno', async () => {
    const r = await classroom();
    expect((await r.a.call({ t: 'item', item: 'blackcard' })).ok).toBe(false);
    expect((await r.a.call({ t: 'item', item: 'constructor' })).ok).toBe(false);
    expect((await r.a.call({ t: 'open', chest: 'nope' })).ok).toBe(false);
    expect((await r.a.call({ t: 'answer', qid: 'no-existe', a: { choice: 0 } })).ok).toBe(false);
    expect((await r.a.call({ t: 'pnext' })).ok).toBe(false);
    expect((await r.a.call({ t: 'pull', level: 0, slot: 0 })).ok).toBe(false);
    expect((await r.a.call({ t: 'text', text: 'hola', done: true })).ok).toBe(false);
    expect(r.t.state().players.find((p: Msg) => p.id === r.aw.pid)).toMatchObject({ score: 0, items: 0 });
    r.close();
  });

  it('el profesor sí puede (control positivo) y el cambio de puntos queda acotado', async () => {
    const r = await classroom();
    expect((await r.t.call({ t: 'ctl', a: { k: 'points', pid: r.aw.pid, delta: 9999 } })).ok).toBe(true);
    await r.t.until((m) => m.t === 'state' && m.s.players.find((p: Msg) => p.id === r.aw.pid)?.score === 50);
    r.close();
  });
});
