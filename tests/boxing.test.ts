import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { BoxingMove, BoxingWelcome, BoxingView } from '../shared/boxing.ts';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { vi.restoreAllMocks(); for (const close of cleanups.splice(0)) await close(); });

async function harness(dataDir = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'boxing-test-'))) {
  const module = await import('../server/boxing.ts').catch(() => undefined);
  expect(module?.createBoxingHandler, 'La API de boxeo debe existir').toBeTypeOf('function');
  const handler = module!.createBoxingHandler({ dataDir });
  const server: Server = createServer((req, res) => {
    if (!handler(req, res)) { res.writeHead(404); res.end(); }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing HTTP port');
  const base = `http://127.0.0.1:${address.port}`;
  const close = () => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  });
  cleanups.push(async () => { if (server.listening) await close(); rmSync(dataDir, { recursive: true, force: true }); });
  async function request(path: string, body?: unknown, token?: string, method = body === undefined ? 'GET' : 'POST') {
    const response = await fetch(base + path, {
      method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  }
  async function create() { const r = await request('/api/boxing/create', {}); expect(r.status).toBe(200); return r.body as BoxingWelcome; }
  async function joinPlayer(code: string, name: string) { const r = await request('/api/boxing/join', { code, name }); expect(r.status).toBe(200); return r.body as BoxingWelcome; }
  async function state(w: BoxingWelcome) { const r = await request(`/api/boxing/state?code=${w.code}`, undefined, w.token); expect(r.status).toBe(200); return r.body as BoxingView; }
  async function action(w: BoxingWelcome, action: unknown) { return request('/api/boxing/action', { code: w.code, action }, w.token); }
  async function players() {
    const teacher = await create();
    const a = await joinPlayer(teacher.code, 'Ana');
    const b = await joinPlayer(teacher.code, 'Tomás');
    return { teacher, a, b };
  }
  async function answer(w: BoxingWelcome, correct = true) {
    const v = await state(w);
    const { BOXING_BANK } = await import('../server/boxing-bank.ts');
    const q = BOXING_BANK.find((q) => q.id === v.question?.id)!;
    return action(w, { type: 'answer', questionId: q.id, answer: correct ? q.answer : (q.answer + 1) % q.options.length });
  }
  async function move(w: BoxingWelcome, move: BoxingMove) {
    const v = await state(w);
    return action(w, { type: 'move', questionId: v.question!.id, move });
  }
  return { request, create, joinPlayer, state, action, players, answer, move, close, dataDir, handler, base };
}

describe('banco de boxeo', () => {
  it('incluye al menos 140 ejercicios únicos con claves directas y explicaciones de los temas de la lección', async () => {
    const module = await import('../server/boxing-bank.ts').catch(() => undefined);
    const bank = module?.BOXING_BANK ?? [];
    expect(bank.length).toBeGreaterThanOrEqual(140);
    expect(new Set(bank.map((q) => q.id)).size).toBe(bank.length);
    expect(new Set(bank.map((q) => q.prompt)).size).toBe(bank.length);
    expect(new Set(bank.map((q) => q.topic))).toEqual(new Set(['Akkusativ', 'Dativ', 'Präpositionen', 'Pronomen', 'Wo/Wohin', 'Perfekt', 'Nebensätze']));
    for (const q of bank) {
      expect(q.options.length).toBeGreaterThanOrEqual(3);
      expect(new Set(q.options).size).toBe(q.options.length);
      expect(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length).toBe(true);
      expect(q.explanation.length).toBeGreaterThan(30);
    }
  });
});

describe('API autoritativa de boxeo', () => {
  it('prepara el repaso con casos y preposiciones, sin mezclar Perfekt ni Nebensätze', async () => {
    const h = await harness();
    const { teacher } = await h.players();
    expect((await h.action(teacher, { type: 'start' })).status).toBe(200);
    const disk = JSON.parse(readFileSync(join(h.dataDir, 'boxing.json'), 'utf8'));
    const deck = disk.rooms[teacher.code].deck as { topic: string }[];
    expect(deck.length).toBeGreaterThanOrEqual(12);
    expect(new Set(deck.map((q) => q.topic))).toEqual(new Set(['Akkusativ', 'Dativ', 'Präpositionen', 'Pronomen', 'Wo/Wohin']));
  });
  it('cada combate sortea 12 preguntas sin repetir, equilibradas por tema y en orden variable', async () => {
    const h = await harness();
    const cases = ['Akkusativ', 'Dativ', 'Präpositionen', 'Pronomen', 'Wo/Wohin'];
    const firstIds = new Set<string>();
    const allIds = new Set<string>();
    for (let r = 0; r < 20; r++) {
      const { teacher } = await h.players();
      expect((await h.action(teacher, { type: 'start' })).status).toBe(200);
      const disk = JSON.parse(readFileSync(join(h.dataDir, 'boxing.json'), 'utf8'));
      const deck = disk.rooms[teacher.code].deck as { id: string; topic: string }[];
      expect(deck.length).toBe(12);
      expect(new Set(deck.map((q) => q.id)).size).toBe(12);
      for (const q of deck) { expect(cases).toContain(q.topic); allIds.add(q.id); }
      expect(new Set(deck.map((q) => q.topic)).size).toBeGreaterThanOrEqual(4);
      for (const t of cases) expect(deck.filter((q) => q.topic === t).length).toBeLessThanOrEqual(3);
      for (let i = 2; i < deck.length; i++) {
        expect(deck[i].topic === deck[i - 1].topic && deck[i].topic === deck[i - 2].topic).toBe(false);
      }
      firstIds.add(deck[0].id);
    }
    expect(firstIds.size).toBeGreaterThan(1);
    expect(allIds.size).toBeGreaterThan(60);
  });
  it('devuelve 413 también con un cuerpo mayor que un paquete TCP, sin romper el socket', async () => {
    const h = await harness();
    const response = await fetch(h.base + '/api/boxing/create', { method: 'POST', body: JSON.stringify({ huge: 'x'.repeat(500_000) }) });
    expect(response.status).toBe(413); expect(await response.json()).toEqual({ error: expect.any(String) });
  });
  it('restaura credenciales, respuestas, movimiento bloqueado, pausa y resultado desde boxing.json', async () => {
    const first = await harness(); const { teacher, a, b } = await first.players(); await first.action(teacher, { type: 'start' });
    await first.answer(a); const answered = await first.state(a); await first.close();
    const second = await harness(first.dataDir);
    expect(await second.state(a)).toEqual(answered);
    expect((await second.answer(a)).status).toBe(409);
    await second.answer(b); await second.move(a, 'cross'); await second.action(teacher, { type: 'pause' });
    const locked = await second.state(a); await second.close();
    const third = await harness(first.dataDir);
    expect(await third.state(a)).toEqual(locked);
    expect((await third.move(b, 'guard')).status).toBe(409);
    await third.action(teacher, { type: 'resume' }); await third.move(b, 'guard');
    const result = await third.state(a); expect(result.fighters.map((f) => f.hp)).toEqual([100, 97]); await third.close();
    const fourth = await harness(first.dataDir);
    expect(await fourth.state(a)).toEqual(result);
    expect((await fourth.move(b, 'hook')).status).toBe(409);
    expect((await fourth.state(teacher)).result).toEqual(result.result);
    const disk = JSON.parse(readFileSync(join(first.dataDir, 'boxing.json'), 'utf8'));
    expect(disk.rooms[teacher.code].teacherToken).toBe(teacher.token);
    expect(disk.rooms[teacher.code].fighters.map((f: { token: string }) => f.token)).toEqual([a.token, b.token]);
    expect(readdirSync(first.dataDir)).toEqual(['boxing.json']);
  });
  it('marca presencia durante veinte segundos solo al recibir una petición autenticada del jugador', async () => {
    let now = Date.now(); vi.spyOn(Date, 'now').mockImplementation(() => now);
    const h = await harness(); const { teacher, a, b } = await h.players();
    expect((await h.state(teacher)).fighters.map((f) => f.connected)).toEqual([true, true]);
    now += 20_001;
    expect((await h.state(teacher)).fighters.map((f) => f.connected)).toEqual([false, false]);
    await h.state(a);
    expect((await h.state(teacher)).fighters.map((f) => f.connected)).toEqual([true, false]);
    await h.request(`/api/boxing/state?code=${b.code}`, undefined, 'invalid');
    expect((await h.state(teacher)).fighters[1].connected).toBe(false);
  });

  it('valida opciones, pregunta, movimientos, credenciales y método sin mutar el combate', async () => {
    const h = await harness(); const { teacher, a, b } = await h.players(); await h.action(teacher, { type: 'start' });
    const q = (await h.state(a)).question!;
    for (const answer of [-1, 3, 0.5, '0', null]) expect((await h.action(a, { type: 'answer', questionId: q.id, answer })).status).toBe(400);
    expect((await h.action(a, { type: 'answer', questionId: 'old-question', answer: 0 })).status).toBe(409);
    expect((await h.action(teacher, { type: 'answer', questionId: q.id, answer: 0 })).status).toBe(403);
    expect((await h.request('/api/boxing/action', { code: a.code, action: { type: 'reveal' } }, 'invalid')).status).toBe(401);
    const otherTeacher = await h.create();
    expect((await h.request(`/api/boxing/state?code=${a.code}`, undefined, otherTeacher.token)).status).toBe(401);
    expect((await h.action(a, { type: 'invented' })).status).toBe(400);
    expect((await h.state(a)).fighters.map((f) => f.correct + f.wrong)).toEqual([0, 0]);
    await h.answer(a); await h.answer(b);
    expect((await h.action(a, { type: 'move', questionId: q.id, move: 'uppercut' })).status).toBe(400);
    expect((await h.action(a, { type: 'move', questionId: 'old-question', move: 'jab' })).status).toBe(409);
    expect((await h.request('/api/boxing/create')).status).toBe(405);
    const malformed = await fetch(h.base + '/api/boxing/action', { method: 'POST', body: '{oops' }); expect(malformed.status).toBe(400);
    expect((await fetch(h.base + '/api/boxing/create', { method: 'POST', body: JSON.stringify({ huge: 'x'.repeat(33_000) }) })).status).toBe(413);
    expect((await fetch(h.base + '/api/boxing/no-such-route')).status).toBe(404);
    expect((await fetch(h.base + '/not-boxing')).status).toBe(404);
  });

  it('reinicia desde pausa al vestíbulo conservando nombres, ids y credenciales', async () => {
    const h = await harness(); const { teacher, a, b } = await h.players(); await h.action(teacher, { type: 'start' });
    await h.answer(a); await h.answer(b, false); await h.move(a, 'hook'); await h.action(teacher, { type: 'pause' });
    expect((await h.action(a, { type: 'restart' })).status).toBe(403);
    expect((await h.action(teacher, { type: 'restart' })).status).toBe(200);
    const v = await h.state(teacher);
    expect(v).toMatchObject({ phase: 'lobby', exchange: 0, paused: false });
    expect(v.question).toBeUndefined(); expect(v.result).toBeUndefined(); expect(v.winner).toBeUndefined();
    expect(v.fighters.map((f) => f.id)).toEqual([a.pid, b.pid]);
    expect(v.fighters.map((f) => f.name)).toEqual(['Ana', 'Tomás']);
    for (const f of v.fighters) expect(f).toMatchObject({ hp: 100, stamina: 4, correct: 0, wrong: 0, damage: 0, answered: false, lockedMove: false });
    expect((await h.state(a)).ownAnswer).toBeUndefined(); expect((await h.state(b)).ownMove).toBeUndefined();
    expect((await h.action(teacher, { type: 'start' })).status).toBe(200);
  });

  it.each(['question', 'action', 'locked'] as const)('revelar cierra pendientes sin cambiar respuestas ni movimientos bloqueados (%s)', async (phase) => {
    const h = await harness(); const { teacher, a, b } = await h.players(); await h.action(teacher, { type: 'start' });
    await h.answer(a); if (phase !== 'question') await h.answer(b);
    if (phase === 'locked') await h.move(a, 'jab');
    expect((await h.action(a, { type: 'reveal' })).status).toBe(403);
    await h.action(teacher, { type: 'pause' });
    expect((await h.action(teacher, { type: 'reveal' })).status).toBe(200);
    const v = await h.state(teacher); expect(v.phase).toBe('result'); expect(v.paused).toBe(true);
    expect(v.fighters.map((f) => f.correct)).toEqual([1, phase === 'question' ? 0 : 1]);
    expect(v.fighters[1].wrong).toBe(phase === 'question' ? 1 : 0);
    expect(v.result!.fighters.map((f) => f.move)).toEqual([phase === 'locked' ? 'jab' : 'recover', 'recover']);
    expect((await h.action(teacher, { type: 'reveal' })).status).toBe(409);
    expect((await h.state(teacher)).fighters).toEqual(v.fighters);
  });

  it('solo el profesor pausa; no hay respuestas ni movimientos hasta reanudar', async () => {
    const h = await harness(); const { teacher, a, b } = await h.players(); await h.action(teacher, { type: 'start' });
    expect((await h.action(a, { type: 'pause' })).status).toBe(403);
    expect((await h.action(teacher, { type: 'pause' })).status).toBe(200);
    expect((await h.answer(a)).status).toBe(409); expect((await h.state(a)).ownAnswer).toBeUndefined();
    expect((await h.state(teacher)).paused).toBe(true);
    expect((await h.action(a, { type: 'resume' })).status).toBe(403);
    await h.action(teacher, { type: 'resume' }); await h.answer(a); await h.answer(b);
    await h.action(teacher, { type: 'pause' }); expect((await h.move(a, 'jab')).status).toBe(409);
    expect((await h.state(a)).ownMove).toBeUndefined();
    await h.action(teacher, { type: 'resume' }); expect((await h.move(a, 'jab')).status).toBe(200);
  });

  it.each([false, true])('termina al caer HP a cero; doble KO es empate incluso con más aciertos=%s', async (double) => {
    const h = await harness(); const { teacher, a, b } = await h.players(); await h.action(teacher, { type: 'start' });
    if (double) {
      await h.answer(a); await h.answer(b, false); await h.move(a, 'guard'); await h.action(teacher, { type: 'next' });
    }
    for (let i = 0; i < 11; i++) {
      await h.answer(a); await h.answer(b, double);
      const move = i === 0 ? 'cross' : i === 1 ? 'hook' : 'jab';
      await h.move(a, move); if (double) await h.move(b, move);
      const v = await h.state(teacher);
      if (i < 10) { expect(v.phase).toBe('result'); await h.action(teacher, { type: 'next' }); }
      else {
        expect(v.phase).toBe('finished'); expect(v.winner).toBe(double ? 'draw' : a.pid);
        expect(v.fighters[1].hp).toBe(0); expect(v.fighters[0].damage).toBe(100);
        if (double) expect(v.fighters[0].hp).toBe(0);
      }
    }
  }, 20_000);
  it('rechaza ataques sin energía y conserva la elección disponible', async () => {
    const h = await harness(); const { teacher, a, b } = await h.players(); await h.action(teacher, { type: 'start' });
    await h.answer(a); await h.answer(b); await h.move(a, 'hook'); await h.move(b, 'guard');
    await h.action(teacher, { type: 'next' }); await h.answer(a); await h.answer(b);
    expect((await h.state(a)).fighters[0].stamina).toBe(2);
    expect((await h.move(a, 'hook')).status).toBe(409);
    expect((await h.state(a)).ownMove).toBeUndefined();
    expect((await h.move(a, 'cross')).status).toBe(200); await h.move(b, 'guard');
    expect((await h.state(a)).fighters[0].stamina).toBe(1);
  });

  it.each(['hp', 'correct', 'draw'] as const)('el profesor avanza doce intercambios sin repetir y decide por %s', async (mode) => {
    const h = await harness(); const { teacher, a, b } = await h.players();
    await h.action(teacher, { type: 'start' });
    expect((await h.action(a, { type: 'next' })).status).toBe(403);
    expect((await h.action(teacher, { type: 'next' })).status).toBe(409);
    const ids = new Set<string>();
    for (let i = 1; i <= 12; i++) {
      const v = await h.state(a); expect(v.exchange).toBe(i); ids.add(v.question!.id);
      expect(v.ownAnswer).toBeUndefined(); expect(v.ownMove).toBeUndefined(); expect(v.result).toBeUndefined();
      await h.answer(a); await h.answer(b, mode !== 'correct' && !(mode === 'hp' && i === 1));
      await h.move(a, mode === 'hp' && i === 1 ? 'jab' : 'guard');
      if (mode === 'draw' || mode === 'hp' && i > 1) await h.move(b, 'guard');
      const result = await h.state(teacher);
      expect(result.phase).toBe(i === 12 ? 'finished' : 'result');
      if (i < 12) expect((await h.action(teacher, { type: 'next' })).status).toBe(200);
    }
    expect(ids.size).toBe(12);
    const end = await h.state(teacher);
    expect(end.winner).toBe(mode === 'draw' ? 'draw' : a.pid);
    expect((await h.action(teacher, { type: 'next' })).status).toBe(409);
  }, 20_000);

  it.each([true, false])('un fallo bloquea el ataque y recupera automáticamente; rival correcto=%s', async (otherCorrect) => {
    const h = await harness(); const { teacher, a, b } = await h.players();
    await h.action(teacher, { type: 'start' });
    expect((await h.answer(a, false)).status).toBe(200);
    expect((await h.move(a, 'jab')).status).toBe(409);
    expect((await h.answer(b, otherCorrect)).status).toBe(200);
    if (otherCorrect) {
      expect((await h.state(teacher)).phase).toBe('action');
      expect((await h.move(a, 'guard')).status).toBe(409);
      expect((await h.move(b, 'cross')).status).toBe(200);
    }
    const done = await h.state(a);
    expect(done.phase).toBe('result');
    expect(done.result!.fighters[0]).toMatchObject({ move: 'recover', correct: false, damageDealt: 0 });
    expect(done.fighters[0]).toMatchObject({ correct: 0, wrong: 1, hp: otherCorrect ? 88 : 100, stamina: 5 });
    if (!otherCorrect) expect(done.result!.fighters.map((f) => f.move)).toEqual(['recover', 'recover']);
  });

  it.each<{ moves: [BoxingMove, BoxingMove]; hp: number[]; stamina: number[]; damage: number[]; blocked?: boolean; dodged?: boolean }>([
    { moves: ['jab', 'hook'], hp: [84, 92], stamina: [4, 2], damage: [8, 16] },
    { moves: ['cross', 'guard'], hp: [100, 97], stamina: [3, 5], damage: [3, 0], blocked: true },
    { moves: ['hook', 'guard'], hp: [100, 96], stamina: [2, 5], damage: [4, 0], blocked: true },
    { moves: ['jab', 'guard'], hp: [100, 98], stamina: [4, 5], damage: [2, 0], blocked: true },
    { moves: ['hook', 'dodge'], hp: [100, 100], stamina: [2, 4], damage: [0, 0], dodged: true },
    { moves: ['cross', 'dodge'], hp: [100, 100], stamina: [3, 4], damage: [0, 0], dodged: true },
    { moves: ['jab', 'dodge'], hp: [100, 92], stamina: [4, 4], damage: [8, 0] },
    { moves: ['guard', 'guard'], hp: [100, 100], stamina: [5, 5], damage: [0, 0] },
  ])('resuelve una sola vez los movimientos simultáneos $moves', async ({ moves, hp, stamina, damage, blocked, dodged }) => {
    const h = await harness(); const { teacher, a, b } = await h.players();
    await h.action(teacher, { type: 'start' }); await h.answer(a); await h.answer(b);
    expect((await h.move(a, moves[0])).status).toBe(200);
    expect((await h.state(a)).ownMove).toBe(moves[0]);
    expect((await h.state(b)).ownMove).toBeUndefined();
    expect((await h.state(teacher)).phase).toBe('action');
    expect((await h.move(a, 'jab')).status).toBe(409);
    expect((await h.move(b, moves[1])).body).toEqual({ ok: true });
    const done = await h.state(teacher);
    expect(done.phase).toBe('result');
    expect(done.fighters.map((f) => f.hp)).toEqual(hp);
    expect(done.fighters.map((f) => f.stamina)).toEqual(stamina);
    expect(done.fighters.map((f) => f.damage)).toEqual(damage);
    expect(done.result!.fighters.map((f) => f.damageDealt)).toEqual(damage);
    expect(done.result!.fighters[1].blocked).toBe(blocked ?? false);
    expect(done.result!.fighters[1].dodged).toBe(dodged ?? false);
    expect(done.result!.answer).toBeTruthy(); expect(done.result!.explanation).toBeTruthy();
    expect((await h.move(b, moves[1])).status).toBe(409);
    expect((await h.state(teacher)).fighters).toEqual(done.fighters);
  });

  it('solo el profesor inicia con dos jugadores; esperan ambos antes de elegir un movimiento', async () => {
    const h = await harness();
    const teacher = await h.create();
    expect((await h.action(teacher, { type: 'start' })).status).toBe(409);
    const a = await h.joinPlayer(teacher.code, 'Ana'); const b = await h.joinPlayer(teacher.code, 'Tomás');
    expect((await h.action(a, { type: 'start' })).status).toBe(403);
    expect((await h.action(teacher, { type: 'start' })).body).toEqual({ ok: true });
    const v = await h.state(a);
    expect(v).toMatchObject({ phase: 'question', exchange: 1 });
    expect(v.question).toEqual((await h.state(b)).question);
    expect(Object.keys(v.question!).sort()).toEqual(['id', 'options', 'prompt', 'topic']);
    expect((await h.state(teacher)).question).toEqual(v.question);
    expect((await h.action(a, { type: 'move', questionId: v.question!.id, move: 'jab' })).status).toBe(409);
    expect((await h.answer(a)).status).toBe(200);
    expect((await h.answer(a, false)).status).toBe(409);
    expect((await h.state(a)).phase).toBe('question');
    expect((await h.state(b)).ownAnswer).toBeUndefined();
    expect((await h.answer(b)).status).toBe(200);
    const ready = await h.state(a);
    expect(ready.phase).toBe('action'); expect(ready.ownCorrect).toBe(true);
    expect(ready.fighters.map((f) => f.correct)).toEqual([1, 1]);
    expect(ready.fighters.map((f) => f.answered)).toEqual([true, true]);
  });

  it('crea una sala privada con un profesor y exactamente dos jugadores independientes', async () => {
    const h = await harness();
    const teacher = await h.create();
    expect(teacher).toEqual({ code: expect.stringMatching(/^[A-Z2-9]{4}$/), token: expect.any(String), role: 'teacher' });
    expect((await h.request(`/api/boxing/state?code=${teacher.code}`)).status).toBe(401);
    const a = await h.joinPlayer(teacher.code, 'Ana');
    const b = await h.joinPlayer(teacher.code, 'Tomás');
    expect(a.role).toBe('player'); expect(a.pid).toBeTruthy();
    expect(new Set([teacher.token, a.token, b.token]).size).toBe(3);
    const view = await h.state(a);
    expect(view).toMatchObject({ phase: 'lobby', exchange: 0, maxExchanges: 12, paused: false, role: 'player', me: a.pid });
    expect(view.fighters.map((f) => ({ name: f.name, hp: f.hp, stamina: f.stamina }))).toEqual([
      { name: 'Ana', hp: 100, stamina: 4 }, { name: 'Tomás', hp: 100, stamina: 4 },
    ]);
    for (const token of [teacher.token, a.token, b.token]) expect(JSON.stringify(view)).not.toContain(token);
    expect((await h.request('/api/boxing/join', { code: teacher.code, name: 'Tercero' })).status).toBe(409);
    expect((await h.state(teacher)).role).toBe('teacher');
  });
});
