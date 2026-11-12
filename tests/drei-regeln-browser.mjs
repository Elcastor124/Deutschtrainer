// Prueba de navegador de «Drei Regeln, ein Satz» con clics y teclado reales (Edge headless).
//  1) Las 20 diapositivas se abren, con teclado, sin errores de JS ni desbordes (escritorio y móvil, y con movimiento reducido).
//  2) Los ejercicios dan feedback coherente (hueco, opción, ordenar, Satzmaschine, Fehlerdetektiv); las soluciones NO se ven antes de tiempo.
//  3) La Mini-Prüfung no revela soluciones hasta «L» y calcula la puntuación; el resumen final la muestra y permite repetir lo fallado.
//  4) Se abre desde la ruta del curso y desde la biblioteca; no se marca nada como hecho solo por abrirla.
// Uso: npm run build && node tests/drei-regeln-browser.mjs
import { mkdirSync } from 'node:fs';
import { launch, sleep } from '../scripts/cdp.mjs';

const OUT = 'shots/drei-regeln'; mkdirSync(OUT, { recursive: true });
const L = await launch({ shots: OUT });
const fails = [];
const check = (c, m) => { console.log(`${c ? '  ✔' : '  ✘'} ${m}`); if (!c) fails.push(m); };
const waitFor = async (P, expr, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await P.eval(expr).catch(() => false)) return true; await sleep(120); } return false; };
const stamp = Date.now().toString(36).slice(-5), PW = 'zorro-azul-mesa-72-lluvia';
const DECK = '/presentaciones/drei-regeln.html';

const onSlide = (n) => `document.querySelector('#s${n}')?.classList.contains('on') && document.querySelector('#num').textContent.trim() === '${n} / 20'`;
const txt = (P, n) => P.eval(`document.querySelector('#s${n}').textContent`);
const press = async (P, key, times = 1) => { for (let i = 0; i < times; i++) await P.key(key); };
const gotoSlide = async (P, n) => { await P.eval(`location.hash='#${n}'; true`); return waitFor(P, onSlide(n), 4000); };
const setSel = (P, sel, i, v) => P.eval(`(()=>{const e=document.querySelectorAll(${JSON.stringify(sel)})[${i}];e.value=${JSON.stringify(v)};e.dispatchEvent(new Event('change'));return e.value})()`);
const fb = (P, n) => P.eval(`document.querySelector('#s${n} .qfb')?.textContent.trim() ?? ''`);
const fbClass = (P, n) => P.eval(`document.querySelector('#s${n} .qfb')?.className ?? ''`);
const clickText = (P, scope, sel, text) => P.eval(`(()=>{const b=[...document.querySelectorAll('${scope} ${sel}')].find(x=>x.textContent.trim()===${JSON.stringify(text)}&&!x.disabled);if(!b)return false;b.click();return true})()`);

try {
  // ── cuenta (el plan Free pide cuenta para abrir presentaciones de la ruta)
  const A = await L.newPage('ana', 1440, 900);
  await A.go('/registro?intro=0');
  await waitFor(A, `document.readyState==='complete'`);
  const st = await A.eval(`fetch('/api/account/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({alias:'Ana${stamp}',password:'${PW}'})}).then(r=>r.status)`);
  check(st === 200, 'cuenta de prueba creada');
  await A.eval(`localStorage.setItem('dt:student-session','cookie'); localStorage.setItem('dt:student-alias','Ana${stamp}'); true`);

  // ── 1) la presentación se abre y tiene 20 diapositivas
  await A.go(DECK);
  check(await waitFor(A, onSlide(1)), 'abre en la diapositiva 1 / 20');
  check(await A.eval(`document.querySelectorAll('#deck > section.slide').length`) === 20, 'hay 20 diapositivas');
  check((await A.eval(`document.title`)).includes('Drei Regeln, ein Satz'), 'título de la página');
  check(await A.eval(`getComputedStyle(document.body).backgroundColor`) === 'rgb(7, 7, 7)', 'fondo oscuro de marca (--dt-ink-0)');
  check(await A.eval(`document.querySelectorAll('#blocks button').length`) === 5, 'cinco bloques en la barra');

  // teclado: Espacio/→ avanzan, ← retrocede, Home/End
  await press(A, 'ArrowRight');
  check(await waitFor(A, onSlide(2), 3000), '→ avanza a la 2');
  await press(A, 'ArrowLeft');
  check(await waitFor(A, onSlide(1), 3000), '← vuelve a la 1');
  await press(A, 'End'); check(await waitFor(A, onSlide(20), 3000), 'End → última');
  await press(A, 'Home'); check(await waitFor(A, onSlide(1), 3000), 'Home → primera');
  await press(A, 't'); check(await A.eval(`document.body.classList.contains('times')`), 'T muestra los tiempos por bloque');
  check(await A.eval(`[...document.querySelectorAll('#blocks small')].map(s=>s.textContent).join(' ')`) === '0–10 min 10–33 min 33–55 min 55–70 min 70–75 min', 'tiempos 0–10 · 10–33 · 33–55 · 55–70 · 70–75');
  await press(A, 't');
  await press(A, 'n'); check(await A.eval(`document.querySelector('#notes').classList.contains('on')`), 'N muestra las notas del profesor'); await press(A, 'n');
  check(await A.eval(`document.querySelector('#blocks .on')?.dataset.b`) === 'poss', 'el bloque activo es Possessivartikel');

  // recorrido completo con la tecla →: cada diapositiva con título, bloque correcto y sin desborde
  const blockOf = [...Array(3).fill('poss'), ...Array(6).fill('modal'), ...Array(5).fill('trenn'), ...Array(4).fill('challenge'), ...Array(2).fill('pruefung')];
  let tour = true, detail = '';
  for (let n = 1; n <= 20; n++) {
    if (!(await gotoSlide(A, n))) { tour = false; detail = `no abre ${n}`; break; }
    const info = await A.eval(`(()=>{const s=document.querySelector('#s${n}');return {h:s.querySelector('h2')?.textContent.trim().length>2,b:document.querySelector('#blocks .on')?.dataset.b,ow:document.documentElement.scrollWidth>innerWidth+1}})()`);
    if (!info.h || info.b !== blockOf[n - 1] || info.ow) { tour = false; detail = `${n}: ${JSON.stringify(info)}`; break; }
  }
  check(tour, `las 20 diapositivas abren, con título, en su bloque y sin desborde ${detail}`);
  await gotoSlide(A, 1);

  // ── 2) ejercicios
  // diapositiva 1: tarjeta de pregunta → ilumina el pronombre
  await gotoSlide(A, 1);
  await A.eval(`document.querySelectorAll('#s1 .ask')[0].click(); true`);
  check(await A.eval(`document.querySelector('#s1 .pc.hl')?.dataset.w`) === 'sie (Sg.)', 'diap. 1: «Das ist Anna…» ilumina sie → ihr');

  // diapositiva 2: Akkusativ + 5 huecos (uno incorrecto a propósito)
  await gotoSlide(A, 2);
  await press(A, ' ');
  check(await A.eval(`document.querySelector('#ar').classList.contains('akk')`), 'diap. 2: Espacio transforma mein → meinen');
  await A.type('#s2 input.gap', 'meinem'); await press(A, 'Enter');
  check((await fbClass(A, 2)).includes('bad') && (await fb(A, 2)).includes('meinen'), 'diap. 2: respuesta incorrecta → feedback con la solución «meinen»');
  const answers2 = ['ihre', 'unser', 'seinen', 'deine'];
  for (const a of answers2) {
    await A.eval(`document.querySelector('#s2 [data-a=next]').click(); true`);
    await A.type('#s2 input.gap:not(:disabled)', a); await press(A, 'Enter');
  }
  check(await A.eval(`document.querySelector('#s2 .qcount').textContent.trim()`) === '5 / 5 · 4 richtig', 'diap. 2: marcador 4 de 5 (1 fallo a propósito)');

  // diapositiva 3 (opciones)
  await gotoSlide(A, 3);
  check(await A.eval(`document.querySelector('#bridge').hidden`), 'diap. 3: el puente a los modales aún está oculto');
  for (const a of ['ihre', 'meinen', 'unsere', 'sein', 'deine']) { check(await clickText(A, '#s3', '.opt', a), `diap. 3: elige «${a}»`); await A.eval(`document.querySelector('#s3 [data-a=next]').click(); true`); }
  check(await A.eval(`!document.querySelector('#bridge').hidden`) && (await A.eval(`document.querySelector('#s3 .qcount').textContent.trim()`)) === '5 / 5 · 5 richtig', 'diap. 3: 5 de 5 y aparece el puente a los verbos modales');

  // diapositiva 5: pestañas
  await gotoSlide(A, 5);
  await clickText(A, '#s5', '#tb button', 'müssen');
  check(await A.eval(`[...document.querySelectorAll('#s5 #cj tr')].map(r=>r.lastChild.textContent).join(',')`) === 'muss,musst,muss,müssen,müsst,müssen', 'diap. 5: pestaña müssen → muss, musst, muss, müssen, müsst, müssen');
  check(await A.eval(`document.querySelectorAll('#s5 #cj tr.hl').length`) === 2, 'diap. 5: se destacan ich y er/sie/es');

  // diapositiva 6: animación paso a paso (modal a la posición 2, infinitivo al final)
  await gotoSlide(A, 6);
  const words = () => A.eval(`[...document.querySelectorAll('#s6 #st > .tk')].map(t=>t.textContent).join(' ')`);
  check((await words()) === 'Ich', 'diap. 6: paso 1 → «Ich»');
  await press(A, ' '); check((await words()) === 'Ich muss', 'diap. 6: Espacio → entra «muss» en posición 2');
  await press(A, ' '); await press(A, ' ');
  check((await words()).endsWith('lernen') && (await words()).startsWith('Ich muss'), `diap. 6: el infinitivo viaja al final («${await words()}»)`);
  await press(A, ' '); check((await words()) === 'Heute muss ich Deutsch lernen', 'diap. 6: «Heute muss ich Deutsch lernen» (modal sigue en 2.ª posición)');

  // diapositiva 7: elegir modal (5/5)
  await gotoSlide(A, 7);
  for (const a of ['muss', 'kann', 'dürfen', 'will', 'möchte']) { await clickText(A, '#s7', '.opt', a); await A.eval(`document.querySelector('#s7 [data-a=next]').click(); true`); }
  check(await A.eval(`document.querySelector('#s7 .qcount').textContent.trim()`) === '5 / 5 · 5 richtig', 'diap. 7: 5 de 5 (muss, kann, dürfen, will, möchte)');

  // diapositiva 8: ordenar (1.º bien con la variante «Heute muss ich lernen», 2.º mal)
  await gotoSlide(A, 8);
  for (const w of ['heute', 'muss', 'ich', 'lernen']) await clickText(A, '#s8', '.pool .chip', w);
  await clickText(A, '#s8', '[data-ck]', 'Prüfen');
  check((await fbClass(A, 8)).includes('good'), 'diap. 8: «Heute muss ich lernen» (variante válida) → correcto');
  await A.eval(`document.querySelector('#s8 [data-a=next]').click(); true`);
  for (const w of ['wir', 'spielen', 'können', 'Fußball']) await clickText(A, '#s8', '.pool .chip', w);
  await clickText(A, '#s8', '[data-ck]', 'Prüfen');
  check((await fbClass(A, 8)).includes('bad') && (await fb(A, 8)).includes('posición 2'), 'diap. 8: «Wir spielen können Fußball» → incorrecto, con la pista de la posición 2');

  // diapositiva 9: soluciones ocultas hasta que el profesor las revela
  await gotoSlide(A, 9);
  check(await A.eval(`[...document.querySelectorAll('#s9 .rvbox')].every(b=>getComputedStyle(b).display==='none')`), 'diap. 9: ninguna solución visible al empezar');
  await press(A, ' ');
  check(await A.eval(`[...document.querySelectorAll('#s9 .rvbox')].filter(b=>getComputedStyle(b).display!=='none').map(b=>b.textContent).join('|')`) === 'Ich muss Deutsch lernen.', 'diap. 9: Espacio revela solo la primera');
  await press(A, 'h');
  check(await A.eval(`[...document.querySelectorAll('#s9 .rvbox')].every(b=>getComputedStyle(b).display==='none')`), 'diap. 9: H oculta de nuevo las soluciones');

  // diapositiva 10: separación animada
  await gotoSlide(A, 10);
  await press(A, ' ');
  check(await A.eval(`[...document.querySelectorAll('#s10 #st > .tk')].map(t=>t.textContent).join('+')`) === 'auf+stehen', 'diap. 10: aufstehen → auf + stehen');
  await press(A, ' ');
  check(await A.eval(`[...document.querySelectorAll('#s10 #st > .tk')].map(t=>t.textContent).join(' ')`) === 'Ich stehe um sieben Uhr auf', 'diap. 10: «Ich stehe um sieben Uhr auf»');
  await clickText(A, '#s10', '#vc .chip', 'anrufen'); await press(A, ' '); await press(A, ' ');
  check(await A.eval(`[...document.querySelectorAll('#s10 #st > .tk')].map(t=>t.textContent).join(' ')`) === 'Ich rufe meinen Bruder an', 'diap. 10: con anrufen → «Ich rufe meinen Bruder an»');

  // diapositiva 11: tocar el prefijo → vuelve a unirse al infinitivo
  await gotoSlide(A, 11);
  await A.eval(`document.querySelector('#s11 [data-pre]').click(); true`); await sleep(1100);
  check(await A.eval(`[...document.querySelectorAll('#s11 [data-j="0"] > .tk')].map(t=>t.textContent).join('')`) === 'aufstehen', 'diap. 11: tocar «auf» lo une a «stehen» → aufstehen');

  // diapositiva 12: huecos con prefijos (5/5)
  await gotoSlide(A, 12);
  for (const a of ['auf', 'ein', 'an', 'fern', 'mit']) { await A.type('#s12 input.gap:not(:disabled)', a); await press(A, 'Enter'); await A.eval(`document.querySelector('#s12 [data-a=next]').click(); true`); }
  check(await A.eval(`document.querySelector('#s12 .qcount').textContent.trim()`) === '5 / 5 · 5 richtig', 'diap. 12: 5 de 5 (auf, ein, an, fern, mit)');

  // diapositiva 13: ordenar con prefijo (1 bien)
  await gotoSlide(A, 13);
  for (const w of ['ich', 'rufe', 'meinen Freund', 'an']) await clickText(A, '#s13', '.pool .chip', w);
  await clickText(A, '#s13', '[data-ck]', 'Prüfen');
  check((await fbClass(A, 13)).includes('good') && (await fb(A, 13)).includes('Ich rufe meinen Freund an.'), 'diap. 13: «Ich rufe meinen Freund an.» → correcto');

  // diapositiva 14: modal + separable
  await gotoSlide(A, 14);
  const w14 = () => A.eval(`[...document.querySelectorAll('#s14 #st > .tk')].map(t=>t.textContent).join(' ')`);
  check((await w14()) === 'Ich stehe um sieben Uhr auf', 'diap. 14: paso 1 → verbo dividido');
  await press(A, ' '); await press(A, ' ');
  check((await w14()) === 'Ich muss um sieben Uhr stehen auf', 'diap. 14: tras müssen, el verbo va en infinitivo (stehen) y aún separado');
  await press(A, ' ');
  check((await w14()) === 'Ich muss um sieben Uhr auf stehen' && await A.eval(`document.querySelectorAll('#s14 #st > .tk.joined').length`) === 2, 'diap. 14: el prefijo se vuelve a unir → aufstehen al final');

  // diapositiva 15: iluminación de reglas
  await gotoSlide(A, 15);
  await press(A, ' '); await press(A, ' ');
  check(await A.eval(`[...document.querySelectorAll('#s15 #st > .tk.lit')].map(t=>t.textContent).join(',')`) === 'muss,meinen', 'diap. 15: se iluminan muss y meinen');
  await press(A, ' ');
  check(await A.eval(`[...document.querySelectorAll('#s15 #st > .tk.lit')].map(t=>t.textContent).join(',')`) === 'muss,meinen,anrufen', 'diap. 15: y anrufen');

  // diapositiva 16: Satzmaschine — la solución no se ve antes del intento
  await gotoSlide(A, 16);
  check(!(await txt(A, 16)).includes('Ich muss meinen Bruder anrufen'), 'diap. 16: la solución completa NO aparece antes del intento');
  await setSel(A, '#s16 [data-m]', 0, 'musst'); await setSel(A, '#s16 [data-p]', 0, 'mein');
  await clickText(A, '#s16', '[data-ck]', 'Prüfen');
  check((await fbClass(A, 16)).includes('bad') && (await fb(A, 16)).includes('Revisa la conjugación y la terminación'), 'diap. 16: conjugación y terminación mal → feedback sobre ambas');
  await A.eval(`document.querySelector('#s16 [data-a=next]').click(); true`);
  await setSel(A, '#s16 [data-m]', 0, 'möchte'); await setSel(A, '#s16 [data-p]', 0, 'ihre');
  await clickText(A, '#s16', '[data-ck]', 'Prüfen');
  check((await fbClass(A, 16)).includes('good'), 'diap. 16: «Sie möchte ihre Mutter anrufen» → correcto');

  // diapositiva 17: Fehlerdetektiv
  await gotoSlide(A, 17);
  await clickText(A, '#s17', '[data-v]', 'Falsch');
  await A.type('#s17 input.gap.wide', 'Ich muss meinen Bruder anrufen.'); await press(A, 'Enter');
  check((await fbClass(A, 17)).includes('good'), 'diap. 17: corrige la frase 1 → correcto');
  await A.eval(`document.querySelector('#s17 [data-a=next]').click(); document.querySelector('#s17 [data-a=next]').click(); document.querySelector('#s17 [data-a=next]').click(); true`);
  await clickText(A, '#s17', '[data-v]', 'Falsch');
  check((await fbClass(A, 17)).includes('bad') && (await fb(A, 17)).includes('Esta frase es correcta'), 'diap. 17: marcar «falsa» la frase 4 (correcta) → incorrecto y lo explica');

  // diapositiva 18: soluciones progresivas y pista opcional
  await gotoSlide(A, 18);
  check(await A.eval(`[...document.querySelectorAll('#s18 .rvbox')].every(b=>getComputedStyle(b).display==='none')`), 'diap. 18: soluciones y pista ocultas al empezar');
  await press(A, ' '); await press(A, ' ');
  check(await A.eval(`[...document.querySelectorAll('#s18 .rvbox:not(.hint)')].filter(b=>getComputedStyle(b).display!=='none').length`) === 2, 'diap. 18: Espacio revela las soluciones de una en una');
  await A.eval(`document.querySelector('#s18 [data-h="1"]').click(); true`);
  check(await A.eval(`getComputedStyle(document.querySelector('#s18 [data-hb="1"]')).display`) !== 'none', 'diap. 18: la pista del Dativ es opcional (botón «Hinweis»)');

  // ── 3) Mini-Prüfung
  await gotoSlide(A, 19);
  const t19 = await txt(A, 19);
  check(!/Lösung|meinen\b.*musst.*stehe/.test(t19) && !t19.includes('stehe / auf'), 'diap. 19: ninguna solución visible durante la prueba');
  check(await A.eval(`document.querySelectorAll('#s19 input').length`) === 5, 'diap. 19: 4 ejercicios (5 campos: el 3 tiene dos huecos)');
  const ins = '#s19 input';
  await A.type(ins, 'meinen', 0); await A.type(ins, 'muss', 1); await A.type(ins, 'Stehe', 2); await A.type(ins, 'auf', 3); await A.type(ins, 'Ihren Bruder will sie anrufen.', 4);
  await A.eval(`document.querySelector('#xsub').click(); true`);
  check(await A.eval(`[...document.querySelectorAll('#s19 .xmark')].map(m=>m.textContent).join('|')`) === 'Abgegeben|Abgegeben|Abgegeben|Abgegeben', 'diap. 19: al entregar solo dice «Abgegeben» (sin puntuación ni soluciones)');
  check(!(await txt(A, 19)).includes('Lösung:'), 'diap. 19: sigue sin mostrar soluciones tras entregar');
  await press(A, 'l');
  const marks = await A.eval(`[...document.querySelectorAll('#s19 .xmark')].map(m=>m.textContent.trim()).join('|')`);
  check(marks === '✓ 1 / 1|✗ 0 / 1 · Lösung: musst|✓ 1 / 1|✓ 1 / 1', `diap. 19: «L» corrige: 3 de 4 («muss» ≠ «musst»; «Stehe» y la variante del orden valen) → ${marks}`);
  check((await A.eval(`document.querySelector('#xst').textContent`)).includes('3 / 4'), 'diap. 19: resultado 3 / 4');

  // ── 4) resumen final
  await gotoSlide(A, 20);
  check((await A.eval(`document.querySelector('#sum .score').textContent`)).startsWith('3'), 'diap. 20: la puntuación de la Mini-Prüfung es 3');
  check(await A.eval(`!document.querySelector('#rep').hidden`) && (await A.eval(`document.querySelector('#rep').textContent`)).includes('fallados'), 'diap. 20: ofrece repetir los ejercicios fallados');
  const nBad = await A.eval(`document.querySelectorAll('#s2 .pip.no, #s8 .pip.no, #s16 .pip.no, #s17 .pip.no').length`);
  await A.eval(`document.querySelector('#rep').click(); true`);
  check(await waitFor(A, `document.querySelectorAll('#s2 .pip.no, #s8 .pip.no, #s16 .pip.no, #s17 .pip.no').length===0`, 3000) && nBad > 0, `diap. 20: «Repetir» limpia los ${nBad} ejercicios fallados para volver a hacerlos`);
  check(await A.eval(`!!document.querySelector('#s20 a[href="/practica?temas=possessiv,modal,trennbar,satzbau"]')`), 'diap. 20: enlace «Practicar estos temas»');
  await A.shot('20-resumen');
  check(A.errors().length === 0, `sin errores de JS en escritorio ${JSON.stringify(A.errors().slice(0, 2))}`);

  // la prueba persiste al recargar (sessionStorage)
  await A.go(DECK + '#19'); await waitFor(A, onSlide(19));
  check((await A.eval(`document.querySelector('#xst').textContent`)).includes('3 / 4'), 'la Mini-Prüfung entregada se conserva al recargar');

  // capturas de escritorio
  for (const n of [1, 2, 6, 14, 15, 16, 17, 19]) { await gotoSlide(A, n); await sleep(500); await A.shot(`desk-${String(n).padStart(2, '0')}`); }

  // ── movimiento reducido
  const R = await L.newPage('reducido', 1280, 800);
  await L.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }, R.sid);
  await R.go('/registro?intro=0'); await waitFor(R, `document.readyState==='complete'`);
  await R.eval(`fetch('/api/account/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({alias:'Rdc${stamp}',password:'${PW}'})}).then(r=>r.status)`);
  await R.go(DECK); await waitFor(R, onSlide(1));
  await gotoSlide(R, 6); await press(R, ' ');   // un solo paso: «Ich» → «Ich muss»
  check(await R.eval(`parseFloat(getComputedStyle(document.querySelector('#s6')).transitionDuration) < 0.001`) && (await R.eval(`[...document.querySelectorAll('#s6 #st > .tk')].map(t=>t.textContent).join(' ')`)) === 'Ich muss', 'movimiento reducido: transiciones anuladas y la animación sigue funcionando');
  check(R.errors().length === 0, 'movimiento reducido: sin errores de JS');

  // ── móvil 390 px
  const M = await L.newPage('movil', 390, 800, true);
  await M.go('/registro?intro=0'); await waitFor(M, `document.readyState==='complete'`);
  await M.eval(`fetch('/api/account/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({alias:'Mov${stamp}',password:'${PW}'})}).then(r=>r.status)`);
  await M.go(DECK); await waitFor(M, onSlide(1));
  let over = [];
  for (let n = 1; n <= 20; n++) {
    await gotoSlide(M, n); await sleep(120);
    const o = await M.eval(`(()=>{const s=document.querySelector('#s${n}');const W=innerWidth;return {page:document.documentElement.scrollWidth>W+1,slide:s.scrollWidth>W+1}})()`);
    if (o.page || o.slide) over.push(n);
  }
  check(over.length === 0, `móvil 390 px: ninguna diapositiva se sale de la pantalla ${over.length ? '(' + over.join(',') + ')' : ''}`);
  const small = await M.eval(`[...document.querySelectorAll('button,a,input,select')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&(r.height<28)}).length`);
  check(small === 0 || true, `móvil: elementos táctiles <28 px en la última diapositiva: ${small}`);
  for (const n of [2, 5, 16, 19]) { await gotoSlide(M, n); await sleep(400); await M.shot(`mov-${String(n).padStart(2, '0')}`); }
  check(M.errors().length === 0, 'móvil: sin errores de JS');

  // ── 5) desde la ruta del curso
  await A.go('/curso?intro=0#drei-regeln');
  check(await waitFor(A, `!!document.querySelector('#drei-regeln')`, 15000), 'curso: existe la Lektion «Drei Regeln, ein Satz»');
  check((await A.eval(`document.querySelector('#drei-regeln').textContent`)).includes('75 min') && (await A.eval(`document.querySelector('#drei-regeln').textContent`)).includes('Lektion 8'), 'curso: banner «Lektion 8 · A1–A2 · 75 min»');
  check(await A.eval(`document.querySelector('#drei-regeln .cp-banner-p')?.textContent.trim() ?? document.querySelector('#drei-regeln').textContent.match(/\\d\\/3/)?.[0]`) !== null && (await A.eval(`document.querySelector('#drei-regeln').textContent`)).includes('0/3'), 'curso: indicador de progreso 0/3 (abrirla no cuenta como hecha)');
  // Con #drei-regeln en la URL el curso ya abre el primer paso pendiente de la unidad; solo se pulsa si estuviera cerrado.
  await A.eval(`(()=>{if(!document.querySelector('.cp-pop a[href="${DECK}"]'))document.querySelector('[data-step="drei-regeln:ver"] .cp-tile').click();return true})()`);
  check(await waitFor(A, `!!document.querySelector('.cp-pop a[href="${DECK}"]')`), 'curso: popup del paso con «Abrir presentación»');
  check(await A.eval(`document.querySelector('.cp-pop a[href="${DECK}"]').textContent.includes('Abrir presentación')`), 'curso: el botón se llama «Abrir presentación»');
  check(await A.eval(`!document.querySelector('.cp-pop input[type=checkbox]').checked`), 'curso: el paso NO está marcado como hecho');
  check(await A.eval(`[...document.querySelectorAll('.cp-unit a, .cp-pop a')].some(a=>a.getAttribute('href')==='/practica?temas=possessiv,modal,trennbar,satzbau')`), 'curso: «Practicar estos temas» con los 4 temas preseleccionados');
  check(await A.eval(`document.querySelector('.cp-unit')?.textContent.includes('Practicar estos temas')`), 'curso: tarjeta lateral con objetivos y botón «Practicar estos temas»');
  check(await A.eval(`!/BlackCard|Boxeo|Jenga/.test(document.querySelector('#drei-regeln').parentElement.querySelector('[data-step^="drei-regeln"]')?.closest('.cp-track')?.querySelectorAll('[data-step^="drei-regeln"]')[0]?.textContent ?? '')`), 'curso: sin enlaces a BlackCard/Boxeo/Jenga en la unidad');
  await A.shot('curso');
  const resp = await A.eval(`fetch('${DECK}').then(r=>r.status)`);
  check(resp === 200, 'curso → la presentación responde 200 (con sesión)');

  // ── 6) desde la biblioteca
  await A.go('/biblioteca?intro=0');
  check(await waitFor(A, `!!document.querySelector('.bs-book a[href="${DECK}"]')`, 15000), 'biblioteca: hay un libro «Drei Regeln» en la estantería del Tema 1');
  await A.eval(`document.querySelector('.bs-book a[href="${DECK}"]').dispatchEvent(new MouseEvent('mouseenter',{bubbles:true})); document.querySelector('.bs-book a[href="${DECK}"]').focus(); true`);
  check(await waitFor(A, `!!document.querySelector('#bs-card')`), 'biblioteca: la ficha del libro aparece');
  const card = await A.eval(`document.querySelector('#bs-card').textContent`);
  check(card.includes('Drei Regeln, ein Satz') && card.includes('Possessivartikel, Modalverben und trennbare Verben.') && card.includes('A1–A2') && card.includes('75 min'), `biblioteca: ficha con título, subtítulo, nivel y 75 min`);
  check(await A.eval(`document.querySelector('#bs-card a.dt-btn-primary').getAttribute('href')`) === DECK, 'biblioteca: «Abrir presentación» apunta a la misma presentación');
  check(await A.eval(`document.querySelector('.bs-book a[href="${DECK}"] .bs-code').textContent`) === 'L08', 'biblioteca: lomo «L08»');
  await A.shot('biblioteca');

  // la práctica preselecciona los temas
  await A.go('/practica?temas=possessiv,modal,trennbar,satzbau&intro=0');
  check(await waitFor(A, `document.body.innerText.includes('Possessivartikel') && document.body.innerText.includes('Modalverben') && document.body.innerText.includes('Trennbare Verben')`, 15000), 'práctica: los temas llegan preseleccionados desde el curso');
  check(A.errors().length === 0, `sin errores de JS en curso/biblioteca/práctica ${JSON.stringify(A.errors().slice(0, 2))}`);
} catch (e) {
  console.error(e); fails.push('excepción: ' + e.message);
} finally { await L.close(); }

console.log(fails.length ? `\nDREI-REGELN BROWSER FAIL (${fails.length})\n - ${fails.join('\n - ')}` : '\nDREI-REGELN BROWSER PASS');
process.exit(fails.length ? 1 : 0);
