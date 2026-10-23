// Independent real-HTTP smoke test; does not need server/index.ts or a public port.
// Run: node --disable-warning=ExperimentalWarning scripts/boxing-e2e.mjs
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBoxingHandler } from '../server/boxing.ts';
import { BOXING_BANK } from '../server/boxing-bank.ts';

const dataDir = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'boxing-e2e-'));
let server;
let base;
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; }
async function open() {
  const handler = createBoxingHandler({ dataDir });
  server = createServer((req, res) => {
    const handled = handler(req, res);
    assert.equal(typeof handled, 'boolean', 'handler must return synchronously');
    if (!handled) { res.writeHead(404); res.end('Not found'); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
}
async function close() {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve()); server.closeAllConnections();
  });
}
async function request(path, body, token, expected = 200) {
  const response = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const json = await response.json();
  assert.equal(response.status, expected, JSON.stringify(json)); checks++;
  if (expected !== 200) check(typeof json.error === 'string', 'errors must explain the failure');
  return json;
}
const state = (session) => request(`/api/boxing/state?code=${session.code}`, undefined, session.token);
const action = (session, action, expected) => request('/api/boxing/action', { code: session.code, action }, session.token, expected);
async function answer(session, correct = true, expected) {
  const view = await state(session);
  const q = BOXING_BANK.find((q) => q.id === view.question.id);
  return action(session, { type: 'answer', questionId: q.id, answer: correct ? q.answer : (q.answer + 1) % q.options.length }, expected);
}
async function move(session, move, expected) {
  const view = await state(session);
  return action(session, { type: 'move', questionId: view.question.id, move }, expected);
}

try {
  await open();
  const teacher = await request('/api/boxing/create', {});
  check(/^[A-Z2-9]{4}$/.test(teacher.code), 'four-character room code');
  const a = await request('/api/boxing/join', { code: teacher.code, name: 'Ana' });
  const b = await request('/api/boxing/join', { code: teacher.code, name: 'Tomás' });
  await request('/api/boxing/join', { code: teacher.code, name: 'Tercero' }, undefined, 409);
  await request(`/api/boxing/state?code=${teacher.code}`, undefined, undefined, 401);
  await request('/api/boxing/action', { code: teacher.code, action: { type: 'start' } }, 'invalid', 401);
  await action(a, { type: 'start' }, 403);
  await action(teacher, { type: 'start' });
  const initial = await state(a);
  assert.deepEqual(initial.question, (await state(b)).question); checks++;
  check(!('answer' in initial.question) && !('explanation' in initial.question), 'no answer key before resolution');
  for (const token of [teacher.token, a.token, b.token]) check(!JSON.stringify(initial).includes(token), 'views contain no tokens');

  // Correct + wrong; the wrong player cannot attack, even after the action phase.
  await answer(a); await answer(a, false, 409);
  await move(a, 'jab', 409); // cannot choose until both answer
  await answer(b, false); await move(b, 'hook', 409); await move(a, 'jab');
  let view = await state(teacher);
  check(view.phase === 'result' && view.fighters[1].hp === 92, 'correct jab hits wrong auto-recovery');
  check(view.fighters[1].wrong === 1 && view.result.fighters[1].move === 'recover', 'wrong answer recorded once');
  const resolved = JSON.stringify(view.result); await move(a, 'jab', 409);
  check(JSON.stringify((await state(teacher)).result) === resolved, 'no duplicate scoring');

  const pairs = [
    ['cross', 'guard', 3, true, false],
    ['hook', 'dodge', 0, false, true],
    ['jab', 'dodge', 8, false, false],
  ];
  for (const [attack, defense, damage, blocked, dodged] of pairs) {
    await action(teacher, { type: 'next' });
    await action(teacher, { type: 'pause' }); await answer(a, true, 409);
    await action(teacher, { type: 'resume' }); await answer(a); await answer(b);
    await action(teacher, { type: 'pause' }); await move(a, attack, 409); await action(teacher, { type: 'resume' });
    await move(a, attack);
    check((await state(b)).ownMove === undefined, 'opponent locked move stays private');
    if (attack === 'cross') {
      // Restart the HTTP server while one move is locked and the match is paused.
      await action(teacher, { type: 'pause' });
      const before = await state(a); await close(); await open();
      assert.deepEqual(await state(a), before); checks++;
      await move(b, defense, 409); await action(teacher, { type: 'resume' });
    }
    await move(b, defense);
    view = await state(teacher);
    assert.equal(view.result.fighters[0].damageDealt, damage); checks++;
    assert.equal(view.result.fighters[1].blocked, blocked); checks++;
    assert.equal(view.result.fighters[1].dodged, dodged); checks++;
    check(view.fighters.every((f) => f.stamina >= 0 && f.stamina <= 5), 'stamina bounds');
  }

  // Persist result, HP, statistics and both tokens across a second server restart.
  const resultView = await state(a); await close(); await open();
  assert.deepEqual(await state(a), resultView); checks++;
  check((await state(b)).me === b.pid, 'second independent player resumes with own token');
  const disk = JSON.parse(readFileSync(join(dataDir, 'boxing.json'), 'utf8'));
  check(disk.rooms[teacher.code].teacherToken === teacher.token, 'teacher credential persisted');
  assert.deepEqual(readdirSync(dataDir), ['boxing.json']); checks++;

  // Teacher reveal closes both unanswered players and cannot score twice.
  await action(teacher, { type: 'next' }); await action(a, { type: 'reveal' }, 403); await action(teacher, { type: 'reveal' });
  view = await state(teacher);
  check(view.result.fighters.every((f) => f.move === 'recover' && !f.correct), 'teacher reveals unanswered players as wrong');
  await action(teacher, { type: 'reveal' }, 409);
  await action(teacher, { type: 'restart' });
  view = await state(a);
  check(view.phase === 'lobby' && view.fighters.every((f) => f.hp === 100 && f.stamina === 4 && !f.correct && !f.wrong), 'restart resets combat');
  check(view.fighters.map((f) => f.name).join('|') === 'Ana|Tomás', 'restart keeps names');
  check((await state(b)).me === b.pid, 'restart keeps tokens');
  console.log(`BOXING HTTP E2E PASS — ${checks} assertions; create + 2 players, auth, correct/wrong, five moves, guard/dodge, no double scoring, pause/reveal/restart, refresh and disk persistence.`);
} finally {
  if (server?.listening) await close();
  rmSync(dataDir, { recursive: true, force: true });
}
