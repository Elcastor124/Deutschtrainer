// Prueba de navegador de Redet mit Klaus (/hablar): menú → alta → situación → 2 mensajes (uno con error) → corrección → terminar → resumen.
// Uso: node tests/redet-browser.mjs [--base http://localhost:5173]  (sin --base arranca su propio servidor, sin IA: guion de práctica)
import { mkdirSync } from 'node:fs';
import { plusAll } from './helpers/plus-browser.mjs';
import { launch, sleep } from '../scripts/cdp.mjs';
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const OUT = 'shots/redet'; mkdirSync(OUT, { recursive: true });
const L = await launch({ shots: OUT, ...(arg('--base') ? { base: arg('--base') } : {}) });
const fails = [];
const waitFor = async (P, js, ms = 12000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await P.eval(js)) return true; await sleep(150); } return false; };
const has = (sel) => `!!document.querySelector(${JSON.stringify(sel)})`;
const check = (ok, msg) => { console.log(`${ok ? 'OK ' : 'FAIL'} ${msg}`); if (!ok) fails.push(msg); };
const type = (P, text) => P.eval(`(() => { const i = document.querySelector('#rd-input'); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(i, ${JSON.stringify(text)}); i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
const register = async (P, pre) => {
  const st = await P.eval(`fetch('/api/account/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({alias:'${pre}'+Date.now().toString(36).slice(-6),password:'zorro-azul-mesa-72-lluvia'})}).then(r=>r.status)`);
  await P.eval(`localStorage.setItem('dt:student-session','cookie'); true`); await plusAll(L.base); return st;
};
try {
  const P = await L.newPage('rd', 1440, 900);
  await L.send('Page.bringToFront', {}, P.sid);
  await P.go('/?intro=0'); await waitFor(P, has('.dt-nav-links a[href="/hablar"]'));
  // Sin sesión: puerta de acceso, y el menú tiene una única entrada «Hablar»
  check(await P.eval(`[...document.querySelectorAll('.dt-nav-links a')].filter(a => a.getAttribute('href') === '/hablar').length`) === 1, 'el menú tiene una sola entrada a /hablar');
  await P.eval(`document.querySelector('.dt-nav-links a[href="/hablar"]').click(); true`);
  check(await waitFor(P, has('.rd-gate')), 'sin sesión pide entrar');
  check(await P.eval(`document.querySelector('.dt-nav-links a[aria-current=page]')?.getAttribute('href')`) === '/hablar', 'el menú marca «Hablar»');
  const st = await register(P, 'Rd'); check(st === 200 || st === 201, `alta de alumno (${st})`);
  await P.go('/hablar?intro=0');
  // 6 situaciones guiadas; la conversación libre tiene su propio bloque (no se repite en la lista).
  check(await waitFor(P, `document.querySelectorAll('.rd-scene').length >= 6`), 'lista de 6 situaciones guiadas');
  check(await P.eval(`![...document.querySelectorAll('.rd-scene')].some(li => li.textContent.includes('Conversación libre'))`), 'la libre no se repite en la lista');
  check(await P.eval(`document.querySelectorAll('[data-redet-free] .rd-topic').length >= 5`), 'modo libre: temas + «En blanco»');
  check(await P.eval(`document.querySelector('.rd-status')?.textContent.includes('Modo práctica')`), 'sin IA lo dice («Modo práctica»)');
  // A2 desbloquea «vacaciones»; A1 la marca solo A2
  check(await P.eval(`[...document.querySelectorAll('.rd-scene')].some(li => li.classList.contains('is-off') && li.textContent.includes('vacaciones'))`), 'vacaciones es solo A2 en el nivel A1');
  await P.shot('scenes');
  await P.eval(`document.querySelector('.rd-scene:not(.is-off) .btn.primary').click(); true`);
  check(await waitFor(P, has('.rd-room .rd-log .rd-msg.is-klaus')), 'empieza la conversación con la frase de Klaus');
  check(await P.eval(`document.querySelector('.rd-msg.is-klaus p').textContent`) === 'Hallo! Ich bin Klaus. Wie heißt du?', 'apertura del escenario');
  // Frase útil → se añade al texto
  await P.eval(`document.querySelector('.rd-phrase').click(); true`);
  check((await P.eval(`document.querySelector('#rd-input').value`)).startsWith('Ich heiße'), 'una frase útil se inserta en la respuesta');
  await type(P, 'Ich heiße Ana. Ich habe 15 Jahre.');
  await P.eval(`document.querySelector('.rd-compose button[type=submit]').click(); true`);
  check(await waitFor(P, `document.querySelectorAll('.rd-msg.is-klaus').length === 2`), 'Klaus responde');
  check(await P.eval(`[...document.querySelectorAll('.rd-fixes li.k-error ins')].some(x => x.textContent.includes('Ich bin 15 Jahre alt'))`), 'corrige «Ich habe 15 Jahre» → «Ich bin 15 Jahre alt»');
  check(await P.eval(`document.querySelectorAll('.rd-msg.is-klaus')[1].textContent.includes('guion de práctica')`), 'la respuesta indica que es el guion de práctica');
  await P.shot('correction');
  await type(P, 'Ich komme aus Spanien.');
  await P.eval(`(() => { const t = document.querySelector('#rd-input'); t.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return true; })()`);
  check(await waitFor(P, `document.querySelectorAll('.rd-msg.is-klaus').length === 3`), 'Enter envía el mensaje');
  check(await P.eval(`[...document.querySelectorAll('.rd-msg.is-student')].at(-1).querySelector('.rd-ok') !== null`), 'mensaje correcto: «Sin errores detectados»');
  const tally = await P.eval(`document.querySelector('.rd-tally')?.textContent ?? ''`);
  check(/1\s*errores/.test(tally.replace(/\s+/g, ' ')), `contador de correcciones (${tally.trim()})`);
  await P.eval(`[...document.querySelectorAll('.rd-bar .btn')].find(b => b.textContent.includes('Terminar')).click(); true`);
  check(await waitFor(P, has('.rd-summary')), 'terminar muestra el resumen');
  check(await P.eval(`document.querySelector('.rd-summary').textContent.includes('Ich bin 15 Jahre alt')`), 'el resumen recoge el error');
  await P.shot('summary');
  // Volver: aparece en «Terminadas» y se puede reabrir
  await P.eval(`[...document.querySelectorAll('.rd-summary .btn')].at(-1).click(); true`);
  check(await waitFor(P, has('.rd-past li')), 'la conversación aparece en «Terminadas»');
  // Modo libre: tema «El instituto» → apertura del tema, respuesta del guion del tema y etiqueta en la cabecera
  await P.eval(`[...document.querySelectorAll('[data-redet-free] .rd-topic')].find(b => b.textContent.includes('instituto')).click(); true`);
  check(await waitFor(P, has('.rd-room .rd-msg.is-klaus')), 'modo libre: empieza la conversación');
  check(await P.eval(`document.querySelector('.rd-msg.is-klaus p').textContent`) === 'Hallo! Was ist dein Lieblingsfach in der Schule?', 'modo libre: apertura del tema');
  check(await P.eval(`document.querySelector('.rd-bar h1').textContent.includes('El instituto')`), 'modo libre: el tema se ve en la cabecera');
  await type(P, 'Mein Lieblingsfach ist Mathe.'); await P.eval(`document.querySelector('.rd-compose button[type=submit]').click(); true`);
  check(await waitFor(P, `document.querySelectorAll('.rd-msg.is-klaus').length === 2`), 'modo libre: Klaus responde');
  check(await P.eval(`document.querySelectorAll('.rd-msg.is-klaus')[1].textContent.includes('Warum magst du dieses Fach?')`), 'modo libre: sigue el tema elegido');
  await P.shot('free');
  // Móvil
  const M = await L.newPage('rdm', 390, 844, true);
  await L.send('Page.bringToFront', {}, M.sid);
  await M.go('/?intro=0'); await sleep(400); await register(M, 'Rm');
  await M.go('/hablar?intro=0'); check(await waitFor(M, has('.rd-scene .btn.primary')), 'móvil: situaciones');
  check(await M.eval(`document.documentElement.scrollWidth`) <= 390, 'móvil: lista sin desborde');
  await M.eval(`document.querySelector('.rd-scene:not(.is-off) .btn.primary').click(); true`); await waitFor(M, has('#rd-input'));
  await type(M, 'Ich heiße Leo.'); await M.eval(`document.querySelector('.rd-compose button[type=submit]').click(); true`);
  await waitFor(M, `document.querySelectorAll('.rd-msg.is-klaus').length === 2`);
  check(await M.eval(`document.documentElement.scrollWidth`) <= 390, 'móvil: conversación sin desborde');
  await M.shot('mobile');
  const errs = [...P.errors(), ...M.errors()];
  check(errs.length === 0, `sin errores de consola ${errs.length ? JSON.stringify(errs).slice(0, 300) : ''}`);
} finally { await L.close(); }
if (fails.length) { console.log(`\n${fails.length} fallos`); process.exit(1); }
console.log('\nRedet OK');
