// Modo libre contra un servidor real: BlackCard y Jenga en solitario sin profesor, cuentas e invitados, persistencia,
// reconexión y separación de roles. Los profesores no se conectan en ningún momento de este fichero.
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import type { AddressInfo } from 'node:net';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
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
  const r = await fetch(srv.url(path), { method: input === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json', ...(token ? { 'x-student-session': token } : {}) }, ...(input === undefined ? {} : { body: JSON.stringify(input) }) });
  return { status: r.status, body: await r.json() as Msg };
};
const PW = 'correct-horse-battery';
const register = async (srv: Srv, alias: string, extra: Msg = {}) => (await http(srv, '/api/account/register', { alias, password: PW, ...extra })).body;
/** Respuesta correcta para una pregunta de opción múltiple vista por el alumno (las opciones llegan barajadas). */
const rightMc = (q: Msg) => { const b = bank.get(q.id)!; if (b.type !== 'mc') throw new Error('se esperaba mc: ' + b.type); return { choice: q.options.indexOf(b.options[b.answer]) }; };
type C = Awaited<ReturnType<typeof conn>>;

/** Responde bien n preguntas de BlackCard solitario avanzando con «siguiente». Devuelve los ids vistos. */
async function playBlackcard(c: C, n: number, seen: string[] = []) {
  for (let i = 0; i < n; i++) {
    const s = await c.stateWhere((x) => x.phase === 'question' && !seen.includes(x.q.id));
    seen.push(s.q.id);
    expect((await c.call({ t: 'answer', qid: s.q.id, a: rightMc(s.q) })).ok).toBe(true);
    await c.stateWhere((x) => x.phase === 'reveal');
    if (i < n - 1) expect((await c.call({ t: 'pnext' })).ok).toBe(true);
  }
  return seen;
}

describe('BlackCard solitario (sin profesor)', () => {
  it('invitado: juega con nivel y temas elegidos, recibe corrección y NO se guarda nada', async () => {
    const s = await start();
    const c = await conn(s, { t: 'hello', role: 'practice', free: true, game: 'blackcard', level: 'A1', topics: ['akkusativ'], size: 10, name: 'Lola' });
    const w = await c.until((m) => m.t === 'welcome');
    expect(w.role).toBe('practice');
    expect(w.profile).toMatch(/^guest_/);
    expect(w.profileCode).toBe('');                                   // un invitado no tiene código de recuperación
    const seen = await playBlackcard(c, 3);
    for (const id of seen) { const q = bank.get(id)!; expect(q.topic).toBe('akkusativ'); expect(q.diff).toBe('easy'); } // nivel A1 = banda «fácil»
    const reveal = c.state();
    expect(reveal.reveal.results[reveal.me.id].status).toBe('correct');
    expect(reveal.reveal.explain.length).toBeGreaterThan(0);          // explicación tras responder
    c.ws.terminate(); await s.stop();
    const state = existsSync(join(s.dir, 'state.json')) ? JSON.parse(readFileSync(join(s.dir, 'state.json'), 'utf8')) : { profiles: {} };
    expect(Object.keys(state.profiles ?? {}).filter((k) => k.startsWith('guest_'))).toEqual([]);
    const prog = existsSync(join(s.dir, 'progress.json')) ? JSON.parse(readFileSync(join(s.dir, 'progress.json'), 'utf8')).events : [];
    expect(prog).toEqual([]);                                         // ni progreso ni puntos asociados a una identidad
  });

  it('cuenta: sesión completa → resultados, temas y puntos guardados por el servidor y recuperables tras reiniciar', async () => {
    const s = await start();
    const acc = await register(s, 'Ana_Lee', { rankingOptIn: true });
    const c = await conn(s, { t: 'hello', role: 'practice', free: true, game: 'blackcard', level: 'A1', topics: ['akkusativ'], size: 10, session: acc.token });
    const w = await c.until((m) => m.t === 'welcome');
    expect(w.profile).toMatch(/^acc_/);
    expect((await c.stateWhere((x) => x.me?.name === 'Ana_Lee')).me.name).toBe('Ana_Lee'); // se muestra el alias, no un nombre escrito
    await playBlackcard(c, 10);
    await c.stateWhere((x) => x.phase === 'reveal');
    expect((await c.call({ t: 'pnext' })).ok).toBe(true);
    await c.stateWhere((x) => x.phase === 'final');
    const p = (await http(s, '/api/account/progress', undefined, acc.token)).body;
    expect(p.activities).toHaveLength(1);
    expect(p.activities[0]).toMatchObject({ game: 'blackcard', level: 'A1', total: 10, correct: 10 });
    expect(p.topics).toEqual([expect.objectContaining({ topic: 'akkusativ', attempts: 10, correct: 10, accuracy: 1 })]);
    expect(p.weekPoints).toBe(10 * 10 + 5 + 4);                       // 10 aciertos + bonus diario + actividad A1; nada por tiempo
    expect(p.rank).toBe(1);
    c.ws.terminate();
    await s.stop();
    const s2 = await start({}, s.dir);                                // reinicio del servidor
    const login = await http(s2, '/api/account/login', { alias: 'ana_lee', password: PW });
    expect(login.status).toBe(200);
    const again = (await http(s2, '/api/account/progress', undefined, login.body.token)).body;
    expect(again.activities).toHaveLength(1); expect(again.weekPoints).toBe(p.weekPoints);
    expect((await http(s2, '/api/play/leaderboard')).body.entries).toEqual([{ rank: 1, alias: 'Ana_Lee', points: p.weekPoints }]);
  }, 30_000);

  it('reconexión: tras cortar la conexión se reanuda la misma práctica con su token, sin duplicar puntos', async () => {
    const s = await start();
    const acc = await register(s, 'Ana_Lee');
    const c = await conn(s, { t: 'hello', role: 'practice', free: true, game: 'blackcard', level: 'A1', topics: ['akkusativ'], size: 10, session: acc.token });
    const w = await c.until((m) => m.t === 'welcome');
    await playBlackcard(c, 2);
    const done = c.state().practice.done;
    c.ws.terminate(); await sleep(150);
    const c2 = await conn(s, { t: 'hello', role: 'practice', free: true, room: w.room, token: w.token, topics: ['akkusativ'] });
    const w2 = await c2.until((m) => m.t === 'welcome');
    expect(w2.room).toBe(w.room); expect(w2.profile).toBe(w.profile);
    const st = await c2.stateWhere((x) => x.phase === 'reveal' || x.phase === 'question');
    expect(st.practice.done).toBe(done);
    const before = (await http(s, '/api/account/progress', undefined, acc.token)).body.weekPoints;
    await sleep(100);
    expect((await http(s, '/api/account/progress', undefined, acc.token)).body.weekPoints).toBe(before);
    // un tercero NO puede adoptar esa sala con otro token ni con un perfil ajeno
    const evil = await conn(s, { t: 'hello', role: 'practice', free: true, room: w.room, token: 'x'.repeat(32), profile: w.profile });
    const e = await evil.until((m) => m.t === 'welcome');
    expect(e.room).not.toBe(w.room); expect(e.profile).not.toBe(w.profile);
  }, 30_000);

  it('una sesión inválida o caducada no se degrada a invitado; una combinación sin preguntas suficientes se avisa', async () => {
    const s = await start();
    const bad = await conn(s, { t: 'hello', role: 'practice', free: true, game: 'blackcard', level: 'A1', session: 'dts_caducada' });
    expect(await bad.until((m) => m.t === 'err')).toMatchObject({ fatal: true });
    const tiny = await conn(s, { t: 'hello', role: 'practice', free: true, game: 'blackcard', level: 'A1', topics: ['praep'] });
    expect((await tiny.until((m) => m.t === 'err')).msg).toMatch(/pocas preguntas/);
  });
});

describe('Wort-Jenga solitario', () => {
  it('sin profesor: una torre para un jugador, sin preguntas orales, y la actividad completada puntúa en el servidor', async () => {
    const s = await start();
    const acc = await register(s, 'Ana_Lee');
    const c = await conn(s, { t: 'hello', role: 'practice', free: true, game: 'jenga', level: 'A1', topics: ['akkusativ'], session: acc.token });
    await c.until((m) => m.t === 'welcome');
    for (let i = 0; i < 8; i++) {
      const st = await c.stateWhere((x) => x.phase === 'task' && x.task?.kind === 'jenga' && x.task.stage === 'answer' && x.task.q && x.task.q.id !== undefined && (i === 0 || x.task.last));
      expect(st.players).toHaveLength(1);
      expect(st.task.speak).toBeNull();                              // nada que juzgar: no hay profesor
      expect(bank.get(st.task.q.id)!.diff).toBe('easy');
      expect((await c.call({ t: 'answer', qid: st.task.q.id, a: rightMc(st.task.q) })).ok).toBe(true);
      const pulled = await c.stateWhere((x) => x.task?.stage === 'pull');
      expect((await c.call({ t: 'pull', level: i, slot: 0 })).ok).toBe(true);   // un lado por piso: la torre se mantiene estable
      if (i < 7) await c.stateWhere((x) => x.task?.stage === 'answer' && x.task.q?.id !== st.task.q.id);
      void pulled;
    }
    const p = (await http(s, '/api/account/progress', undefined, acc.token)).body;
    expect(p.activities).toHaveLength(1);
    expect(p.activities[0]).toMatchObject({ game: 'jenga', level: 'A1', total: 8, correct: 8 });
    expect(p.weekPoints).toBe(8 * 10 + 5 + 4);
    // un jugador no puede hacerse con los controles del profesor de su torre
    for (const op of ['skip', 'reset', 'star', 'judge']) expect((await c.call({ t: 'ctl', a: { k: 'task', op } })).ok, op).toBe(false);
  }, 40_000);

  it('invitado en Jenga: juega igual y no se guarda nada', async () => {
    const s = await start();
    const c = await conn(s, { t: 'hello', role: 'practice', free: true, game: 'jenga', level: 'A1', topics: ['akkusativ'], name: 'Zoe' });
    const w = await c.until((m) => m.t === 'welcome'); expect(w.profile).toMatch(/^guest_/);
    const st = await c.stateWhere((x) => x.task?.kind === 'jenga' && x.task.q);
    expect((await c.call({ t: 'answer', qid: st.task.q.id, a: rightMc(st.task.q) })).ok).toBe(true);
    c.ws.terminate(); await s.stop();
    const prog = existsSync(join(s.dir, 'progress.json')) ? JSON.parse(readFileSync(join(s.dir, 'progress.json'), 'utf8')).events : [];
    expect(prog).toEqual([]);
  });
});

describe('roles y compatibilidad con las clases tradicionales', () => {
  it('con TEACHER_AUTH=required (fail-closed) el modo libre funciona y nadie crea salas de profesor desde él', async () => {
    const s = await start({ TEACHER_AUTH: 'required' });            // sin profesores registrados
    const teacher = await conn(s, { t: 'hello', role: 'teacher', create: true });
    expect(await teacher.until((m) => m.t === 'err')).toMatchObject({ fatal: true });
    const acc = await register(s, 'Ana_Lee');
    const asTeacher = await conn(s, { t: 'hello', role: 'teacher', create: true, teacherKey: acc.token }); // sesión de alumno ≠ clave de profesor
    expect((await asTeacher.until((m) => m.t === 'err')).fatal).toBe(true);
    const c = await conn(s, { t: 'hello', role: 'practice', free: true, game: 'blackcard', level: 'A1', topics: ['akkusativ'], session: acc.token });
    await c.until((m) => m.t === 'welcome');
    // dentro de su sala libre, ninguna acción de profesor vale
    for (const a of [{ k: 'points', pid: 'x', delta: 50 }, { k: 'next' }, { k: 'block', block: 'r1' }, { k: 'give', pid: 'x', item: 'blackcard' }]) expect((await c.call({ t: 'ctl', a })).ok).toBe(false);
    expect(c.state().players[0].score).toBe(0);
  });
  it('una clase tradicional sigue igual: el profesor crea sala, el alumno se une y la sesión no depende de cuentas', async () => {
    const s = await start();
    const t = await conn(s, { t: 'hello', role: 'teacher', create: true, topics: ['dativ'] });
    const tw = await t.until((m) => m.t === 'welcome');
    const p = await conn(s, { t: 'hello', role: 'player', room: tw.room, name: 'Ana', profile: 'profile-class-ana1' });
    expect((await p.until((m) => m.t === 'welcome')).role).toBe('player');
    expect((await t.call({ t: 'ctl', a: { k: 'block', block: 'r2' } })).ok).toBe(true);
    // un alumno con cuenta puede entrar a una clase, pero su id de cuenta no se le puede imponer a un cliente legacy
    const acc = await register(s, 'Ben_Box');
    const hack = await conn(s, { t: 'hello', role: 'practice', name: 'X', profile: 'acc_' + 'f'.repeat(32) });
    const hw = await hack.until((m) => m.t === 'welcome');
    expect(hw.profile).not.toBe('acc_' + 'f'.repeat(32));            // un cliente no adopta ids reservados diciéndolos
    void acc;
  });
  it('el /practica antiguo (perfil de dispositivo) conserva su comportamiento', async () => {
    const s = await start();
    const c = await conn(s, { t: 'hello', role: 'practice', name: 'Ana', profile: 'profile-legacy-001', topics: ['dativ'], size: 10 });
    const w = await c.until((m) => m.t === 'welcome');
    expect(w.profile).toBe('profile-legacy-001');
    expect(w.profileCode).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);            // sigue habiendo código de dispositivo
  });
});
