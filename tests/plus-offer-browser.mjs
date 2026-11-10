// Prueba de navegador: plan Free y la pestaña «Solicita tu suscripción Plus».
//  1) Free en /hablar, /escribir, /unterricht → tarjeta Plus con el número +34 611 778 791 (enlace a WhatsApp)
//  2) /curso: Lektion 1 sin etapa de Repaso; contador «Lektionen nuevas hoy»; tras 2 Lektionen la 3.ª abre la pestaña Plus
//  3) /practica: 2 prácticas; la 3.ª abre la pestaña Plus
//  4) /plus: tabla Free/Plus y el número
import { mkdirSync } from 'node:fs';
import { launch, sleep } from '../scripts/cdp.mjs';
const OUT = 'shots/plus-offer'; mkdirSync(OUT, { recursive: true });
const L = await launch({ shots: OUT });
const fails = [];
const waitFor = async (P, js, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await P.eval(js)) return true; await sleep(150); } return false; };
const has = (sel) => `!!document.querySelector(${JSON.stringify(sel)})`;
const check = (ok, msg) => { console.log(`${ok ? 'OK ' : 'FAIL'} ${msg}`); if (!ok) fails.push(msg); };
const ready = (P) => waitFor(P, `!document.documentElement.classList.contains('dt-intro-active') && !document.querySelector('.dt-preloader:not(.is-gone)')`, 6000);
const snap = async (P, name, sel) => { await ready(P); if (sel) await P.eval(`document.querySelector(${JSON.stringify(sel)})?.scrollIntoView({ block: 'center' }); true`); await sleep(500); await P.shot(name); };
try {
  const P = await L.newPage('po', 1440, 900);
  // Sin cuenta: la diapositiva lleva a registro
  await P.go('/presentaciones/bank.html'); await sleep(500);
  check(await P.eval(`location.pathname`) === '/registro', 'sin cuenta: diapositiva → crear cuenta');
  const alias = 'Po' + Date.now().toString(36).slice(-6);
  const st = await P.eval(`fetch('/api/account/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({alias:'${alias}',password:'zorro-azul-mesa-72-lluvia'})}).then(r=>r.status)`);
  check(st === 200, `alta (${st})`);
  await P.eval(`localStorage.setItem('dt:student-session','cookie'); localStorage.setItem('dt:student-alias','${alias}'); true`);

  // 1) Klaus: pestaña Plus con el número
  for (const [path, kind] of [['/hablar', 'hablar'], ['/escribir', 'escribir'], ['/unterricht', 'clase']]) {
    await P.go(`${path}?intro=0`);
    const ok = await waitFor(P, has(`[data-plus-offer="${kind}"] [data-plus-phone]`));
    check(ok, `${path}: pestaña «Solicita tu suscripción Plus»`);
    if (ok) {
      check(await P.eval(`/\\+34 611 778 791/.test(document.querySelector('[data-plus-phone]').innerText)`), `${path}: número visible`);
      check(await P.eval(`document.querySelector('[data-plus-phone]').href.startsWith('https://wa.me/34611778791?text=')`), `${path}: enlace a WhatsApp con el número`);
      check(await P.eval(`decodeURIComponent(document.querySelector('[data-plus-phone]').href).includes('${alias}')`), `${path}: el mensaje lleva el alias`);
    }
    if (kind === 'hablar') await snap(P, 'klaus-hablar', '[data-plus-offer]');
  }

  // 2) Curso
  await P.go('/curso?intro=0');
  check(await waitFor(P, has('[data-step="bruecke-a1:ver"]')), 'curso cargado');
  check(!(await P.eval(has('[data-step="bruecke-a1:repaso"]'))), 'Lektion 1 sin etapa de Repaso (la de antes de la Lektion 2)');
  check(await P.eval(has('[data-step="bank:repaso"]')), 'Lektion 2 conserva su Repaso');
  check(await waitFor(P, `document.querySelector('[data-free-lektionen]')?.dataset.freeLektionen === '2'`), 'contador: 2 Lektionen nuevas hoy');
  // Abrir 2 Lektionen (pidiendo la diapositiva como lo haría la pestaña nueva)
  for (const id of ['mission-01', 'bank']) check(await P.eval(`fetch('/presentaciones/${id}.html',{redirect:'manual'}).then(r=>r.status)`) === 200, `abre ${id}`);
  await P.eval(`dispatchEvent(new Event('focus')); true`);
  check(await waitFor(P, `document.querySelector('[data-free-lektionen]')?.dataset.freeLektionen === '0'`), 'contador baja a 0');
  // Paso «Ver» de la Lektion 4 → pestaña Plus (sin abrir pestaña nueva)
  await P.eval(`document.querySelector('[data-step="krankenhaus:ver"] .cp-tile').click(); true`);
  check(await waitFor(P, `document.querySelector('[data-slides-state]')?.dataset.slidesState === 'blocked'`), 'Lektion 4: botón marcado sin cupo');
  await P.eval(`document.querySelector('[data-slides-state]').click(); true`);
  check(await waitFor(P, has('.po-modal [data-plus-offer="diapos"] [data-plus-phone]')), 'Lektion 4: pestaña Plus con el número');
  await snap(P, 'curso-diapos');
  await P.eval(`[...document.querySelectorAll('.po-modal button')].find(b=>/Ahora no/.test(b.textContent)).click(); true`);
  check(await waitFor(P, `!document.querySelector('.po-modal')`), '«Ahora no» cierra la pestaña');
  // Releer la Lektion 2 sigue permitido
  await P.eval(`document.querySelector('[data-step="bank:ver"] .cp-tile').click(); true`);
  check(await waitFor(P, `document.querySelector('[data-step="bank:ver"] ~ .cp-pop [data-slides-state], .cp-pop [data-slides-state]')?.dataset.slidesState === 'open'`), 'Lektion 2 ya abierta: se puede releer');

  // 3) Práctica
  for (let i = 1; i <= 2; i++) {
    await P.go('/practica?temas=vorstellen&intro=0');
    check(await waitFor(P, `!!document.querySelector('.pr-start') && !document.querySelector('.pr-start').disabled`), `práctica ${i}: botón activo`);
    await P.eval(`document.querySelector('.pr-start').click(); true`);
    check(await waitFor(P, `!document.querySelector('[data-practice-form]')`), `práctica ${i}: empieza`);
    await P.eval(`localStorage.removeItem('bc:practice'); true`);
  }
  await P.go('/practica?temas=vorstellen&intro=0');
  check(await waitFor(P, `document.querySelector('[data-practice-left]')?.dataset.practiceLeft === '0'`), 'práctica: «hoy ya no te quedan prácticas»');
  await P.eval(`document.querySelector('.pr-start').click(); true`);
  check(await waitFor(P, has('.po-modal [data-plus-offer="practica"] [data-plus-phone]')), 'práctica 3: pestaña Plus con el número');
  await snap(P, 'practica');

  // 4) /plus
  await P.go('/plus?intro=0');
  check(await waitFor(P, has('.po-table') && has('[data-plus-phone]')), '/plus: tabla y número');
  await snap(P, 'plus-page');
  check(await P.eval(`document.documentElement.scrollWidth <= innerWidth + 1`), 'sin desbordes horizontales');
  // móvil
  const M = await L.newPage('pm', 390, 844);
  await M.go('/plus?intro=0'); await waitFor(M, has('[data-plus-phone]'));
  check(await M.eval(`document.documentElement.scrollWidth <= innerWidth + 1`), 'móvil: /plus sin desbordes');
  await snap(M, 'plus-mobile', '[data-plus-offer]');
} catch (e) { check(false, String(e?.message ?? e)); }
finally { await L.close(); }
if (fails.length) { console.log(`${fails.length} fallos`); process.exit(1); }
console.log('plus-offer OK');
