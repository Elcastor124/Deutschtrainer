// Prueba de extremo a extremo: servidor real + 3 clientes WebSocket (profesor y dos alumnos).
// Uso: node scripts/e2e.mjs
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
import { loadBank } from '../server/bank/index.ts';

const PORT = 3900 + Math.floor(Math.random() * 80);
const URL = `ws://127.0.0.1:${PORT}/ws`;
const DATA = mkdtempSync(join(tmpdir(), 'bc-e2e-'));
const bank = loadBank();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ✔' : '  ✘'} ${msg}`); if (!cond) failures++; };

let server;
async function startServer() {
  server = spawn(process.execPath, ['server/index.ts'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: DATA }, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stderr.on('data', (d) => { const s = String(d); if (!s.includes('ExperimentalWarning') && !s.includes('--trace-warnings')) process.stderr.write(s); });
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/api/health`); if (r.ok) return; } catch { /* aún no */ }
    await sleep(150);
  }
  throw new Error('el servidor no arranca');
}
async function stopServer() {
  const done = new Promise((r) => server.once('exit', r));
  server.kill();
  await done;
}

class Client {
  constructor(label, hello) { this.label = label; this.hello = hello; this.state = null; this.welcome = null; this.seq = 0; this.acks = new Map(); this.waits = new Set(); this.errors = []; }
  connect() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(URL);
      this.ws = ws;
      let first = true;
      ws.on('open', () => ws.send(JSON.stringify(this.hello)));
      ws.on('error', reject);
      ws.on('message', (d) => {
        const m = JSON.parse(String(d));
        if (m.t === 'welcome') { this.welcome = m; this.hello = { t: 'hello', role: m.role, room: m.room, token: m.token }; }
        else if (m.t === 'state') { this.state = m.s; for (const w of this.waits) w(); if (first) { first = false; resolve(); } }
        else if (m.t === 'ack') { this.acks.get(m.id)?.(m); this.acks.delete(m.id); }
        else if (m.t === 'err') { this.errors.push(m.msg); if (m.fatal) reject(new Error(m.msg)); }
      });
    });
  }
  req(msg) { const id = ++this.seq; return new Promise((res) => { this.acks.set(id, res); this.ws.send(JSON.stringify({ ...msg, id })); }); }
  ctl(a) { return this.req({ t: 'ctl', a }); }
  until(pred, what, ms = 5000) {
    return new Promise((res, rej) => {
      const check = () => { try { if (this.state && pred(this.state)) { this.waits.delete(check); clearTimeout(t); res(this.state); } } catch { /* sigue */ } };
      const t = setTimeout(() => { this.waits.delete(check); rej(new Error(`${this.label}: timeout esperando ${what} (fase ${this.state?.phase})`)); }, ms);
      this.waits.add(check);
      check();
    });
  }
  close() { return Promise.race([new Promise((r) => { this.ws.once('close', r); this.ws.close(); }), sleep(1500).then(() => this.ws.terminate())]); }
}

function answerFor(pub, good) {
  const q = bank.get(pub.id);
  if (!good) {
    switch (q.type) {
      case 'mc': return { choice: pub.options.findIndex((o) => o !== q.options[q.answer]) };
      case 'write': case 'build': return { text: 'qqq zzz' };
      case 'gap': return { gaps: q.gaps.map(() => 'qqq') };
      case 'order': return { order: answerFor(pub, true).order.reverse() };
      case 'error': return { index: (q.wrong + 1) % q.tokens.length, fix: 'qqq' };
      case 'match': return { pairs: q.pairs.map(() => 0) };
    }
  }
  switch (q.type) {
    case 'mc': return { choice: pub.options.indexOf(q.options[q.answer]) };
    case 'write': case 'build': return { text: q.accept[0] };
    case 'gap': return { gaps: q.gaps.map((g) => g[0]) };
    case 'order': { const used = new Set(); return { order: q.tokens.map((t) => { const i = pub.tokens.findIndex((x, k) => x === t && !used.has(k)); used.add(i); return i; }) }; }
    case 'error': return { index: q.wrong, fix: q.fix[0] };
    case 'match': return { pairs: q.pairs.map((p) => pub.right.indexOf(p[1])) };
  }
}
const score = (c, pid) => c.state.players.find((p) => p.id === pid)?.score;

try {
  await startServer();
  console.log(`servidor en :${PORT} · datos en ${DATA}`);

  console.log('\n1 · Sala y tres clientes');
  const T = new Client('profesor', { t: 'hello', role: 'teacher', create: true });
  await T.connect();
  const room = T.welcome.room;
  ok(/^[A-Z0-9]{4}$/.test(room), `el profesor crea la sala ${room}`);
  const A = new Client('Ana', { t: 'hello', role: 'player', room, name: 'Ana', profile: 'e2e-profile-ana' });
  const B = new Client('Tomás', { t: 'hello', role: 'player', room, name: 'Tomás', profile: 'e2e-profile-tom' });
  await Promise.all([A.connect(), B.connect()]);
  await T.until((s) => s.players.length === 2 && s.players.every((p) => p.connected), 'dos alumnos conectados');
  ok(true, 'dos alumnos conectados y visibles para el profesor');
  const bad = new Client('intruso', { t: 'hello', role: 'player', room: 'ZZZZ', name: 'X' });
  ok(await bad.connect().then(() => false, () => true), 'un código inexistente se rechaza');
  const fake = new Client('falso profe', { t: 'hello', role: 'teacher', room, token: 'nope' });
  ok(await fake.connect().then(() => false, () => true), 'sin token no se puede controlar la sala');
  ok((await A.ctl({ k: 'next' })).ok === false, 'un alumno no puede usar controles del profesor');

  console.log('\n2 · Pregunta sincronizada, respuestas, puntos y ranking');
  ok((await T.ctl({ k: 'next' })).ok, 'empieza la clase (Leseverstehen)');
  await A.until((s) => s.phase === 'intro' && s.block === 'lesen', 'intro lectura');
  await T.ctl({ k: 'next' });
  const [sa, sb, st] = await Promise.all([A.until((s) => s.phase === 'question', 'pregunta'), B.until((s) => s.phase === 'question', 'pregunta'), T.until((s) => s.phase === 'question', 'pregunta')]);
  ok(sa.q.id === sb.q.id && sb.q.id === st.q.id, 'los tres ven la misma pregunta');
  ok(sa.timer.endsAt === sb.timer.endsAt && sb.timer.endsAt === st.timer.endsAt, 'temporizador compartido (mismo instante de fin)');
  ok(!('answer' in sa.q) && !('accept' in sa.q) && !sa.teacher && !!st.teacher?.solution, 'el alumno no recibe la solución; el profesor sí');
  const q1 = sa.q;
  ok((await A.req({ t: 'answer', qid: q1.id, a: answerFor(q1, true) })).ok, 'Ana responde');
  await T.until((s) => s.players.find((p) => p.id === A.welcome.pid).answered, 'Ana marcada como respondida');
  ok((await A.req({ t: 'answer', qid: q1.id, a: answerFor(q1, true) })).ok === false, 'no puede responder dos veces');
  await B.req({ t: 'answer', qid: q1.id, a: answerFor(q1, false) });
  const r1 = await T.until((s) => s.phase === 'reveal', 'corrección');
  const pts = q1.points;
  ok(r1.reveal.results[A.welcome.pid].status === 'correct' && r1.reveal.results[B.welcome.pid].status === 'wrong', 'el servidor valida: Ana bien, Tomás mal');
  await A.until((s) => s.phase === 'reveal', 'reveal Ana');
  ok(score(A, A.welcome.pid) === pts && score(B, B.welcome.pid) === 0, `puntos correctos (+${pts} Ana)`);
  ok(A.state.players[0].id === A.welcome.pid && T.state.players[0].id === A.welcome.pid, 'ranking actualizado en todos los clientes');
  const tomFailed = q1.id;

  console.log('\n3 · Objetos (Ronda 1 y siguientes)');
  // Lee siempre las puntuaciones de la vista del profesor, una vez corregida la pregunta.
  const pa = () => score(T, A.welcome.pid), pb = () => score(T, B.welcome.pid);
  const reveal = async () => { await T.until((s) => s.phase === 'reveal' || s.phase === 'review', 'corrección'); if (T.state.phase === 'review') await T.ctl({ k: 'judgeAll', ok: false }); await T.until((s) => s.phase === 'reveal', 'corrección'); };
  /** Da un objeto; si el inventario está lleno, lo cambia por el primero. */
  const grant = async (c, item) => {
    await T.ctl({ k: 'give', pid: c.welcome.pid, item });
    const s = await c.until((x) => x.me.inventory.includes(item) || x.me.pickups.includes(item), `recibir ${item}`);
    if (!s.me.inventory.includes(item)) { await c.req({ t: 'pickup', discard: 0 }); await c.until((x) => x.me.inventory.includes(item), `colocar ${item}`); }
  };
  const nextQ = async (prev) => { await T.ctl({ k: 'next' }); return (await A.until((s) => s.phase === 'question' && s.q.id !== prev, 'nueva pregunta')).q; };

  await T.ctl({ k: 'block', block: 'r2' });
  await A.until((s) => s.phase === 'intro' && s.block === 'r2' && s.me.inventory.length === 1, 'objeto inicial Ana');
  await B.until((s) => s.phase === 'intro' && s.block === 'r2' && s.me.inventory.length === 1, 'objeto inicial Tomás');
  ok(true, 'cada alumno recibe 1 objeto inicial al empezar la primera ronda con objetos');
  await grant(A, 'double');
  await grant(B, 'shield');
  let q = await nextQ(null);
  // DOUBLE XP y doble uso simultáneo
  const [u1, u2] = await Promise.all([A.req({ t: 'item', item: 'double' }), A.req({ t: 'item', item: 'double' })]);
  ok([u1.ok, u2.ok].filter(Boolean).length === 1, 'doble uso simultáneo: solo uno se acepta');
  // El objeto inicial es aleatorio: se prueba con uno que Tomás seguro no tiene.
  const missing = ['thief', 'sabotage', 'double', 'second', 'wildcard'].find((i) => !B.state.me.inventory.includes(i));
  ok((await B.req({ t: 'item', item: missing, target: A.welcome.pid })).ok === false, `no se puede usar un objeto que no tienes (${missing})`);
  let a0 = pa(), b0 = pb();
  await A.req({ t: 'answer', qid: q.id, a: answerFor(q, true) });
  await B.req({ t: 'answer', qid: q.id, a: answerFor(q, true) });
  await reveal();
  ok(pa() - a0 === q.points * 2, `DOUBLE XP duplica (+${q.points * 2})`);
  ok(pb() - b0 === q.points, `el rival suma lo normal (+${q.points})`);
  ok((await A.req({ t: 'item', item: 'shield' })).ok === false, 'no se pueden usar objetos después de corregir');

  // THIEF + SHIELD como reacción
  await grant(A, 'thief');
  q = await nextQ(q.id);
  ok((await A.req({ t: 'item', item: 'thief', target: B.welcome.pid })).ok, 'Ana activa THIEF contra Tomás');
  await B.until((s) => s.me.incoming.some((x) => x.kind === 'thief'), 'aviso de ataque');
  ok(true, 'Tomás recibe el aviso del ataque en tiempo real');
  ok((await B.req({ t: 'item', item: 'shield' })).ok, 'Tomás reacciona con SHIELD');
  a0 = pa(); b0 = pb();
  await A.req({ t: 'answer', qid: q.id, a: answerFor(q, true) });
  await B.req({ t: 'answer', qid: q.id, a: answerFor(q, true) });
  await reveal();
  ok(pb() - b0 === q.points && pa() - a0 === q.points, 'el SHIELD bloquea el robo (ambos suman lo suyo)');
  ok(T.state.log.some((f) => f.kind === 'block'), 'evento de bloqueo registrado');

  // THIEF sin escudo y nunca más de lo que tiene el rival
  await grant(A, 'thief');
  q = await nextQ(q.id);
  await A.req({ t: 'item', item: 'thief', target: B.welcome.pid });
  a0 = pa(); b0 = pb();
  await B.req({ t: 'answer', qid: q.id, a: answerFor(q, false) });
  await A.req({ t: 'answer', qid: q.id, a: answerFor(q, true) });
  await reveal();
  const stolen = Math.min(5, b0);
  ok(pa() - a0 === q.points + stolen && pb() === b0 - stolen, `THIEF roba ${stolen} (máx. 5, nunca más de lo que tiene)`);

  // SECOND CHANCE + SABOTAGE
  await grant(B, 'second');
  await grant(A, 'sabotage');
  q = await nextQ(q.id);
  for (let k = 0; k < 6 && !q.secondOk; k++) { await T.ctl({ k: 'skip' }); q = await nextQ(q.id); }
  ok((await B.req({ t: 'item', item: 'second' })).ok, 'Tomás activa SECOND CHANCE');
  const first = await B.req({ t: 'answer', qid: q.id, a: answerFor(q, false) });
  ok(first.ok && first.retry === true, 'primer fallo → segundo intento');
  ok((await A.req({ t: 'item', item: 'sabotage', target: B.welcome.pid })).ok, 'Ana sabotea a Tomás');
  b0 = pb();
  await A.req({ t: 'answer', qid: q.id, a: answerFor(q, false) });
  await B.req({ t: 'answer', qid: q.id, a: answerFor(q, true) });
  await reveal();
  ok(pb() - b0 === Math.ceil(Math.ceil(q.points / 2) / 2), 'Second Chance (½) y Sabotage (½) aplicados');

  // WILDCARD: Ana elige la categoría de la siguiente pregunta
  await T.ctl({ k: 'block', block: 'r4' });
  await A.until((s) => s.block === 'r4' && s.phase === 'intro', 'intro r4');
  await grant(A, 'wildcard');
  q = await nextQ(q.id);
  ok((await A.req({ t: 'item', item: 'wildcard' })).ok, 'Ana activa WILDCARD');
  await A.req({ t: 'answer', qid: q.id, a: answerFor(q, true) });
  await B.req({ t: 'answer', qid: q.id, a: answerFor(q, true) });
  await reveal();
  await T.ctl({ k: 'next' });
  const w = await B.until((s) => s.phase === 'wild', 'elección de categoría');
  ok(w.wild.by === A.welcome.pid && w.wild.options.length === 2, 'todos ven que Ana elige entre 2 categorías');
  ok((await B.req({ t: 'wild', topic: w.wild.options[0] })).ok === false, 'Tomás no puede elegir por Ana');
  ok((await A.req({ t: 'wild', topic: w.wild.options[1] })).ok, 'Ana elige categoría');
  const wq = await B.until((s) => s.phase === 'question', 'pregunta elegida');
  ok(wq.q.topic === w.wild.options[1], `la siguiente pregunta es de la categoría elegida (${w.wild.options[1]})`);
  q = wq.q;
  await T.ctl({ k: 'skip' });

  console.log('\n4 · Prüfungsfrage → BlackCard y Final Boss');
  await T.ctl({ k: 'block', block: 'boss' });
  await A.until((s) => s.block === 'boss', 'boss');
  if (!A.state.me.inventory.includes('blackcard')) await grant(A, 'blackcard');
  await T.ctl({ k: 'next' });
  q = (await A.until((s) => s.phase === 'question' && s.block === 'boss', 'pregunta boss')).q;
  ok(q.bc === true && ['hard', 'special'].includes(q.diff), 'la pregunta del Final Boss admite BlackCard');
  ok((await A.req({ t: 'item', item: 'blackcard' })).ok, 'Ana activa la BlackCard');
  ok((await A.req({ t: 'item', item: 'blackcard' })).ok === false, 'la BlackCard no se puede usar dos veces');
  a0 = pa();
  await A.req({ t: 'answer', qid: q.id, a: answerFor(q, true) });
  await B.req({ t: 'answer', qid: q.id, a: answerFor(q, false) });
  await reveal();
  ok(pa() - a0 === q.points + 10, `BlackCard acertada: +${q.points} +10`);
  await A.until((s) => s.phase === 'reveal', 'reveal Ana');
  ok(T.state.log.some((f) => f.kind === 'bc-win'), 'evento de quemado (bc-win) para la animación');
  ok(!A.state.me.inventory.includes('blackcard'), 'la BlackCard se consume');

  console.log('\n5 · Reconexión sin perder puntos');
  const before = score(T, A.welcome.pid);
  await A.close();
  await T.until((s) => !s.players.find((p) => p.id === A.welcome.pid).connected, 'Ana desconectada');
  ok(true, 'el profesor ve a Ana desconectada');
  const A2 = new Client('Ana (vuelve)', A.hello);
  await A2.connect();
  ok(A2.welcome.pid === A.welcome.pid && score(A2, A2.welcome.pid) === before, 'Ana vuelve con el mismo jugador y sus puntos');
  await T.until((s) => s.players.find((p) => p.id === A.welcome.pid).connected, 'Ana conectada');

  console.log('\n6 · Reinicio del servidor (persistencia)');
  await sleep(600);
  const snapshot = T.state.players.map((p) => [p.id, p.score]);
  await stopServer();
  await startServer();
  const T2 = new Client('profesor (vuelve)', T.hello);
  await T2.connect();
  ok(JSON.stringify(T2.state.players.map((p) => [p.id, p.score])) === JSON.stringify(snapshot), 'la sala y las puntuaciones sobreviven al reinicio');
  const B2 = new Client('Tomás (vuelve)', B.hello);
  await B2.connect();
  ok(B2.welcome.pid === B.welcome.pid, 'Tomás se reconecta tras el reinicio');

  console.log('\n7 · Final y modo práctica');
  await T2.ctl({ k: 'block', block: 'final' });
  const fin = await B2.until((s) => s.phase === 'final' && !!s.final, 'final');
  ok(fin.final.players[0].score >= fin.final.players[1].score, 'podio ordenado');
  ok(fin.final.players.find((p) => p.id === B.welcome.pid).errors.some((e) => e.qid === tomFailed), 'el repaso de errores incluye lo que falló Tomás');
  ok(!!B2.welcome.profileCode, `Tomás tiene código de práctica (${B2.welcome.profileCode})`);
  const P = new Client('práctica Tomás', { t: 'hello', role: 'practice', profileCode: B2.welcome.profileCode, name: 'Tomás', topics: [], focus: true });
  await P.connect();
  const pq = await P.until((s) => s.phase === 'question', 'pregunta de práctica');
  ok(pq.mode === 'practice' && pq.timer === null, 'práctica individual sin temporizador');
  const tomStats = new Set(fin.final.players.find((p) => p.id === B.welcome.pid).errors.map((e) => e.qid));
  ok(tomStats.has(pq.q.id), 'la práctica empieza por una pregunta que falló en clase');
  await P.req({ t: 'answer', qid: pq.q.id, a: answerFor(pq.q, false) });
  const pr = await P.until((s) => s.phase === 'reveal', 'corrección práctica');
  ok(!!pr.reveal.explain, 'la práctica muestra la explicación');
  ok((await P.req({ t: 'pnext' })).ok, 'siguiente pregunta en práctica');

  for (const c of [A2, B2, T2, P]) await c.close();
} catch (e) {
  failures++;
  console.error('\n✘ ERROR:', e.message);
} finally {
  if (server && server.exitCode === null) await stopServer();
  rmSync(DATA, { recursive: true, force: true });
  console.log(failures ? `\n${failures} fallo(s)` : '\nTodo correcto');
  process.exit(failures ? 1 : 0);
}
