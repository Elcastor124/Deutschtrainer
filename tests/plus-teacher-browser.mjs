// Prueba de navegador: Klaus es Plus y lo asigna el profesor desde Teacher OS (camino real, con clics).
// 1) alumno Free → /hablar enseña «Klaus es parte de Plus»  2) profesor entra en Teacher OS → ficha → «Activar Plus»
// 3) alumno → /hablar ya abre Redet  4) profesor → «Quitar Plus» → el alumno vuelve a ver la pantalla de Plus.
// Uso: node tests/plus-teacher-browser.mjs  (arranca su propio servidor con una contraseña de profesor aleatoria)
import { mkdirSync } from 'node:fs';
import './helpers/plus-browser.mjs';
import { launch, sleep } from '../scripts/cdp.mjs';
const OUT = 'shots/plus'; mkdirSync(OUT, { recursive: true });
const L = await launch({ shots: OUT });
const fails = [];
const waitFor = async (P, js, ms = 12000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await P.eval(js)) return true; await sleep(150); } return false; };
const has = (sel) => `!!document.querySelector(${JSON.stringify(sel)})`;
const check = (ok, msg) => { console.log(`${ok ? 'OK ' : 'FAIL'} ${msg}`); if (!ok) fails.push(msg); };
const snap = async (P, name, sel) => {
  await waitFor(P, `!document.documentElement.classList.contains('dt-booting') && !document.querySelector('[data-preloader]')`, 15000);
  if (sel) await P.eval(`document.querySelector(${JSON.stringify(sel)})?.scrollIntoView({ block: 'center' }); true`);
  await sleep(1200); await P.shot(name);
};
const alias = 'Pl' + Date.now().toString(36).slice(-6);
try {
  // Alumno (pestaña propia, su cookie)
  const S = await L.newPage('st', 1440, 900);
  await S.go('/?intro=0'); await sleep(500);
  const st = await S.eval(`fetch('/api/account/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({alias:'${alias}',password:'zorro-azul-mesa-72-lluvia'})}).then(r=>r.status)`);
  check(st === 200, `alta de alumno (${st})`);
  await S.eval(`localStorage.setItem('dt:student-session','cookie'); true`);
  await S.go('/hablar?intro=0');
  check(await waitFor(S, has('[data-klaus-plus="required"]')), 'Free: Redet enseña «Klaus es parte de Plus»');
  check(await S.eval(`!document.querySelector('.rd-scene') && document.body.innerText.includes('Klaus es parte de Plus')`), 'Free: sin situaciones, con el aviso');
  await snap(S, 'free-gate');

  // Profesor: Teacher OS → alumno → «Activar Plus»
  const T = await L.newPage('te', 1440, 900);
  await T.go('/teacher?intro=0');
  check(await waitFor(T, has('input[type=password], input[autocomplete="current-password"], input.field')), 'Teacher OS: pide la clave');
  await T.eval(`(() => { const i = document.querySelector('input[type=password]') ?? document.querySelector('input.field'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, ${JSON.stringify(process.env.TEACHER_PASSWORD)}); i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  await T.eval(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Entrar en Teacher OS')).click(); true`);
  check(await waitFor(T, `!document.body.innerText.includes('Entrar en Teacher OS')`), 'Teacher OS: entra el profesor');
  await T.go('/teacher/schueler?intro=0');
  check(await waitFor(T, `[...document.querySelectorAll('.tos-table tr')].some(tr => tr.textContent.includes('${alias}'))`), 'la lista de alumnos muestra la cuenta');
  check(await T.eval(`![...document.querySelectorAll('.tos-table tr')].find(tr => tr.textContent.includes('${alias}'))?.querySelector('[data-plan-pill]')`), 'en la lista aún sin la marca Plus');
  await T.eval(`[...document.querySelectorAll('.tos-table tr')].find(tr => tr.textContent.includes('${alias}')).click(); true`);
  // La tarjeta pasó a «Plan · Plus» (con «Pago recibido»): el botón ya no está dentro de la fila [data-plan]. Ver docs/test-contract-notes.md.
  check(await waitFor(T, `${has('[data-plan="free"]')} && ${has('[data-plan-toggle]')}`), 'ficha: tarjeta del plan en Free');
  await T.eval(`document.querySelector('[data-plan-toggle]').click(); true`);
  check(await waitFor(T, has('[data-plan="plus"]')), 'ficha: «Activar Plus» lo deja en Plus');
  await snap(T, 'teacher-plus', '[data-plan]');

  // Alumno: ahora sí entra
  await S.go('/hablar?intro=0');
  check(await waitFor(S, has('.rd-scene .btn.primary')), 'Plus: Redet abre las situaciones');
  check(await S.eval(`!document.querySelector('[data-klaus-plus]')`), 'Plus: sin pantalla de Plus');
  await S.go('/unterricht?intro=0'); check(await waitFor(S, has('.kx-lesson')), 'Plus: Unterricht lista las lecciones');
  await S.go('/escribir?intro=0'); check(await waitFor(S, has('.kw-edit textarea')), 'Plus: Schreibt abre el editor');

  // Profesor quita Plus (confirma el diálogo)
  await T.eval(`window.confirm = () => true; document.querySelector('[data-plan-toggle]').click(); true`);
  check(await waitFor(T, has('[data-plan="free"]')), 'ficha: «Quitar Plus» vuelve a Free');
  await S.go('/escribir?intro=0');
  check(await waitFor(S, has('[data-klaus-plus="required"]')), 'sin Plus otra vez: Schreibt enseña la pantalla de Plus');
  // La teoría sigue abierta para Free
  await S.go('/teoria/akkusativ?intro=0'); check(await waitFor(S, `document.body.innerText.includes('Akkusativ')`), 'Free: la teoría sigue abierta');
} catch (e) { check(false, String(e?.message ?? e)); }
finally { await L.close(); }
if (fails.length) { console.log(`${fails.length} fallos`); process.exit(1); }
console.log('plus-teacher OK');
