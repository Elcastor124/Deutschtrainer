// Prueba de navegador de «Mein Alltag» (Lektion 8), con clics y teclado reales (Edge headless).
// Comprueba que funciona como el resto de presentaciones (mismo motor que unterwegs.html):
//  1) 20 diapositivas, navegación con teclado (→ ← Espacio Inicio Fin, N notas), sin errores de JS.
//  2) Ejercicios: quiz con feedback, constructor de frases, conjugación, tarjetas, Mini-Prüfung con puntuación.
//  3) Se abre desde /curso (Lektion 8) y desde /biblioteca.
//  4) Las demás presentaciones siguen abriendo.
// Uso: npm run build && node tests/mein-alltag-browser.mjs
import { mkdirSync } from 'node:fs';
import { launch, sleep } from '../scripts/cdp.mjs';

const OUT = 'shots/mein-alltag'; mkdirSync(OUT, { recursive: true });
const L = await launch({ shots: OUT });
const fails = [];
const check = (c, m) => { console.log(`${c ? '  ✔' : '  ✘'} ${m}`); if (!c) fails.push(m); };
const waitFor = async (P, expr, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await P.eval(expr).catch(() => false)) return true; await sleep(120); } return false; };
const stamp = Date.now().toString(36).slice(-5), PW = 'zorro-azul-mesa-72-lluvia';
const DECK = '/presentaciones/mein-alltag.html';
const num = (P) => P.eval(`document.querySelector('#num').textContent.trim()`);
const goSlide = async (P, n) => { await P.eval(`go(${n - 1}); true`); await sleep(250); };
const pick = (P, id, k, opt) => P.eval(`(()=>{const d=document.querySelectorAll('#${id} .q')[${k}];const b=[...d.querySelectorAll('.pick')].find(x=>x.dataset.o===${JSON.stringify(opt)});b.click();return d.className})()`);

try {
  const A = await L.newPage('ana', 1440, 900);
  const errors = [];
  await A.go('/registro?intro=0');
  await waitFor(A, `document.readyState==='complete'`);
  const st = await A.eval(`fetch('/api/account/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({alias:'Ma${stamp}',password:'${PW}'})}).then(r=>r.status)`);
  check(st === 200, 'cuenta de prueba creada');
  await A.eval(`localStorage.setItem('dt:student-session','cookie'); localStorage.setItem('dt:student-alias','Ma${stamp}'); true`);

  // ── 1) presentación y teclado
  await A.go(DECK);
  await waitFor(A, `typeof go==='function' && document.querySelector('#num')`);
  await A.eval(`window.__err=[];addEventListener('error',e=>__err.push(e.message));true`);
  check(await A.eval(`document.querySelectorAll('#deck > section.slide').length`) === 20, 'hay 20 diapositivas');
  check(await num(A) === '1 / 20', 'abre en 1 / 20');
  check((await A.eval(`document.title`)).startsWith('Mein Alltag'), 'título «Mein Alltag …»');
  check(await A.eval(`!!document.querySelector('link[href="/design-tokens.css"]') && getComputedStyle(document.body).fontFamily.includes('Space Grotesk')`), 'mismos estilos de marca que el resto (design-tokens, Space Grotesk)');
  await A.key('ArrowRight'); await sleep(200); check(await num(A) === '2 / 20', '→ avanza');
  await A.key('ArrowLeft'); await sleep(200); check(await num(A) === '1 / 20', '← retrocede');
  await A.key('End'); await sleep(200); check(await num(A) === '20 / 20', 'Fin → última');
  await A.key('Home'); await sleep(200); check(await num(A) === '1 / 20', 'Inicio → primera');
  await A.key('n'); check(await A.eval(`document.querySelector('#notes').classList.contains('on') && /min 0–1/.test(document.querySelector('#notes').textContent)`), 'N muestra notas del profesor con los minutos'); await A.key('n');
  let tour = true, det = '';
  for (let n = 1; n <= 20; n++) {
    await goSlide(A, n);
    const ok = await A.eval(`S[i].classList.contains('on') && (S[i].querySelector('h1,h2')?.textContent.trim().length>2)`);
    if (!ok || (await num(A)) !== `${n} / 20`) { tour = false; det = String(n); break; }
  }
  check(tour, `las 20 diapositivas abren con título ${det}`);

  // ── 2) ejercicios
  await goSlide(A, 2);
  await A.key(' '); check(await A.eval(`document.querySelectorAll('#deck > section')[1].querySelectorAll('.flip.open').length`) === 1, 'diap. 2: Espacio gira la primera tarjeta');
  await goSlide(A, 3);
  await A.eval(`document.querySelectorAll('#deck > section')[2].querySelectorAll('.flip').forEach(f=>f.classList.add('open'));true`);
  await A.key(' '); check(await A.eval(`document.querySelectorAll('#deck > section')[2].querySelector('.step').classList.contains('show')`), 'diap. 3: Espacio muestra el truco -en');
  await goSlide(A, 4);
  check((await pick(A, 'q1', 0, 'mein')).includes('bad'), 'diap. 4: «mein» en Ich sehe ___ Bruder → marcado como error');
  check((await pick(A, 'q1', 0, 'meinen')).includes('right'), 'diap. 4: «meinen» → correcto');
  check(await A.eval(`document.querySelector('#q1S').textContent`) === '1 / 5', 'diap. 4: marcador 1 / 5');
  for (const [k, a] of [[1, 'ihre'], [2, 'unser'], [3, 'seinen'], [4, 'deine']]) await pick(A, 'q1', k, a);
  check(await A.eval(`document.querySelector('#q1S').textContent`) === '5 / 5', 'diap. 4: las 5 respuestas correctas dan 5 / 5');
  await goSlide(A, 7);
  check(await A.eval(`document.querySelector('#cjT').textContent`) === 'können', 'diap. 7: empieza en können');
  await A.key(' '); await sleep(150);
  check(await A.eval(`document.querySelector('#cjT').textContent==='müssen' && [...document.querySelectorAll('#cjG b')].map(b=>b.textContent).join(' ')==='muss musst muss müssen müsst müssen'`), 'diap. 7: Espacio → müssen con su conjugación');
  await goSlide(A, 8);
  for (let k = 0; k < 4; k++) await A.key(' ');
  check(await A.eval(`[...S[i].querySelectorAll('.step.show')].length`) === 4, 'diap. 8: los 4 pasos del orden de palabras se revelan con Espacio');
  await goSlide(A, 13);
  check((await pick(A, 'q4', 0, 'auf')).includes('right'), 'diap. 13: prefijo «auf» correcto');
  await goSlide(A, 16);
  await A.eval(`document.querySelectorAll('.builder .tabs .b')[6].click(); true`);
  for (const w of ['Ich', 'muss', 'meinen', 'Bruder', 'anrufen']) await A.eval(`[...document.querySelectorAll('.builder .tiles .tile:not(.used)')].find(t=>t.textContent===${JSON.stringify(w)}).click(); true`);
  await A.eval(`document.querySelector('.builder [data-a=check]').click(); true`);
  check(await A.eval(`document.querySelector('.builder .drop').classList.contains('ok')`), 'diap. 16: construir «Ich muss meinen Bruder anrufen» → correcto');
  await A.eval(`document.querySelector('.builder [data-a=reset]').click(); true`);
  for (const w of ['Ich', 'muss', 'meinen', 'anrufen', 'Bruder']) await A.eval(`[...document.querySelectorAll('.builder .tiles .tile:not(.used)')].find(t=>t.textContent===${JSON.stringify(w)}).click(); true`);
  await A.eval(`document.querySelector('.builder [data-a=check]').click(); true`);
  check(await A.eval(`document.querySelector('.builder .drop').classList.contains('no')`), 'diap. 16: orden incorrecto → error');
  await goSlide(A, 17);
  check(await A.eval(`S[i].querySelectorAll('.rv.open').length===0`), 'diap. 17: soluciones ocultas al entrar');
  await A.key(' '); check(await A.eval(`S[i].querySelectorAll('.rv.open').length===1`), 'diap. 17: Espacio revela una a una');
  await goSlide(A, 19);
  await pick(A, 'q5', 0, 'meinen'); await pick(A, 'q5', 1, 'muss'); await pick(A, 'q5', 2, 'stehe jeden Morgen um sieben Uhr auf.'); await pick(A, 'q5', 3, 'Sie will ihren Bruder anrufen.');
  check(await A.eval(`document.querySelector('#q5S').textContent`) === '3 / 4', 'diap. 19: Mini-Prüfung con un fallo → 3 / 4');
  await sleep(3000); await A.shot('19-pruefung');
  for (const n of [1, 3, 6, 7, 8, 10, 14, 16, 17]) { await goSlide(A, n); if (n === 8 || n === 14) for (let k = 0; k < 4; k++) await A.key(' '); if (n === 17 || n === 6) await A.key(' '); await A.eval(`parts=[];true`); await sleep(1200); await A.shot(String(n).padStart(2, '0')); }
  const errs = await A.eval(`__err`);
  check(errs.length === 0, `sin errores de JS ${errs.join(' | ')}`);

  // ── móvil
  // misma sesión (las presentaciones de la ruta piden cuenta), ventana de móvil
  await L.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, A.sid);
  await A.go(DECK); await waitFor(A, `typeof go==='function'`);
  let mov = true;
  for (let n = 1; n <= 20; n++) { await A.eval(`go(${n - 1});true`); await sleep(120); if (!(await A.eval(`document.documentElement.scrollWidth<=innerWidth+1`))) { mov = false; console.log('   desborde en', n); } }
  await A.eval(`go(3);true`); await sleep(900); await A.shot('mov-04');
  check(mov, 'móvil (390 px): ninguna diapositiva desborda en horizontal');
  await L.send('Emulation.clearDeviceMetricsOverride', {}, A.sid);

  // ── 3) curso y biblioteca
  await A.go('/curso#mein-alltag');
  check(await waitFor(A, `!!document.querySelector('[data-step^="mein-alltag:"]')`), '/curso: aparece la Lektion 8 Mein Alltag');
  check(await A.eval(`[...document.querySelectorAll('h2')].some(h=>h.textContent.includes('Mein Alltag'))`), '/curso: título de la unidad');
  await A.eval(`(()=>{if(!document.querySelector('.cp-pop a[href="${DECK}"]'))document.querySelector('[data-step="mein-alltag:ver"] .cp-tile')?.click();return true})()`);
  check(await waitFor(A, `!!document.querySelector('a[href="${DECK}"]')`, 4000), '/curso: botón «Abrir presentación» apunta a la presentación');
  check(await A.eval(`[...document.querySelectorAll('a')].some(a=>a.getAttribute('href')?.startsWith('/practica')&&a.getAttribute('href').includes('modal')&&a.getAttribute('href').includes('trennbar'))`) || await A.eval(`!!document.querySelector('[data-step="mein-alltag:practicar"]')`), '/curso: paso de práctica de la unidad');
  await A.shot('curso');
  await A.go('/biblioteca');
  check(await waitFor(A, `[...document.querySelectorAll('a')].some(a=>a.getAttribute('href')==='${DECK}')`), '/biblioteca: la presentación está y abre el mismo archivo');
  await A.shot('biblioteca');

  // ── 4) las demás presentaciones siguen abriendo
  const others = await A.eval(`fetch('/presentaciones/catalogo.json').then(r=>r.json()).then(c=>c.map(p=>p.file))`);
  let all = true;
  for (const f of others) { const s = await A.eval(`fetch(${JSON.stringify(f)}).then(r=>r.status)`); if (s !== 200) { all = false; console.log('   ', f, s); } }
  check(all && others.length === 11, `las ${others.length} presentaciones del catálogo responden 200`);
} catch (e) { fails.push(String(e?.stack || e)); console.log(e); }
await L.close();
console.log(fails.length ? `MEIN-ALLTAG BROWSER FAIL (${fails.length})\n - ${fails.join('\n - ')}` : 'MEIN-ALLTAG BROWSER PASS');
process.exit(fails.length ? 1 : 0);
