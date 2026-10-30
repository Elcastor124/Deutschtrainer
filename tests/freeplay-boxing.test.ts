// Boxeo libre (sin profesor): sparring, salas privadas, plazos, progreso solo para cuentas y separación estricta de roles.
import { createServer, type Server } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createBoxingHandler } from '../server/boxing.ts';
import { BOXING_BANK } from '../server/boxing-bank.ts';
import { FREE_BOXING, botAnswer, botMove } from '../server/boxing-free.ts';
import { createGuard } from '../server/security.ts';
import { TeacherDirectory } from '../server/teacher-auth.ts';
import type { Identity } from '../server/play-api.ts';

const servers: Server[] = [], dirs: string[] = [];
afterEach(async () => { for (const s of servers.splice(0)) { s.closeAllConnections(); await new Promise<void>((r) => s.close(() => r())); } for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

type J = Record<string, any>;
async function setup(env: Record<string, string> = {}, opts: { rand?: () => number; dir?: string } = {}) {
  const dir = opts.dir ?? mkdtempSync(join(tmpdir(), 'bc-fbox-')); if (!opts.dir) dirs.push(dir);
  let time = 1_000_000;
  const accounts = new Map<string, { id: string; alias: string }>([['tok-ana', { id: 'acc_ana', alias: 'Ana_Lee' }], ['tok-ben', { id: 'acc_ben', alias: 'BenBox' }]]);
  const answers: J[] = [], activities: J[] = [];
  const guard = createGuard({ dataDir: dir, env: env as NodeJS.ProcessEnv, now: () => time });
  const identify = (req: any): Identity => {
    const t = req.headers['x-student-session'];
    if (!t) return { kind: 'guest' };
    const a = accounts.get(String(t));
    return a ? { kind: 'account', account: { id: a.id, alias: a.alias } as any } : { kind: 'invalid' };
  };
  const make = () => createBoxingHandler({ dataDir: dir, now: () => time, guard, identify, random: opts.rand ?? (() => 0.5),
    progress: { answer: (x) => answers.push(x), activity: (p, a) => activities.push({ p, ...a }) } });
  let handler = make();
  const server = createServer((req, res) => { if (!handler(req, res)) { res.writeHead(404); res.end(); } }); servers.push(server);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const call = async (path: string, input?: unknown, token?: string, headers: Record<string, string> = {}) => {
    const res = await fetch(base + path, { method: input === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, ...(input === undefined ? {} : { body: JSON.stringify(input) }) });
    return { status: res.status, body: await res.json() as J };
  };
  const play = {
    solo: (input: J = {}, h?: Record<string, string>) => call('/api/play/boxing/solo', input, undefined, h),
    create: (input: J = {}, h?: Record<string, string>) => call('/api/play/boxing/create', input, undefined, h),
    join: (code: string, name = 'Beto', h?: Record<string, string>) => call('/api/play/boxing/join', { code, name }, undefined, h),
    state: (w: J) => call(`/api/play/boxing/state?code=${w.code}`, undefined, w.token),
    act: (w: J, action: J) => call('/api/play/boxing/action', { code: w.code, action }, w.token),
  };
  const question = async (w: J) => { const v = (await play.state(w)).body; const q = BOXING_BANK.find((b) => b.id === v.question?.id)!; return { v, q }; };
  /** Juega un asalto completo como `w`: acierta o falla y elige movimiento. */
  const exchange = async (w: J, ok = true, move = 'jab') => {
    const { q } = await question(w);
    await play.act(w, { type: 'answer', questionId: q.id, answer: ok ? q.answer : (q.answer + 1) % q.options.length });
    const v = (await play.state(w)).body;
    if (v.phase === 'action' && ok) await play.act(w, { type: 'move', questionId: q.id, move });
    return (await play.state(w)).body;
  };
  return { call, play, question, exchange, answers, activities, advance: (ms: number) => { time += ms; }, sweep: () => handler.sweep(time), restart: () => { handler = make(); }, dir, guard, base };
}

describe('sparring: reglas claras y sin trampas', () => {
  it('botAnswer acierta con la probabilidad fija y, si falla, elige una opción incorrecta', () => {
    expect(botAnswer(2, 3, () => 0.1)).toBe(2);
    expect([0, 1]).toContain(botAnswer(2, 3, (() => { const v = [0.9, 0.0]; return () => v.shift() ?? 0; })()));
    for (let i = 0; i < 50; i++) expect(botAnswer(1, 3, (() => { const v = [0.99, Math.random()]; return () => v.shift() ?? 0.5; })())).not.toBe(1);
  });
  it('botMove sigue la tabla publicada (nunca un movimiento que no puede pagar)', () => {
    expect(botMove(20, 4, () => 0)).toBe('guard');   // vida baja → defensa
    expect(botMove(100, 4, () => 0.1)).toBe('hook');
    expect(botMove(100, 4, () => 0.9)).toBe('cross');
    expect(botMove(100, 2, () => 0)).toBe('cross');
    expect(botMove(100, 1, () => 0.1)).toBe('jab');
    expect(botMove(100, 1, () => 0.9)).toBe('dodge');
    expect(botMove(100, 0, () => 0)).toBe('guard');
    for (const hp of [10, 50, 100]) for (const st of [0, 1, 2, 3, 4, 5]) for (const r of [0, 0.5, 0.99]) {
      const m = botMove(hp, st, () => r); const cost = { jab: 1, cross: 2, hook: 3, guard: 0, dodge: 1 }[m]; expect(st).toBeGreaterThanOrEqual(cost);
    }
  });
});

describe('boxeo solo (sin profesor conectado)', () => {
  it('un invitado empieza solo, juega contra el sparring hasta el final y no guarda nada', async () => {
    const s = await setup();
    const r = await s.play.solo({ name: 'Lola <b>' });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ role: 'player', free: true });
    let v = (await s.play.state(r.body)).body;
    expect(v.phase).toBe('question');
    expect(v.fighters.map((f: J) => f.name)).toEqual(['Lola b', 'Sparring']);
    expect(v.free).toMatchObject({ mode: 'solo' });
    expect(JSON.stringify(v)).not.toContain('"answer"'); // la vista del alumno no filtra la solución antes del resultado
    for (let i = 0; i < FREE_BOXING.soloExchanges + 2 && v.phase !== 'finished'; i++) {
      v = await s.exchange(r.body, i % 3 !== 0);
      if (v.phase === 'result') await s.play.act(r.body, { type: 'next' });
      v = (await s.play.state(r.body)).body;
    }
    expect(v.phase).toBe('finished');
    expect(['draw', ...v.fighters.map((f: J) => f.id)]).toContain(v.winner);
    expect(s.answers).toEqual([]);      // invitado: ningún progreso
    expect(s.activities).toEqual([]);
  });

  it('con cuenta: cada respuesta y la actividad completada las registra el servidor, y solo una vez', async () => {
    const s = await setup();
    const r = await s.play.solo({ topics: ['dativ'] }, { 'x-student-session': 'tok-ana' });
    expect((await s.play.state(r.body)).body.fighters[0].name).toBe('Ana_Lee'); // alias de la cuenta, no un nombre escrito
    let v = (await s.play.state(r.body)).body;
    for (let i = 0; i < 12 && v.phase !== 'finished'; i++) { v = await s.exchange(r.body, true, 'jab'); if (v.phase === 'result') await s.play.act(r.body, { type: 'next' }); v = (await s.play.state(r.body)).body; }
    expect(v.phase).toBe('finished');
    expect(s.answers.length).toBe(FREE_BOXING.soloExchanges);
    expect(s.answers.every((a) => a.profile === 'acc_ana' && a.topic === 'dativ' && a.room === r.body.code)).toBe(true);
    expect(s.activities).toHaveLength(1);
    expect(s.activities[0]).toMatchObject({ p: 'acc_ana', game: 'boxing', level: 'A2', total: FREE_BOXING.soloExchanges, correct: FREE_BOXING.soloExchanges });
    // consultar de nuevo o intentar responder tras el final no duplica nada
    await s.play.state(r.body); await s.play.act(r.body, { type: 'answer', questionId: 'x', answer: 0 });
    expect(s.activities).toHaveLength(1);
  });

  it('solo usa los temas pedidos; un tema o nivel inválido se rechaza', async () => {
    const s = await setup();
    const r = await s.play.solo({ topics: ['praep'] });
    for (let i = 0; i < 3; i++) { const { v, q } = await s.question(r.body); expect(q.topic).toBe('Präpositionen'); await s.exchange(r.body); const w = (await s.play.state(r.body)).body; if (w.phase === 'result') await s.play.act(r.body, { type: 'next' }); void v; }
    expect((await s.play.solo({ topics: ['inventado'] })).status).toBe(400);
    expect((await s.play.solo({ topics: 'dativ' })).status).toBe(400);
    expect((await s.play.solo({ level: 'B1' })).status).toBe(400);
  });

  it('una sesión caducada NO se degrada a invitado: 401', async () => {
    const s = await setup();
    expect((await s.play.solo({}, { 'x-student-session': 'tok-caducado' })).status).toBe(401);
  });
});

describe('separación de roles: el modo libre no da poderes de profesor', () => {
  it('ningún luchador puede pausar, reanudar, revelar, reiniciar ni empezar; el combate sigue intacto', async () => {
    const s = await setup();
    const r = await s.play.solo();
    for (const type of ['pause', 'resume', 'reveal', 'restart', 'start']) {
      const x = await s.play.act(r.body, { type });
      expect(x.status, type).toBe(403);
    }
    const v = (await s.play.state(r.body)).body;
    expect(v.phase).toBe('question'); expect(v.paused).toBe(false);
    expect(v.fighters.every((f: J) => f.hp === 100)).toBe(true);
  });
  it('las APIs están aisladas: el código de una sala libre no abre nada en /api/boxing y viceversa', async () => {
    const s = await setup();
    const free = (await s.play.solo()).body, priv = (await s.play.create()).body;
    const teacher = (await s.call('/api/boxing/create', {})).body;
    for (const w of [free, priv]) {
      expect((await s.call(`/api/boxing/state?code=${w.code}`, undefined, w.token)).status).toBe(404);
      expect((await s.call('/api/boxing/join', { code: w.code, name: 'Intruso' })).status).toBe(404);
      expect((await s.call('/api/boxing/action', { code: w.code, action: { type: 'pause' } }, w.token)).status).toBe(404);
    }
    expect((await s.call('/api/play/boxing/join', { code: teacher.code, name: 'Intruso' })).status).toBe(404);
    expect((await s.call(`/api/play/boxing/state?code=${teacher.code}`, undefined, teacher.token)).status).toBe(404);
    // el token de profesor de una sala del profesor tampoco funciona como jugador libre
    expect((await s.call('/api/play/boxing/action', { code: free.code, action: { type: 'pause' } }, teacher.token)).status).toBe(401);
  });
  it('TEACHER_AUTH=required sigue cerrado para salas de profesor (fail-closed) y el modo libre funciona', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bc-fbox-')); dirs.push(dir);
    const s = await setup({ TEACHER_AUTH: 'required' }, { dir }); // sin profesores registrados
    expect((await s.call('/api/boxing/create', {})).status).toBe(503);
    expect((await s.call('/api/boxing/create', {}, undefined, { 'x-student-session': 'tok-ana' })).status).toBe(503); // una cuenta de alumno no sirve de clave de profesor
    expect((await s.play.solo({}, { 'x-student-session': 'tok-ana' })).status).toBe(200);
    expect((await s.play.create()).status).toBe(200);
    // con un profesor registrado: sin clave 401 (una sesión de alumno NO es una clave de profesor), con clave 200
    const { key } = new TeacherDirectory(dir).issue('Marta');
    const t = await setup({ TEACHER_AUTH: 'required' }, { dir });
    expect((await t.call('/api/boxing/create', {})).status).toBe(401);
    expect((await t.call('/api/boxing/create', {}, undefined, { 'x-teacher-key': 'tok-ana' })).status).toBe(401);
    expect((await t.call('/api/boxing/create', {}, undefined, { 'x-teacher-key': key })).status).toBe(200);
    // y la clave de profesor tampoco es una sesión de alumno
    expect((await t.play.solo({}, { 'x-student-session': key })).status).toBe(401);
  });
});

describe('partida privada por código (sin profesor)', () => {
  it('crear → unirse → los dos listos → empieza; nadie puede forzar el inicio ni colarse', async () => {
    const s = await setup();
    const a = (await s.play.create({ name: 'Ana' })).body;
    expect((await s.play.state(a)).body.phase).toBe('lobby');
    expect((await s.play.act(a, { type: 'ready' })).status).toBe(200);
    expect((await s.play.state(a)).body.phase).toBe('lobby'); // falta el rival
    const b = (await s.play.join(a.code, 'Beto')).body;
    expect(b).toMatchObject({ role: 'player', free: true });
    expect((await s.play.state(a)).body.phase).toBe('lobby'); // falta que b esté listo
    expect((await s.play.join(a.code, 'Tercero')).status).toBe(409); // sala completa
    expect((await s.play.act(b, { type: 'start' })).status).toBe(403); // «start» es del profesor
    expect((await s.play.act(b, { type: 'ready' })).status).toBe(200);
    const v = (await s.play.state(a)).body;
    expect(v.phase).toBe('question');
    expect(v.fighters.map((f: J) => f.name)).toEqual(['Ana', 'Beto']);
    expect((await s.play.join(a.code, 'Tarde')).status).toBe(409); // ya empezó
    // una partida completa entre los dos, sin profesor
    for (let i = 0; i < FREE_BOXING.privateExchanges + 2; i++) {
      const cur = (await s.play.state(a)).body; if (cur.phase === 'finished') break;
      for (const w of [a, b]) { const { q, v: vv } = await s.question(w); if (vv.phase !== 'question') continue; await s.play.act(w, { type: 'answer', questionId: q.id, answer: q.answer }); }
      for (const w of [a, b]) { const { q } = await s.question(w).catch(() => ({ q: null as any })); if (q && (await s.play.state(w)).body.phase === 'action') await s.play.act(w, { type: 'move', questionId: q.id, move: 'jab' }); }
      if ((await s.play.state(a)).body.phase === 'result') await s.play.act(a, { type: 'next' });
    }
    expect((await s.play.state(b)).body.phase).toBe('finished');
  });
  it('la misma cuenta no puede ocupar las dos esquinas; los invitados con el mismo nombre se distinguen', async () => {
    const s = await setup();
    const a = (await s.play.create({}, { 'x-student-session': 'tok-ana' })).body;
    expect((await s.play.join(a.code, 'x', { 'x-student-session': 'tok-ana' })).status).toBe(409);
    expect((await s.play.join(a.code, 'x', { 'x-student-session': 'tok-ben' })).status).toBe(200);
    const g = (await s.play.create({ name: 'Zoe' })).body;
    await s.play.join(g.code, 'zoe');
    expect((await s.play.state(g)).body.fighters.map((f: J) => f.name)).toEqual(['Zoe', 'zoe 2']);
  });
  it('un código incorrecto o de una sala del profesor da 404 y se limita el escaneo', async () => {
    const s = await setup({ ROOM_MISS_PER_10MIN: '4' });
    for (let i = 0; i < 4; i++) expect((await s.play.join('ZZZZ')).status).toBe(404);
    expect((await s.play.join('ZZZZ')).status).toBe(429);
  });
  it('reconexión: el estado se recupera con el token, también tras reiniciar el servidor', async () => {
    const s = await setup();
    const a = (await s.play.create({ name: 'Ana' })).body; const b = (await s.play.join(a.code, 'Beto')).body;
    await s.play.act(a, { type: 'ready' }); await s.play.act(b, { type: 'ready' });
    await s.exchange(a);
    const before = (await s.play.state(a)).body;
    s.restart();
    const after = (await s.play.state(a)).body;
    expect(after.phase).toBe(before.phase); expect(after.exchange).toBe(before.exchange);
    expect(after.fighters[0].correct).toBe(before.fighters[0].correct);
    expect((await s.play.state({ code: a.code, token: 'token-ajeno-aaaaaaaa' })).status).toBe(401);
  });
});

describe('plazos y cierre de partidas abandonadas', () => {
  it('si el rival no responde, el servidor decide por él y la partida avanza sola', async () => {
    const s = await setup();
    const a = (await s.play.create({ name: 'Ana' })).body; const b = (await s.play.join(a.code, 'Beto')).body;
    await s.play.act(a, { type: 'ready' }); await s.play.act(b, { type: 'ready' });
    const { q } = await s.question(a);
    await s.play.act(a, { type: 'answer', questionId: q.id, answer: q.answer });
    s.advance(FREE_BOXING.questionMs + 1);
    let v = (await s.play.state(a)).body;
    expect(v.phase).toBe('action');                      // Beto no respondió: cuenta como fallo
    expect(v.fighters[1].wrong).toBe(1);
    s.advance(FREE_BOXING.actionMs + 1);
    v = (await s.play.state(a)).body;
    expect(v.phase).toBe('result');                      // nadie eligió movimiento: recuperan
    s.advance(FREE_BOXING.resultMs + 1);
    v = (await s.play.state(a)).body;
    expect(v.phase).toBe('question'); expect(v.exchange).toBe(2); // avanza sin que nadie pulse «siguiente»
  });
  it('una partida abandonada se cierra: libre sin actividad a las 2 h, terminada a los 10 min; las del profesor no se tocan', async () => {
    const s = await setup();
    const idle = (await s.play.create()).body;
    const teacher = (await s.call('/api/boxing/create', {})).body;
    const done = (await s.play.solo()).body;
    let v = (await s.play.state(done)).body;
    for (let i = 0; i < 30 && v.phase !== 'finished'; i++) { s.advance(FREE_BOXING.questionMs + FREE_BOXING.actionMs + FREE_BOXING.resultMs + 3000); v = (await s.play.state(done)).body; }
    expect(v.phase).toBe('finished');
    s.advance(FREE_BOXING.finishedTtlMs - 1000);
    expect(s.sweep()).toBe(0);
    await s.play.state(idle); // actividad: sigue viva
    s.advance(2000);
    expect(s.sweep()).toBe(1);                           // la terminada se cierra
    expect((await s.play.state(done)).status).toBe(404);
    s.advance(FREE_BOXING.idleTtlMs + 1000);
    expect(s.sweep()).toBe(1);                           // la privada abandonada
    expect((await s.play.state(idle)).status).toBe(404);
    expect((await s.call(`/api/boxing/state?code=${teacher.code}`, undefined, teacher.token)).status).toBe(200); // la del profesor (24 h) sigue
  });
});

describe('límites de creación del modo libre', () => {
  it('por IP, por cuenta y tope global; no consumen el cupo de las salas de profesor', async () => {
    const s = await setup({ FREE_SOLO_PER_HOUR: '3', FREE_PER_ACCOUNT_HOUR: '100', MAX_FREE_ROOMS: '50', ROOM_CREATE_PER_HOUR: '1' });
    for (let i = 0; i < 3; i++) expect((await s.play.solo()).status).toBe(200);
    const over = await s.play.solo();
    expect(over.status).toBe(429); expect(over.body.error).toMatch(/Espera/);
    expect((await s.call('/api/boxing/create', {})).status).toBe(200); // salas de profesor: su propio cupo
    const cap = await setup({ MAX_FREE_ROOMS: '2' });
    await cap.play.solo(); await cap.play.solo();
    expect((await cap.play.solo()).status).toBe(503);
    expect((await cap.call('/api/boxing/create', {})).status).toBe(200); // las partidas libres no llenan el tope de salas de profesor
  });
  it('por cuenta: cambiar de IP no esquiva el límite de una misma cuenta', async () => {
    const s = await setup({ FREE_PER_ACCOUNT_HOUR: '2', FREE_SOLO_PER_HOUR: '100' });
    const h = { 'x-student-session': 'tok-ana' };
    expect((await s.play.solo({}, h)).status).toBe(200); expect((await s.play.solo({}, h)).status).toBe(200);
    expect((await s.play.solo({}, h)).status).toBe(429);
    expect((await s.play.solo({}, { 'x-student-session': 'tok-ben' })).status).toBe(200);
  });
});
