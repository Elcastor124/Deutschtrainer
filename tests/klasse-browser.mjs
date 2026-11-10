// Prueba de navegador de Unterricht mit Klaus (/unterricht): alta → lección completa → resumen.
// Uso: node tests/klasse-browser.mjs [--base http://localhost:5173]  (sin --base arranca su propio servidor)
import { mkdirSync } from 'node:fs';
import { launch, sleep } from '../scripts/cdp.mjs';
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const OUT = 'shots/klasse'; mkdirSync(OUT, { recursive: true });
const L = await launch({ shots: OUT, ...(arg('--base') ? { base: arg('--base') } : {}) });
const fails = [];
const waitFor = async (P, sel, ms = 12000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await P.eval(`!!document.querySelector(${JSON.stringify(sel)})`)) return true; await sleep(200); } return false; };
const check = (ok, msg) => { console.log(`${ok ? 'OK ' : 'FAIL'} ${msg}`); if (!ok) fails.push(msg); };
// Respuestas de la lección akk-01 (sabidas por el test, nunca por el cliente).
const RIGHT = { 'akk-e1': { choice: 'einen' }, 'akk-e2': { text: 'einen' }, 'akk-e3': { choice: 'die' }, 'akk-e4': { text: 'den' },
  'akk-e5': { order: ['Ich', 'kaufe', 'ein', 'Buch'] }, 'akk-e6': { pairs: { 'der Hund': 'den Hund', 'die Katze': 'die Katze', 'das Auto': 'das Auto', 'der Apfel': 'den Apfel' } },
  'akk-e7': { choice: 'den' }, 'akk-r1': { choice: 'einen' }, 'akk-r2': { text: 'einen' } };
try {
  const P = await L.newPage('kx', 1440, 900);
  await L.send('Page.bringToFront', {}, P.sid);
  await L.send('Emulation.setFocusEmulationEnabled', { enabled: true }, P.sid);
  await P.go('/?intro=0'); await sleep(600);
  const st = await P.eval(`fetch('/api/account/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({alias:'Kx'+Date.now().toString(36).slice(-6),password:'zorro-azul-mesa-72-lluvia'})}).then(r=>r.status)`);
  check(st === 200 || st === 201, `alta de alumno (${st})`);
  await P.eval(`localStorage.setItem('dt:student-session','cookie'); true`);

  // Entrada única desde Curso
  await P.go('/curso?intro=0');
  check(await waitFor(P, 'a.cp-klasse[href="/unterricht"]'), 'Curso enlaza a la clase con Klaus');
  await P.eval(`document.querySelector('a.cp-klasse').click(); true`); await waitFor(P, '.kx-lesson');
  check((await P.eval('location.pathname')) === '/unterricht', 'el enlace navega a /unterricht sin recargar');
  const n = await P.eval(`document.querySelectorAll('.kx-lesson').length`);
  check(n >= 1, `lista de lecciones (${n})`);
  await P.shot('lessons');

  // La lista ya no empieza por akk-01 (orden del curso A1 → A2): se elige esa lección por su id.
  await P.eval(`document.querySelector('.kx-lesson[data-lesson="akk-01"] .btn.primary').click(); true`); await waitFor(P, '.kx-room .kx-stage');
  check(await P.eval(`!!document.querySelector('.kx-room .kx-stage')`), 'empieza la clase');
  let shotTable = false, wrongDone = false, steps = 0;
  for (; steps < 30; steps++) {
    const s = await P.eval(`JSON.stringify({ fin: !!document.querySelector('.kx-summary'), kind: document.querySelector('.kx-kind span')?.textContent, title: document.querySelector('.kx-title')?.textContent, id: null, hasOpt: !!document.querySelector('.kx-opt'), hasGap: !!document.querySelector('.kx-gap'), hasWord: !!document.querySelector('.kx-bank'), hasMatch: !!document.querySelector('.kx-match'), table: !!document.querySelector('.kx-table') })`);
    const v = JSON.parse(s);
    if (v.fin) break;
    if (v.table && !shotTable) {
      await P.eval(`document.querySelectorAll('.kx-notes .btn')[1]?.click(); true`); await sleep(500);
      check(await P.eval(`document.querySelector('.kx-table td.is-focus')?.textContent === 'den'`), 'la tabla resalta «den» en el paso 2');
      await P.shot('table'); shotTable = true;
    }
    // id de la actividad: el servidor no lo expone en el DOM; se deduce por título «Ejercicio N» / «Refuerzo N»
    const m = /^(Ejercicio|Refuerzo) (\d)/.exec(v.title ?? ''); const id = m ? `akk-${m[1] === 'Ejercicio' ? 'e' : 'r'}${m[2]}` : null;
    const ans = id ? RIGHT[id] : null;
    if (ans && 'choice' in ans) {
      if (!wrongDone) { // primero un fallo, para ver la pista
        await P.eval(`[...document.querySelectorAll('.kx-opt')].find(b => b.textContent !== ${JSON.stringify(ans.choice)}).click(); true`); await sleep(900);
        check(await P.eval(`!!document.querySelector('.kx-fb.is-ko')`), 'un fallo muestra feedback y pista');
        await P.shot('wrong'); wrongDone = true;
      }
      await P.eval(`[...document.querySelectorAll('.kx-opt')].find(b => b.textContent === ${JSON.stringify(ans.choice)}).click(); true`); await sleep(900);
    } else if (ans && 'text' in ans) {
      await P.eval(`(() => { const i = document.querySelector('.kx-gap'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, ${JSON.stringify(ans.text)}); i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`); await sleep(150);
      await P.eval(`document.querySelector('.kx-fill button[type=submit]').click(); true`); await sleep(900);
    } else if (ans && 'order' in ans) {
      for (const w of ans.order) { await P.eval(`[...document.querySelectorAll('.kx-bank .kx-word')].find(b => b.textContent === ${JSON.stringify(w)}).click(); true`); await sleep(120); }
      await P.eval(`[...document.querySelectorAll('.kx-ex > .btn')].at(-1).click(); true`); await sleep(900);
    } else if (ans && 'pairs' in ans) {
      await P.eval(`(() => { const want = ${JSON.stringify(ans.pairs)}; for (const li of document.querySelectorAll('.kx-match li')) { const l = li.querySelector('span').textContent, sel = li.querySelector('select'); const o = [...sel.options].find(o => o.textContent === want[l] && !o.disabled); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(sel, o.value); sel.dispatchEvent(new Event('change', { bubbles: true })); } return true; })()`); await sleep(300);
      await P.eval(`[...document.querySelectorAll('.kx-ex > .btn')].at(-1).click(); true`); await sleep(900);
    } else if (v.hasOpt) { // listening u otra opción desconocida: primera opción (puede fallar; el motor revela tras 2 intentos)
      for (let k = 0; k < 2 && !(await P.eval(`!!document.querySelector('.kx-actions .btn.primary:not(:disabled)')`)); k++) { await P.eval(`document.querySelectorAll('.kx-opt')[${'${k}'}]?.click(); true`.replace('${k}', String(k))); await sleep(900); }
    }
    if (ans) check(await P.eval(`!!document.querySelector('.kx-fb.is-ok')`), `${id} correcto`);
    if (id === 'akk-e2') { // pregunta libre: banco preparado (sin IA configurada)
      await P.eval(`(() => { const i = document.querySelector('#kx-q'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, '¿Por qué einen y no ein?'); i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`); await sleep(150);
      await P.eval(`document.querySelector('.kx-ask-form button').click(); true`); await sleep(1500);
      const src = await P.eval(`document.querySelector('.kx-src')?.textContent ?? ''`);
      check(/preparada|IA/i.test(src), `pregunta libre respondida (${src})`);
      await P.shot('ask');
    }
    const can = await P.eval(`!!document.querySelector('.kx-actions .btn.primary:not(:disabled)')`);
    if (!can) { check(false, `no se puede avanzar en «${v.title}»`); break; }
    await P.eval(`document.querySelector('.kx-actions .btn.primary').click(); true`); await sleep(800);
  }
  check(await P.eval(`!!document.querySelector('.kx-summary .kx-score')`), `resumen al terminar (${steps} pasos)`);
  await P.shot('summary');
  // Móvil
  const M = await L.newPage('kxm', 390, 844, true);
  await L.send('Page.bringToFront', {}, M.sid);
  await M.go('/?intro=0'); await sleep(500);
  await M.eval(`fetch('/api/account/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({alias:'Km'+Date.now().toString(36).slice(-6),password:'zorro-azul-mesa-72-lluvia'})}).then(r=>r.status)`);
  await M.eval(`localStorage.setItem('dt:student-session','cookie'); true`);
  await M.go('/unterricht?intro=0'); await waitFor(M, '.kx-lesson .btn.primary');
  await M.eval(`document.querySelector('.kx-lesson .btn.primary')?.click(); true`); await waitFor(M, '.kx-room .kx-stage');
  const ov = await M.eval(`document.documentElement.scrollWidth`);
  check(ov <= 390, `móvil sin desborde (${ov})`);
  check(await M.eval(`document.querySelector('.dt-nav a[aria-current=page]')?.getAttribute('href') ?? document.querySelector('a[aria-current=page]')?.getAttribute('href')`) === '/curso', 'la navegación marca Curso en /unterricht');
  await M.shot('mobile');
  const errs = [...P.errors(), ...M.errors()];
  check(errs.length === 0, `sin errores de consola ${errs.length ? JSON.stringify(errs).slice(0, 300) : ''}`);
} finally { await L.close(); }
if (fails.length) { console.log(`\n${fails.length} fallos`); process.exit(1); }
console.log('\nUnterricht OK');
