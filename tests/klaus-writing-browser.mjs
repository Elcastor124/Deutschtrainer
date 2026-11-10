// Schreibt mit Klaus (/escribir) en navegador real: sin sesión, cuenta, borrador, revisión, panel lateral, aplicar corrección,
// reanudar tras recargar, cuota y consola sin errores. Ejecutar tras `npm run build`:
//   node --disable-warning=ExperimentalWarning tests/klaus-writing-browser.mjs
import assert from 'node:assert/strict';
import { plusAll } from './helpers/plus-browser.mjs';
import { launch, sleep } from '../scripts/cdp.mjs';

const L = await launch({ shots: 'shots/klaus-writing', ...(process.env.BASE ? { base: process.env.BASE } : {}) });
const check = (ok, label) => { assert.ok(ok, label); console.log(`  PASS ${label}`); };
try {
  const B = await L.newPage('schreibt', 1280, 900);
  await B.go('/escribir');
  await B.until(`!!document.querySelector('.kw-gate')`, 'pantalla de acceso sin sesión');
  check(await B.eval(`/Entra para que Klaus/.test(document.body.innerText)`), 'sin sesión: invita a entrar (no rompe)');
  check(await B.eval(`[...document.querySelectorAll('.dt-nav-links a')].some(a => a.getAttribute('href') === '/escribir' && a.getAttribute('aria-current') === 'page')`), 'el menú marca «Escribir» como página actual');

  const reg = await B.eval(`fetch('/api/account/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({alias:'Schreib'+(Date.now()%10000),password:'zorro-azul-mesa-72-lluvia',rankingOptIn:false})}).then(async r=>({s:r.status,e:(await r.json()).error||null}))`);
  check(reg.s === 200, `cuenta creada (HTTP ${reg.s}${reg.e ? ': ' + reg.e : ''})`);
  await B.eval(`localStorage.setItem('dt:student-session','cookie'); true`);
  // Sin Plus: pantalla de Plus, sin editor
  await B.go('/escribir'); await B.until(`!!document.querySelector('[data-klaus-plus="required"]')`, 'Free: Schreibt pide Plus');
  check(await B.eval(`!document.querySelector('.kw-edit textarea')`), 'Free: sin editor');
  await plusAll(L.base);
  await B.go('/escribir');
  await B.until(`!!document.querySelector('.kw-edit textarea') && /revisi/i.test(document.querySelector('.kw-plan')?.innerText||'')`, 'editor y estado de cuota');
  check(await B.eval(`/plus/i.test(document.querySelector('.kw-plan').innerText)`), 'plan Plus');
  check(await B.eval(`/sin ia/i.test(document.querySelector('.kw-plan').innerText)`), 'sin proveedor real: avisa «Modo básico sin IA» (no finge IA)');

  await B.type('.kw-edit textarea', 'Ich habe 15 Jahre. Ich wohne in Sevilla.');
  check(await B.eval(`document.querySelector('.kw-count').innerText.startsWith('8 palabra')`), 'contador de palabras');
  await B.click('.kw-foot .btn.primary');
  await B.until(`document.querySelectorAll('.kw-list li').length > 0`, 'aparece la corrección en el panel lateral');
  check(await B.eval(`document.querySelector('.kw-list li del').textContent === 'Ich habe 15 Jahre' && document.querySelector('.kw-list li ins').textContent === 'Ich bin 15 Jahre alt'`), 'corrección: fragmento y sugerencia');
  check(await B.eval(`document.querySelector('.kw-edit textarea').value === 'Ich habe 15 Jahre. Ich wohne in Sevilla.'`), 'el texto del alumno NO se modifica solo');
  check(await B.eval(`!!document.querySelector('.kw-marked mark[data-correction="c1"]')`), 'el fragmento queda señalado en el texto');
  check(await B.eval(`/Revisión básica con reglas fijas, no con IA/.test(document.querySelector('.kw-side').innerText)`), 'la revisión determinista se etiqueta como tal');
  check(await B.eval(`/sin límite/i.test(document.querySelector('.kw-plan').innerText)`), 'sin IA no se descuenta cuota (revisiones sin límite)'); // antes «la cuota baja a 2»: ver docs/test-contract-notes.md

  // Modo guiado: pista primero, solución después.
  await B.click('.kw-switch input');
  check(await B.eval(`!document.querySelector('.kw-list li ins')`), 'modo guiado: la solución no se ve hasta pedirla');
  await B.click('.kw-list li .btn:not(.primary)');
  check(await B.eval(`!!document.querySelector('.kw-list li ins')`), 'modo guiado: «Ver la solución» la muestra');
  await B.click('.kw-list li .btn.primary');
  await sleep(200);
  check(await B.eval(`document.querySelector('.kw-edit textarea').value === 'Ich bin 15 Jahre alt. Ich wohne in Sevilla.'`), '«Aplicar» cambia solo ese fragmento');
  check(await B.eval(`document.querySelector('.kw-list li').classList.contains('done')`), 'la corrección queda revisada');

  // Con cambios sin guardar la app avisa al salir (beforeunload); se guarda y entonces se recarga.
  check(await B.eval(`(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; })()`), 'cambios sin guardar: avisa al salir de la página');
  await B.click('.kw-foot .btn:not(.primary)');
  await B.until(`/Guardado/.test(document.querySelector('.kw-foot .btn:not(.primary)')?.innerText||'')`, 'borrador guardado tras aplicar');
  check(await B.eval(`(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return !e.defaultPrevented; })()`), 'guardado: ya no avisa al salir');

  // Persistencia: recarga y reabre el borrador con su revisión.
  await B.go('/escribir');
  await B.until(`document.querySelectorAll('.kw-draft-list li').length === 1`, 'el borrador sobrevive a la recarga');
  await B.click('.kw-draft-list button');
  await B.until(`document.querySelector('.kw-edit textarea').value.length > 0`, 'abre el borrador');
  check(await B.eval(`document.querySelectorAll('.kw-list li').length === 1`), 'reabre la revisión guardada');

  // Sin IA (modo básico) las revisiones no tienen límite y nunca se bloquea el botón (antes: 3/día y luego bloqueado; ver
  // docs/test-contract-notes.md). La cuota con IA real y su paso a modo práctica se prueban en tests/klaus-ai.test.ts.
  for (const n of [2, 3, 4, 5]) {
    await B.eval(`(() => { const t = document.querySelector('.kw-edit textarea'); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(t, 'Ich bin Ana ${n}.'); t.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
    await B.click('.kw-foot .btn.primary');
    await B.until(`!document.querySelector('.kw-foot .btn.primary').disabled && /Revisar/.test(document.querySelector('.kw-foot .btn.primary').innerText)`, `revisión ${n} hecha`);
  }
  check(await B.eval(`/sin límite/i.test(document.querySelector('.kw-plan').innerText)`), 'modo básico: revisiones sin límite');
  check(await B.eval(`!document.querySelector('.kw-foot .btn.primary').disabled`), 'tras 5 revisiones el botón sigue activo');

  check(await B.eval(`document.documentElement.scrollWidth <= innerWidth + 1`), 'sin desbordamiento horizontal (escritorio)');

  const M = await L.newPage('schreibt móvil', 390, 800);
  await M.go('/escribir');
  await M.until(`!!document.querySelector('.kw-gate, .kw-edit')`, 'carga en móvil');
  const regM = await M.eval(`fetch('/api/account/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({alias:'Movil'+(Date.now()%10000),password:'zorro-azul-mesa-72-lluvia',rankingOptIn:false})}).then(r=>r.status)`);
  check(regM === 200, 'cuenta propia en el contexto móvil (cada página tiene su cookie)');
  await M.eval(`localStorage.setItem('dt:student-session','cookie'); true`); await plusAll(L.base);
  await M.go('/escribir');
  await M.until(`!!document.querySelector('.kw-edit textarea')`, 'editor en móvil');
  check(await M.eval(`document.documentElement.scrollWidth <= innerWidth + 1`), 'sin desbordamiento horizontal (390 px)');
  check(await M.eval(`getComputedStyle(document.querySelector('.kw-grid')).gridTemplateColumns.split(' ').length === 1`), 'móvil: una columna');

  const errs = [...(B.errors?.() ?? []), ...(M.errors?.() ?? [])];
  check(errs.length === 0, `consola sin errores${errs.length ? ' → ' + errs.slice(0, 3) : ''}`);
  console.log('klaus-writing-browser OK');
} finally { await L.close(); }
