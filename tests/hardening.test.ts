// Endurecimiento fase 2 contra servidores reales (proceso Node + WebSocket + HTTP):
// límites de creación, bloqueo de códigos de alumno, credenciales de profesor, recuperación de sesión y cerradura de instancia.
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { TeacherDirectory } from '../server/teacher-auth.ts';

const ROOT = resolve(import.meta.dirname, '..');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Msg = Record<string, any>;
interface Srv { port: number; dir: string; proc: ChildProcess; stderr: () => string; stop: () => Promise<void>; url: (p: string) => string }
const running: Srv[] = [], dirs: string[] = [], socks: WebSocket[] = [];
afterEach(async () => { for (const w of socks.splice(0)) w.terminate(); for (const s of running.splice(0)) await s.stop(); for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

async function start(env: Record<string, string> = {}, dir?: string, opts: { expectExit?: boolean } = {}): Promise<Srv> {
  const d = dir ?? mkdtempSync(join(tmpdir(), 'bc-hard-'));
  if (!dir) dirs.push(d);
  const port = 4900 + Math.floor(Math.random() * 900);
  let err = '';
  const proc = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server/index.ts'], { cwd: ROOT, env: { ...process.env, PORT: String(port), DATA_DIR: d, ...env }, stdio: ['ignore', 'ignore', 'pipe'] });
  proc.stderr?.on('data', (x) => { err += String(x); });
  const srv: Srv = {
    port, dir: d, proc, stderr: () => err, url: (p) => `http://127.0.0.1:${port}${p}`,
    async stop() { if (proc.exitCode === null) { const done = new Promise((r) => proc.once('exit', r)); proc.kill(); await done; } },
  };
  running.push(srv);
  if (opts.expectExit) return srv;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(srv.url('/api/health'))).ok) return srv; } catch { /* arrancando */ }
    if (proc.exitCode !== null) throw new Error('el servidor terminó al arrancar: ' + err);
    await sleep(120);
  }
  throw new Error('el servidor no arranca: ' + err);
}

async function conn(srv: Srv, hello: Msg, headers: Record<string, string> = {}) {
  const ws = new WebSocket(`ws://127.0.0.1:${srv.port}/ws`, { headers });
  socks.push(ws);
  const msgs: Msg[] = [];
  ws.on('message', (d) => msgs.push(JSON.parse(String(d))));
  let closeCode = 0;
  ws.on('close', (c) => { closeCode = c; });
  await new Promise((r, j) => { ws.once('open', r); ws.once('error', j); });
  ws.send(JSON.stringify(hello));
  let id = 0;
  const until = async (pred: (m: Msg) => boolean, ms = 4000): Promise<Msg> => {
    const t = Date.now();
    for (;;) { const hit = msgs.find(pred); if (hit) return hit; if (Date.now() - t > ms) throw new Error('timeout; recibido: ' + JSON.stringify(msgs.map((m) => m.t === 'err' ? m : m.t))); await sleep(25); }
  };
  return {
    ws, msgs, until, closeCode: () => closeCode, close: () => ws.close(),
    send: (m: Msg) => ws.send(JSON.stringify({ ...m, id: ++id })),
    async call(m: Msg) { const mine = ++id; ws.send(JSON.stringify({ ...m, id: mine })); return until((x) => x.t === 'ack' && x.id === mine); },
    state: () => [...msgs].reverse().find((m) => m.t === 'state')?.s,
  };
}
const welcomeOrErr = async (c: Awaited<ReturnType<typeof conn>>) => c.until((m) => m.t === 'welcome' || m.t === 'err');

describe('1 · creación de salas limitada', () => {
  it('WebSocket: límite por IP (4ª sala en la hora → rechazada) y tope global', async () => {
    const s = await start({ ROOM_CREATE_PER_HOUR: '3' });
    for (let i = 0; i < 3; i++) { const t = await conn(s, { t: 'hello', role: 'teacher', create: true }); expect((await welcomeOrErr(t)).t).toBe('welcome'); }
    const over = await conn(s, { t: 'hello', role: 'teacher', create: true });
    const e = await welcomeOrErr(over);
    expect(e).toMatchObject({ t: 'err', fatal: true });
    expect(e.msg).toMatch(/Demasiadas salas/);
    const cap = await start({ MAX_CLASS_ROOMS: '2' });
    for (let i = 0; i < 2; i++) expect((await welcomeOrErr(await conn(cap, { t: 'hello', role: 'teacher', create: true }))).t).toBe('welcome');
    expect((await welcomeOrErr(await conn(cap, { t: 'hello', role: 'teacher', create: true }))).msg).toMatch(/máximo de salas/);
  });
  it('X-Forwarded-For NO sirve para esquivar el límite si el servidor no está tras un proxy de confianza', async () => {
    const s = await start({ ROOM_CREATE_PER_HOUR: '2' });
    let last = 0;
    for (let i = 0; i < 4; i++) {
      const r = await fetch(s.url('/api/boxing/create'), { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.0.0.${i}` }, body: '{}' });
      last = r.status;
    }
    expect(last).toBe(429);
  });
  it('con TRUST_PROXY=1 cada cliente real tiene su propio cupo (la IP sale del proxy, no de la cabecera falsificable)', async () => {
    const s = await start({ ROOM_CREATE_PER_HOUR: '1', TRUST_PROXY: '1' });
    const create = (xff: string) => fetch(s.url('/api/boxing/create'), { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': xff }, body: '{}' }).then((r) => r.status);
    expect(await create('6.6.6.6, 203.0.113.1')).toBe(200);
    expect(await create('7.7.7.7, 203.0.113.1')).toBe(429); // misma IP real (derecha): el prefijo falso no ayuda
    expect(await create('6.6.6.6, 203.0.113.2')).toBe(200); // otro cliente real
  });
  it('un colegio entero detrás de una IP puede unirse y jugar: unirse no está limitado por creación', async () => {
    const s = await start({ ROOM_CREATE_PER_HOUR: '1' });
    const t = await conn(s, { t: 'hello', role: 'teacher', create: true });
    const w = await t.until((m) => m.t === 'welcome');
    for (let i = 0; i < 8; i++) expect((await welcomeOrErr(await conn(s, { t: 'hello', role: 'player', room: w.room, name: `Alumno${i}`, profile: `profile-school-${i}` }))).t).toBe('welcome');
  });
});

describe('2 · código de alumno', () => {
  it('los perfiles nuevos reciben códigos de 8 caracteres', async () => {
    const s = await start();
    const p = await conn(s, { t: 'hello', role: 'practice', name: 'Ana', profile: 'profile-newcode-1', topics: ['dativ'] });
    const w = await p.until((m) => m.t === 'welcome');
    expect(w.profileCode).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  });
  it('un código válido recupera el perfil; los de 6 caracteres ya emitidos siguen funcionando', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bc-hard-')); dirs.push(dir);
    writeFileSync(join(dir, 'state.json'), JSON.stringify({ rooms: {}, profiles: { 'legacy-profile-0001': { id: 'legacy-profile-0001', code: 'ABC234', name: 'Vieja', stats: {}, createdAt: 1 } } }));
    const s = await start({}, dir);
    const p = await conn(s, { t: 'hello', role: 'practice', name: 'Otro', profile: 'profile-other-0001', profileCode: 'abc234', topics: ['dativ'] });
    const w = await p.until((m) => m.t === 'welcome');
    expect(w.profile).toBe('legacy-profile-0001');
    expect(w.profileCode).toBe('ABC234');
  });
  it('fuerza bruta: tras N fallos la IP queda bloqueada, incluso para el código correcto, y el servidor lo dice', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bc-hard-')); dirs.push(dir);
    writeFileSync(join(dir, 'state.json'), JSON.stringify({ rooms: {}, profiles: { 'victim-profile-0001': { id: 'victim-profile-0001', code: 'GOOD234A', name: 'Victima', stats: {}, createdAt: 1 } } }));
    const s = await start({ CODE_FAILS_PER_IP: '3' }, dir);
    const tryCode = async (code: string) => { const c = await conn(s, { t: 'hello', role: 'practice', name: 'X', profile: 'profile-attacker-01', profileCode: code }); return welcomeOrErr(c); };
    for (const bad of ['AAAAAAAA', 'BBBBBBBB', 'CCCCCCCC']) expect((await tryCode(bad)).msg).toMatch(/No encuentro ese código/);
    const locked = await tryCode('GOOD234A');
    expect(locked.t).toBe('err');
    expect(locked.msg).toMatch(/Demasiados códigos/);
    // …pero entrar SIN código sigue funcionando: el bloqueo solo afecta a la recuperación
    expect((await welcomeOrErr(await conn(s, { t: 'hello', role: 'practice', name: 'Nuevo', profile: 'profile-fresh-00001' }))).t).toBe('welcome');
  });
});

describe('3 · credenciales de profesor', () => {
  it('migración: por defecto (optional) las salas sin clave siguen funcionando y /api/health informa del modo y de las creaciones legacy', async () => {
    const s = await start();
    expect((await welcomeOrErr(await conn(s, { t: 'hello', role: 'teacher', create: true }))).t).toBe('welcome');
    const h = await (await fetch(s.url('/api/health'))).json() as any;
    expect(h.teacherAuth).toEqual({ mode: 'optional', teachers: 0, legacyRoomCreates: 1 });
  });
  it('required: sin clave no se crean salas; con clave sí; el profesor recupera SU sala sin token; otro profesor y los alumnos no', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bc-hard-')); dirs.push(dir);
    const dirTeachers = new TeacherDirectory(dir);
    const marta = dirTeachers.issue('Marta'), otro = dirTeachers.issue('Otro');
    const s = await start({ TEACHER_AUTH: 'required' }, dir);
    expect((await welcomeOrErr(await conn(s, { t: 'hello', role: 'teacher', create: true }))).msg).toMatch(/clave de profesor/i);
    expect((await welcomeOrErr(await conn(s, { t: 'hello', role: 'teacher', create: true, teacherKey: 'dtk_falsa' }))).msg).toMatch(/no válida/);
    const t = await conn(s, { t: 'hello', role: 'teacher', create: true, teacherKey: marta.key });
    const w = await t.until((m) => m.t === 'welcome');
    const pl = await conn(s, { t: 'hello', role: 'player', room: w.room, name: 'Ana', profile: 'profile-auth-ana1' });
    const pw = await pl.until((m) => m.t === 'welcome'); // el alumno entra sin credencial
    // el profesor pierde su token (otro ordenador): recupera con su clave
    t.close();
    const back = await welcomeOrErr(await conn(s, { t: 'hello', role: 'teacher', room: w.room, teacherKey: marta.key }));
    expect(back).toMatchObject({ t: 'welcome', role: 'teacher', token: w.token });
    // otro profesor, un alumno con su token, una clave inventada o ninguna: no
    for (const hello of [{ teacherKey: otro.key }, { token: pw.token }, { teacherKey: 'dtk_falsa' }, {}]) {
      const r = await welcomeOrErr(await conn(s, { t: 'hello', role: 'teacher', room: w.room, ...hello }));
      expect(r.t, JSON.stringify(hello)).toBe('err');
    }
    // revocar surte efecto sin reiniciar el servidor
    dirTeachers.revoke(marta.id);
    const revoked = await welcomeOrErr(await conn(s, { t: 'hello', role: 'teacher', create: true, teacherKey: marta.key }));
    expect(revoked.t).toBe('err');
  });
  it('rollback: TEACHER_AUTH=off ignora las claves y restablece el comportamiento anterior', async () => {
    const s = await start({ TEACHER_AUTH: 'off' });
    expect((await welcomeOrErr(await conn(s, { t: 'hello', role: 'teacher', create: true, teacherKey: 'lo-que-sea' }))).t).toBe('welcome');
  });
});

describe('4 · recuperación de sesión', () => {
  it('alumno y profesor se reconectan con su token y conservan puntos tras cortes y tras reiniciar el servidor', async () => {
    const s = await start();
    const t = await conn(s, { t: 'hello', role: 'teacher', create: true });
    const tw = await t.until((m) => m.t === 'welcome');
    const p = await conn(s, { t: 'hello', role: 'player', room: tw.room, name: 'Ana', profile: 'profile-recover-01' });
    const pw = await p.until((m) => m.t === 'welcome');
    expect((await t.call({ t: 'ctl', a: { k: 'points', pid: pw.pid, delta: 30 } })).ok).toBe(true);
    await p.until((m) => m.t === 'state' && m.s.players?.find((x: Msg) => x.id === pw.pid)?.score === 30);
    // corte de red del alumno
    p.ws.terminate(); await sleep(150);
    const p2 = await conn(s, { t: 'hello', role: 'player', room: tw.room, token: pw.token });
    expect(await p2.until((m) => m.t === 'welcome')).toMatchObject({ pid: pw.pid });
    await p2.until((m) => m.t === 'state' && m.s.me?.id === pw.pid && m.s.players.find((x: Msg) => x.id === pw.pid).score === 30);
    // el servidor se reinicia (SIGTERM guarda el estado y libera la cerradura)
    t.ws.terminate(); p2.ws.terminate();
    await s.stop();
    const s2 = await start({}, s.dir);
    const p3 = await conn(s2, { t: 'hello', role: 'player', room: tw.room, token: pw.token });
    expect(await p3.until((m) => m.t === 'welcome')).toMatchObject({ pid: pw.pid });
    await p3.until((m) => m.t === 'state' && m.s.players.find((x: Msg) => x.id === pw.pid)?.score === 30);
    const t2 = await conn(s2, { t: 'hello', role: 'teacher', room: tw.room, token: tw.token });
    expect((await t2.until((m) => m.t === 'welcome')).role).toBe('teacher');
  });
  it('el límite de creación no impide reanudar: reconectar con token no crea sala ni consume cupo', async () => {
    const s = await start({ PRACTICE_OPEN_PER_HOUR: '1', ROOM_CREATE_PER_HOUR: '1' });
    const a = await conn(s, { t: 'hello', role: 'practice', name: 'Ana', profile: 'profile-resume-0001', topics: ['dativ'] });
    const w = await a.until((m) => m.t === 'welcome');
    a.ws.terminate();
    for (let i = 0; i < 3; i++) {
      const b = await conn(s, { t: 'hello', role: 'practice', room: w.room, token: w.token, profile: 'profile-resume-0001' });
      expect((await welcomeOrErr(b)).room).toBe(w.room);
      b.ws.terminate();
    }
  });
});

describe('5 · abuso de mensajes y conexiones', () => {
  it('una avalancha de mensajes se frena, el servidor sigue vivo y nadie gana puntos con ella', async () => {
    const s = await start();
    const t = await conn(s, { t: 'hello', role: 'teacher', create: true });
    const tw = await t.until((m) => m.t === 'welcome');
    const p = await conn(s, { t: 'hello', role: 'player', room: tw.room, name: 'Ana', profile: 'profile-flood-0001' });
    const pw = await p.until((m) => m.t === 'welcome');
    for (let i = 0; i < 300; i++) p.send({ t: 'ctl', a: { k: 'points', pid: pw.pid, delta: 50 } });
    await sleep(500);
    const acks = p.msgs.filter((m) => m.t === 'ack');
    expect(acks.some((a) => a.error === 'Demasiado rápido. Espera un momento.')).toBe(true);
    expect(acks.every((a) => a.ok === false)).toBe(true);
    expect(t.state().players.find((x: Msg) => x.id === pw.pid).score).toBe(0);
    expect((await fetch(s.url('/api/health'))).ok).toBe(true);
  });
  it('límite de conexiones WebSocket por IP', async () => {
    const s = await start({ MAX_WS_PER_IP: '2' });
    const a = await conn(s, { t: 'hello', role: 'teacher', create: true });
    const b = await conn(s, { t: 'hello', role: 'teacher', create: true });
    await Promise.all([a.until((m) => m.t === 'welcome'), b.until((m) => m.t === 'welcome')]);
    const c = await conn(s, { t: 'hello', role: 'teacher', create: true });
    await sleep(300);
    expect(c.closeCode()).toBe(1013);
    expect(c.msgs.some((m) => m.t === 'welcome')).toBe(false);
  });
  it('/api/progress limita las consultas por IP (429) sin romper las normales', async () => {
    const s = await start({ PROGRESS_PER_MIN: '3' });
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) codes.push((await fetch(s.url('/api/progress/leaderboard'))).status);
    expect(codes).toEqual([200, 200, 200, 429, 429]);
  });
});

describe('6 · una sola instancia por directorio de datos', () => {
  it('un segundo proceso sobre el mismo DATA_DIR no arranca (y el primero sigue sano)', async () => {
    const first = await start();
    const second = await start({ INSTANCE_LOCK_WAIT_MS: '1500' }, first.dir, { expectExit: true });
    const code = await new Promise<number | null>((r) => second.proc.once('exit', r));
    expect(code).toBe(1);
    expect(second.stderr()).toMatch(/Otra instancia/);
    expect((await fetch(first.url('/api/health'))).ok).toBe(true);
  }, 20_000);
  it('una cerradura abandonada (proceso caído) caduca y el servidor arranca', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bc-hard-')); dirs.push(dir);
    writeFileSync(join(dir, '.server.lock'), JSON.stringify({ id: 'muerto', pid: 1, beat: Date.now() - 120_000 }));
    const s = await start({}, dir);
    expect((await fetch(s.url('/api/health'))).ok).toBe(true);
  });
  it('al parar el servidor se libera la cerradura', async () => {
    const s = await start();
    expect(existsSync(join(s.dir, '.server.lock'))).toBe(true);
    await s.stop();
    expect(existsSync(join(s.dir, '.server.lock'))).toBe(false);
  });
});
