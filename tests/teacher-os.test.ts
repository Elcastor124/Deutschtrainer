// Teacher OS contra un servidor real: login de profesor (fail-closed), aislamiento de roles, privacidad, alumnos, clases y análisis.
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
async function conn(srv: Srv, hello: Msg, headers: Record<string, string> = {}) {
  const ws = new WebSocket(`ws://127.0.0.1:${srv.port}/ws`, { headers }); socks.push(ws);
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

import { TeacherDirectory } from '../server/teacher-auth.ts';
const PW = 'una frase larga 2026';
const rightMc = (q: Msg) => { const b = bank.get(q.id)!; return { choice: q.options.indexOf((b as any).options[(b as any).answer]) }; };
/** Petición con cookies (el navegador real las gestiona solo; aquí, a mano). */
async function req(s: Srv, path: string, opts: { body?: unknown; cookie?: string; headers?: Record<string, string> } = {}) {
  const r = await fetch(s.url(path), { method: opts.body === undefined ? 'GET' : 'POST', headers: { ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}), ...(opts.cookie ? { cookie: opts.cookie } : {}), ...opts.headers }, ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}) });
  const set = r.headers.getSetCookie?.() ?? [];
  return { status: r.status, body: await r.json().catch(() => ({})) as Msg, setCookie: set, cookie: set.map((c) => c.split(';')[0]).join('; ') };
}
async function teacherServer(env: Record<string, string> = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'bc-tos-')); dirs.push(dir);
  const { key } = new TeacherDirectory(dir).issue('Marta');
  const s = await start(env, dir);
  const login = await req(s, '/api/teacher/login', { body: { key } });
  expect(login.status).toBe(200);
  return { s, key, t: login.cookie, login };
}
async function student(s: Srv, alias: string) {
  const r = await req(s, '/api/account/register', { body: { alias, password: PW, confirm: PW } });
  expect(r.status).toBe(200);
  return r.cookie;
}

describe('acceso de profesor', () => {
  it('fail-closed: sin profesores registrados nadie entra; clave falsa 401; la sesión es una cookie HttpOnly', async () => {
    const s = await start();
    expect((await req(s, '/api/teacher/login', { body: { key: 'dtk_x' } })).status).toBe(503);
    const { s: s2, login } = await teacherServer();
    expect(login.setCookie[0]).toMatch(/^dt_t=dtt_[^;]+; Path=\/; HttpOnly; SameSite=Lax/);
    expect(JSON.stringify(login.body)).not.toMatch(/dtt_|dtk_/);                       // el token no viaja al JavaScript
    expect((await req(s2, '/api/teacher/login', { body: { key: 'dtk_falsa' } })).status).toBe(401);
  });
  it('un alumno (cookie o cabecera), un invitado o una cookie inventada no acceden a ninguna ruta de profesor', async () => {
    const { s } = await teacherServer();
    const st = await student(s, 'Ana_Lee');
    const tok = (await req(s, '/api/account/login', { body: { alias: 'Ana_Lee', password: PW }, headers: { 'x-token-response': '1' } })).body.token;
    for (const path of ['/api/teacher/overview', '/api/teacher/students', '/api/teacher/analytics', '/api/teacher/sessions', '/api/teacher/library', '/api/teacher/me']) {
      for (const auth of [{}, { cookie: st }, { headers: { 'x-student-session': tok } }, { cookie: 'dt_t=dtt_inventada' }, { cookie: st.replace('dt_s=', 'dt_t=') }]) {
        expect((await req(s, path, auth)).status, `${path} ${JSON.stringify(auth).slice(0, 40)}`).toBe(401);
      }
    }
    expect((await req(s, '/api/teacher/students', { body: { alias: 'Hacker_1' }, cookie: st })).status).toBe(401);
  });
  it('CSRF: sin JSON o desde otro origen, ninguna acción de profesor pasa', async () => {
    const { s, t } = await teacherServer();
    const plain = await fetch(s.url('/api/teacher/groups'), { method: 'POST', headers: { cookie: t }, body: 'name=x' });
    expect(plain.status).toBe(403);
    expect((await req(s, '/api/teacher/groups', { body: { name: 'X' }, cookie: t, headers: { origin: 'https://evil.example' } })).status).toBe(403);
    expect((await req(s, '/api/teacher/groups', { body: { name: 'X' }, cookie: t })).status).toBe(200);
  });
  it('cerrar sesión invalida la cookie; revocar la clave también corta la sesión', async () => {
    const { s, t } = await teacherServer();
    expect((await req(s, '/api/teacher/me', { cookie: t })).status).toBe(200);
    await req(s, '/api/teacher/logout', { body: {}, cookie: t });
    expect((await req(s, '/api/teacher/me', { cookie: t })).status).toBe(401);
    const { s: s2, t: t2 } = await teacherServer();
    const dirT = new TeacherDirectory(s2.dir); dirT.revoke(dirT.list()[0].id);
    expect((await req(s2, '/api/teacher/me', { cookie: t2 })).status).toBe(401);
  });
});

describe('gestión de alumnos', () => {
  it('panel sin datos inventados: todo a cero y listas vacías', async () => {
    const { s, t } = await teacherServer();
    const o = (await req(s, '/api/teacher/overview', { cookie: t })).body;
    expect(o.students).toEqual({ total: 0, active7: 0, disabled: 0 });
    expect(o.weakTopics).toEqual([]); expect(o.attention).toEqual([]); expect(o.upcoming).toEqual([]);
    expect(o.trend.every((w: Msg) => w.n === 0 && w.accuracy === null)).toBe(true);
  });
  it('alta por el profesor con contraseña temporal, nivel, grupo, notas privadas, asistencia, repaso, desactivar y restablecer', async () => {
    const { s, t } = await teacherServer();
    const g = (await req(s, '/api/teacher/groups', { body: { name: 'Lunes 18h' }, cookie: t })).body;
    const created = (await req(s, '/api/teacher/students', { body: { alias: 'Ben_Box', level: 'A2' }, cookie: t })).body;
    expect(created.password).toMatch(/^\w+-\w+-\w+-\d{3}$/);
    const id = created.id;
    expect((await req(s, `/api/teacher/students/${id}`, { body: { groups: [g.id, 'inventado'] }, cookie: t })).body.groups).toEqual([g.id]);
    expect((await req(s, `/api/teacher/students/${id}`, { body: { level: 'C2' }, cookie: t })).status).toBe(400);
    await req(s, `/api/teacher/students/${id}/notes`, { body: { text: 'NOTA-PRIVADA: le cuesta el Dativ con preposiciones' }, cookie: t });
    await req(s, `/api/teacher/students/${id}/attendance`, { body: { date: '2026-10-30', status: 'present' }, cookie: t });
    await req(s, `/api/teacher/students/${id}/review`, { body: { topics: ['dativ', 'inventado'], note: 'Antes del jueves' }, cookie: t });
    const det = (await req(s, `/api/teacher/students/${id}`, { cookie: t })).body;
    expect(det.student).toMatchObject({ alias: 'Ben_Box', level: 'A2', createdByTeacher: true });
    expect(det.notes[0].text).toMatch(/NOTA-PRIVADA/); expect(det.attendance[0]).toMatchObject({ status: 'present' }); expect(det.reviews[0].topics).toEqual(['dativ']);
    // el alumno entra con la contraseña temporal y ve su nivel, su repaso y su grupo… pero NUNCA la nota ni la asistencia
    const login = await req(s, '/api/account/login', { body: { alias: 'Ben_Box', password: created.password } });
    expect(login.status).toBe(200);
    const dash = (await req(s, '/api/account/dashboard', { cookie: login.cookie })).body;
    expect(dash).toMatchObject({ level: 'A2', groups: ['Lunes 18h'] });
    expect(dash.reviews[0]).toMatchObject({ topics: ['dativ'], note: 'Antes del jueves' });
    for (const path of ['/api/account/dashboard', '/api/account/progress', '/api/account/me', '/api/account/achievements', '/api/play/leaderboard', '/api/play/catalog', '/api/progress/leaderboard', '/api/health']) {
      const text = JSON.stringify((await req(s, path, { cookie: login.cookie })).body);
      expect(text, path).not.toMatch(/NOTA-PRIVADA|"attendance"|"notes"|"status":"present"/);
    }
    // desactivar: deja de poder entrar y su sesión abierta deja de valer; reactivar
    await req(s, `/api/teacher/students/${id}`, { body: { disabled: true }, cookie: t });
    expect((await req(s, '/api/account/me', { cookie: login.cookie })).status).toBe(401);
    expect((await req(s, '/api/account/login', { body: { alias: 'Ben_Box', password: created.password } })).body.error).toMatch(/desactivada/);
    await req(s, `/api/teacher/students/${id}`, { body: { disabled: false }, cookie: t });
    const reset = (await req(s, `/api/teacher/students/${id}/reset-password`, { body: {}, cookie: t })).body.password;
    expect((await req(s, '/api/account/login', { body: { alias: 'Ben_Box', password: created.password } })).status).toBe(401);
    expect((await req(s, '/api/account/login', { body: { alias: 'Ben_Box', password: reset } })).status).toBe(200);
  });
  it('un alumno no puede leer datos de otro alumno por ninguna vía de alumno', async () => {
    const { s, t } = await teacherServer();
    const ana = await student(s, 'Ana_Lee'), ben = await student(s, 'Ben_Box');
    const list = (await req(s, '/api/teacher/students', { cookie: t })).body.students;
    const benId = list.find((x: Msg) => x.alias === 'Ben_Box').id;
    await req(s, `/api/teacher/students/${benId}/notes`, { body: { text: 'SOLO-BEN' }, cookie: t });
    expect((await req(s, `/api/teacher/students/${benId}`, { cookie: ana })).status).toBe(401);
    const anaDash = JSON.stringify((await req(s, '/api/account/dashboard', { cookie: ana })).body);
    expect(anaDash).not.toMatch(/Ben_Box|SOLO-BEN/);
    void ben;
  });
});

describe('clases, análisis y biblioteca', () => {
  it('clase planificada para un grupo: la ven solo los alumnos del grupo; empezar y terminar', async () => {
    const { s, t } = await teacherServer();
    const ana = await student(s, 'Ana_Lee'), ben = await student(s, 'Ben_Box');
    const g = (await req(s, '/api/teacher/groups', { body: { name: 'A2 martes' }, cookie: t })).body;
    const anaId = (await req(s, '/api/teacher/students', { cookie: t })).body.students.find((x: Msg) => x.alias === 'Ana_Lee').id;
    await req(s, `/api/teacher/students/${anaId}`, { body: { groups: [g.id] }, cookie: t });
    const sess = (await req(s, '/api/teacher/sessions', { body: { title: 'Dativ con juegos', date: '2099-01-12', groupId: g.id, game: 'blackcard', topics: ['dativ'], level: 'A2' }, cookie: t })).body;
    expect((await req(s, '/api/account/dashboard', { cookie: ana })).body.classes).toEqual([expect.objectContaining({ title: 'Dativ con juegos', date: '2099-01-12', status: 'planned' })]);
    expect((await req(s, '/api/account/dashboard', { cookie: ben })).body.classes).toEqual([]);
    expect((await req(s, `/api/teacher/sessions/${sess.id}/start`, { body: { room: 'ABCD' }, cookie: t })).body).toMatchObject({ status: 'live', room: 'ABCD' });
    expect((await req(s, '/api/account/dashboard', { cookie: ana })).body.classes[0]).toMatchObject({ status: 'live', room: 'ABCD' });
    expect((await req(s, `/api/teacher/sessions/${sess.id}/end`, { body: {}, cookie: t })).body.status).toBe('done');
    expect((await req(s, `/api/teacher/sessions/${sess.id}`, { cookie: t })).body.results).toEqual({ students: [] });
  });
  it('análisis descriptivo: n en cada grupo y «datos insuficientes» con pocas respuestas', async () => {
    const { s, t } = await teacherServer();
    const ana = await student(s, 'Ana_Lee');
    const c = await conn(s, { t: 'hello', role: 'practice', free: true, session: 'cookie', topics: ['akkusativ'], size: 10 }, { Cookie: ana });
    const w = await c.until((m) => m.t === 'welcome'); expect(w.profile).toMatch(/^acc_/);   // la sesión llega por la cookie del WebSocket
    for (let i = 0; i < 3; i++) {
      const st = await c.stateWhere((x) => x.phase === 'question' && x.qNo === i + 1);
      await c.call({ t: 'answer', qid: st.q.id, a: rightMc(st.q) });
      await c.stateWhere((x) => x.phase === 'reveal' && x.qNo === i + 1); await c.call({ t: 'pnext' });
    }
    const a = (await req(s, '/api/teacher/analytics?days=30', { cookie: t })).body;
    expect(a).toMatchObject({ n: 3, students: 1, sufficient: false, minN: 20 });
    expect(a.byTopic).toEqual([{ key: 'akkusativ', n: 3, correct: 3, accuracy: 1 }]);
    expect(a.byWeekday.reduce((m: number, x: Msg) => m + x.n, 0)).toBe(3);
    expect(a.byDiff.find((x: Msg) => x.key === 'easy' || x.key === 'medium').n).toBeGreaterThan(0);
    expect((await req(s, '/api/teacher/analytics?topic=dativ', { cookie: t })).body.n).toBe(0);
    const det = (await req(s, `/api/teacher/students/${w.profile}`, { cookie: t })).body;
    expect(det.grammar[0]).toMatchObject({ topic: 'akkusativ', n: 3 });
    expect(det.grammar[0].byDiff.reduce((m: number, x: Msg) => m + x.n, 0)).toBe(3);   // precisión por tema Y por dificultad
  });
  it('la biblioteca lista presentaciones reales, juegos, examen y repasos con nivel y temas', async () => {
    const { s, t } = await teacherServer();
    const lib = (await req(s, '/api/teacher/library', { cookie: t })).body;
    expect(lib.items.filter((i: Msg) => i.type === 'presentacion')).toHaveLength(10);
    expect(lib.items.find((i: Msg) => i.id === 'exam:road-b1-1')).toMatchObject({ levels: ['B1'] });
    expect(lib.items.every((i: Msg) => Array.isArray(i.levels) && i.levels.length)).toBe(true);
  });
  it('con TEACHER_AUTH=required, la sesión de Teacher OS crea salas de clase (sin clave en el navegador); un alumno no', async () => {
    const { s, t } = await teacherServer({ TEACHER_AUTH: 'required' });
    const prof = await conn(s, { t: 'hello', role: 'teacher', create: true, topics: ['dativ'] }, { Cookie: t });
    const w = await prof.until((m) => m.t === 'welcome' || m.t === 'err');
    expect(w.t).toBe('welcome');
    const ana = await student(s, 'Ana_Lee');
    const intr = await conn(s, { t: 'hello', role: 'teacher', create: true }, { Cookie: ana });
    expect((await intr.until((m) => m.t === 'err')).fatal).toBe(true);
    // el profesor recupera su propia sala solo con su sesión (otro dispositivo, sin el token de la sala)
    const back = await conn(s, { t: 'hello', role: 'teacher', room: w.room }, { Cookie: t });
    expect((await back.until((m) => m.t === 'welcome' || m.t === 'err')).t).toBe('welcome');
    const ov = (await req(s, '/api/teacher/overview', { cookie: t })).body;
    expect(ov.live.map((r: Msg) => r.code)).toContain(w.room);
  });
});
