// Recorrido visual: profesor (1920×1080), Chromebook (1366×768) y móvil (390×844) por todas las pantallas.
// Guarda capturas para revisar el diseño. Uso: npm run build && node scripts/tour.mjs [carpeta]
import { loadBank } from '../server/bank/index.ts';
import { launch, openRoom, sleep } from './cdp.mjs';

const bank = loadBank();
const L = await launch({ shots: process.argv[2] ?? 'shots/tour' });
let n = 0;
const shot = async (p, name) => { await p.shot(`${String(++n).padStart(2, '0')}-${name}`); };
const ctl = (T, a) => T.eval(`globalThis.__bcNet.request({t:'ctl', a:${JSON.stringify(a)}})`);
const req = (P, m) => P.eval(`globalThis.__bcNet.request(${JSON.stringify(m)})`);
const phase = (P) => P.eval(`globalThis.__bcNet.state.view?.phase`);

/** Respuesta correcta o incorrecta para la pregunta pública actual (solo pruebas: se usa el banco del servidor). */
function answerFor(pub, inst, good) {
  const q = bank.get(pub.id);
  switch (q.type) {
    case 'mc': { const right = pub.options.indexOf(q.options[q.answer]); return { choice: good ? right : (right + 1) % pub.options.length }; }
    case 'write': case 'build': return { text: good ? q.accept[0] : 'qqq' };
    case 'gap': return { gaps: q.gaps.map((g) => (good ? g[0] : 'qqq')) };
    case 'order': { const used = new Set(); const o = q.tokens.map((t) => { const i = pub.tokens.findIndex((x, k) => x === t && !used.has(k)); used.add(i); return i; }); return { order: good ? o : [...o].reverse() }; }
    case 'error': return { index: good ? q.wrong : (q.wrong + 1) % q.tokens.length, fix: good ? q.fix[0] : 'qqq' };
    case 'match': return { pairs: q.pairs.map((pr, i) => (good ? pub.right.indexOf(pr[1]) : (i + 1) % q.pairs.length)) };
  }
}

try {
  const T = await L.newPage('profesor', 1920, 1080);
  const A = await L.newPage('Ana', 1366, 768);
  const B = await L.newPage('Tomás', 390, 844, true);
  await T.go('/');
  await T.until(`!!document.querySelector('.matrix')`, 'home');
  await sleep(900);
  await shot(T, 'home');
  await B.go('/');
  await B.until(`!!document.querySelector('.matrix')`, 'home móvil');
  await sleep(700);
  await shot(B, 'home-movil');
  const code = await openRoom(T, [[A, 'Ana'], [B, 'Tomás']]);
  await sleep(900);
  await shot(T, 'lobby');
  await shot(B, 'lobby-movil');

  // Leseverstehen
  await T.key(' ');
  await A.until(`!!document.querySelector('.reading .gl')`, 'lectura');
  await sleep(1200);
  await shot(T, 'lesen-intro');
  await A.click('.reading .gl', 2);
  await shot(A, 'lesen-intro-alumno');
  await T.key(' ');
  await A.until(`globalThis.__bcNet.state.view?.phase === 'question'`, 'pregunta');
  await sleep(900);
  await shot(T, 'pregunta-proyector');
  await shot(A, 'pregunta-alumno');
  await shot(B, 'pregunta-movil');
  const v = await A.state();
  if (v.q.type === 'mc') await A.click('.opt', 0); else await req(A, { t: 'answer', qid: v.q.id, a: {} });
  await sleep(500);
  await shot(A, 'respuesta-bloqueada');
  await req(B, { t: 'answer', qid: v.q.id, a: { choice: 1 } });
  await T.until(`globalThis.__bcNet.state.view?.phase === 'reveal'`, 'reveal');
  await sleep(1300);
  await shot(T, 'correccion-proyector');
  await shot(A, 'correccion-alumno');
  await shot(B, 'correccion-movil');

  // Ronda 1: cofres y objetos
  await ctl(T, { k: 'block', block: 'r1' });
  await A.until(`globalThis.__bcNet.state.view?.block === 'r1'`, 'r1');
  await sleep(1500);
  await shot(T, 'r1-intro');
  await shot(A, 'r1-intro-alumno-cofre');
  await A.click('.chest-tile', 0);
  await A.until(`!!document.querySelector('.chest-big')`, 'escena cofre');
  await sleep(400);
  await shot(A, 'cofre-cerrado');
  for (let i = 0; i < 3; i++) { await A.click('.chest-big'); await sleep(260); }
  await A.until(`!!document.querySelector('.prize')`, 'premio', 5000);
  await sleep(700);
  await shot(A, 'cofre-premio');
  await shot(T, 'cofre-proyector');
  await A.click('.prize .btn.primary');
  // Tomás abre el suyo desde el móvil
  await B.click('.chest-tile', 0);
  for (let i = 0; i < 3; i++) { await B.click('.chest-big'); await sleep(260); }
  await B.until(`!!document.querySelector('.prize')`, 'premio móvil', 5000);
  await sleep(500);
  await shot(B, 'cofre-premio-movil');
  await B.click('.prize .btn.primary');

  const pa = (await T.state()).players.find((p) => p.name === 'Ana').id;
  const pb = (await T.state()).players.find((p) => p.name === 'Tomás').id;
  await ctl(T, { k: 'give', pid: pa, item: 'thief' });
  await ctl(T, { k: 'give', pid: pb, item: 'shield' });
  await sleep(400);
  for (const P of [A, B]) {
    while ((await P.state()).me.pickups.length) { await req(P, { t: 'pickup', discard: 0 }); await sleep(100); }
  }
  await T.key(' ');
  await A.until(`globalThis.__bcNet.state.view?.phase === 'question'`, 'pregunta r1');
  await sleep(800);
  await shot(A, 'r1-pregunta-mano');
  const inv = (await A.state()).me.inventory;
  await A.click('.cards .card3d .front', inv.indexOf('thief'));
  await sleep(700);
  await shot(A, 'carta-girada');
  await A.click('.card3d.flipped .targets .btn');
  await sleep(450);
  await shot(T, 'objeto-thief-proyector');
  await shot(B, 'objeto-thief-movil');
  await sleep(1800);
  await shot(B, 'aura-punto-de-mira');
  const q1 = (await A.state()).q;
  const inst = null;
  await req(A, { t: 'answer', qid: q1.id, a: answerFor(q1, inst, true) });
  await req(B, { t: 'answer', qid: q1.id, a: answerFor(q1, inst, false) });
  await T.until(`globalThis.__bcNet.state.view?.phase === 'reveal'`, 'reveal r1');
  await sleep(700);
  await shot(T, 'robo-proyector');
  await shot(A, 'robo-alumno');
  await sleep(1500);

  // Boss con BlackCard
  await ctl(T, { k: 'block', block: 'boss' });
  await A.until(`globalThis.__bcNet.state.view?.block === 'boss'`, 'boss');
  await sleep(1200);
  await shot(T, 'boss-intro');
  await T.key(' ');
  await A.until(`globalThis.__bcNet.state.view?.phase === 'question'`, 'pregunta boss');
  await sleep(900);
  await shot(A, 'boss-pregunta');

  // Podio
  await ctl(T, { k: 'block', block: 'final' });
  await T.until(`!!document.querySelector('.podium')`, 'podio');
  await sleep(4200);
  await shot(T, 'podio');
  await shot(A, 'podio-alumno');

  // Acto II
  await T.key(' ');
  await A.until(`globalThis.__bcNet.state.view?.block === 'rolle'`, 'rolle');
  await sleep(1400);
  await shot(T, 'rolle-intro');
  await T.key(' ');
  await A.until(`globalThis.__bcNet.state.view?.phase === 'task'`, 'tarea');
  await sleep(700);
  await shot(A, 'rolle-escribir');
  const set = (await A.state()).task.sets[pa];
  const extra = ` Plötzlich kommt ${set.words[0].de.replace(/^(der|die|das) /, 'die ')} und dann ${set.words[1].de}!`;
  await A.eval(`(()=>{const t=document.querySelector('textarea'); t.focus(); t.setSelectionRange(t.value.length,t.value.length); return true})()`);
  await L.send('Input.insertText', { text: extra }, A.sid);
  await sleep(1600);
  await shot(A, 'rolle-palabras-usadas');
  await shot(T, 'rolle-progreso');
  await shot(B, 'rolle-movil');
  await T.key(' ');
  await sleep(1000);
  await shot(T, 'rolle-mostrar');
  await T.key(' ');
  await sleep(1200);
  await shot(T, 'rolle-fin');

  // Escenas
  await T.key(' ');
  await T.key(' ');
  await A.until(`globalThis.__bcNet.state.view?.task?.kind === 'szene'`, 'escena');
  await sleep(900);
  await shot(T, 'szene-proyector');
  await shot(A, 'szene-tarjeta');
  await shot(B, 'szene-movil');
  await T.key(' '); await T.key(' ');
  await sleep(600);
  await T.click('.goal-ctl .btn', 0);
  await sleep(500);
  await shot(T, 'szene-objetivos');
  await T.key(' ');

  // Schreibwerkstatt
  await T.key(' ');
  await T.key(' ');
  await A.until(`globalThis.__bcNet.state.view?.task?.kind === 'wort'`, 'wort');
  await sleep(800);
  await shot(A, 'wort-escribir');
  await T.key(' '); await T.key(' ');

  // Freies Schreiben
  await T.key(' ');
  await T.key(' ');
  await A.until(`globalThis.__bcNet.state.view?.task?.kind === 'frei'`, 'frei');
  await sleep(800);
  await shot(A, 'frei-elegir');
  await A.click('.prompt-card', 0);
  await sleep(500);
  await A.type('textarea', 'Gestern bin ich mit dem Bus zur Schule gefahren, weil mein Fahrrad kaputt war. Zuerst habe ich Kaffee getrunken.');
  await sleep(1300);
  await shot(A, 'frei-escribir');
  await T.key(' '); await T.key(' ');

  // Jenga
  await T.key(' ');
  await T.key(' ');
  await A.until(`globalThis.__bcNet.state.view?.task?.kind === 'jenga'`, 'jenga');
  await sleep(1000);
  await shot(T, 'jenga-proyector');
  const turnPage = async () => ((await T.state()).task.turn === pa ? A : B);
  for (let round = 0; round < 3; round++) {
    const P = await turnPage();
    const t = (await T.state()).task;
    if (t.speak) await ctl(T, { k: 'task', op: 'judge', ok: round % 2 === 0 });
    else await req(P, { t: 'answer', qid: t.q.id, a: answerFor(t.q, null, round % 2 === 0) });
    await sleep(500);
    if (round === 0) { await shot(P, 'jenga-quitar'); }
    let tt = (await T.state()).task;
    while (tt.stage === 'pull') {
      const lv = tt.levels.findIndex((l, i) => i < tt.levels.length - 2 && l[0] === 1 && l[1] === 1);
      await req(P, { t: 'pull', level: lv, slot: 0 });
      await sleep(500);
      tt = (await T.state()).task;
    }
  }
  await sleep(500);
  await shot(T, 'jenga-torre');
  await shot(A, 'jenga-alumno');
  // Derribar la torre: quitar la pieza central y una lateral del mismo piso.
  let tt = (await T.state()).task;
  const P = await turnPage();
  if (tt.speak) await ctl(T, { k: 'task', op: 'judge', ok: false }); else await req(P, { t: 'answer', qid: tt.q.id, a: answerFor(tt.q, null, false) });
  await sleep(400);
  await req(P, { t: 'pull', level: 1, slot: 1 });
  await sleep(300);
  await req(P, { t: 'pull', level: 1, slot: 0 });
  await sleep(1800);
  await shot(T, 'jenga-caida');
  await shot(P, 'jenga-caida-alumno');

  // Feierabend
  await T.key(' ');
  await T.key(' ');
  await T.until(`globalThis.__bcNet.state.view?.block === 'ende'`, 'ende');
  await sleep(4500);
  await shot(T, 'feierabend');
  await shot(B, 'feierabend-movil');
  for (const p of [T, A, B]) { const e = p.errors(); if (e.length) console.log(p.label, 'errores JS:', e.slice(0, 5)); }
  console.log('sala', code, '· capturas:', n);
} catch (e) {
  console.error('ERROR', e.message);
}
await L.close();
process.exit(0);
