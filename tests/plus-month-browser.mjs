// Prueba de navegador: Plus mes a mes, con clics reales.
//  1) alumno Free entra en /mi → aparece el aviso diario (misión/racha); «Cerrar» lo oculta hasta mañana
//  2) /plus → cómo pedirlo por WhatsApp con su alias → «Probar Plus 3 días gratis» → Redet se abre
//  3) el botón de prueba ya no aparece (una vez por cuenta)
//  4) profesor → Teacher OS: tarjeta «Plus · suscripciones» (1 en prueba) → ficha → «Pago recibido · +1 mes»
//     → la ficha dice «Plus hasta el …», historial con 12,50 €; Übersicht: ingreso del mes 12,50 €
// Uso: node tests/plus-month-browser.mjs  (servidor propio con contraseña de profesor aleatoria)
import { mkdirSync } from 'node:fs';
import './helpers/plus-browser.mjs';
import { launch, sleep } from '../scripts/cdp.mjs';
const OUT = 'shots/plus-month'; mkdirSync(OUT, { recursive: true });
const L = await launch({ shots: OUT });
const fails = [];
const waitFor = async (P, js, ms = 12000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await P.eval(js)) return true; await sleep(150); } return false; };
const has = (sel) => `!!document.querySelector(${JSON.stringify(sel)})`;
const text = (s) => `document.body.innerText.includes(${JSON.stringify(s)})`;
const check = (ok, msg) => { console.log(`${ok ? 'OK ' : 'FAIL'} ${msg}`); if (!ok) fails.push(msg); };
const clickText = (P, sel, t) => P.eval(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find(x => x.textContent.includes(${JSON.stringify(t)})); if (!b) return false; b.click(); return true; })()`);
const snap = async (P, name, sel) => {
  await waitFor(P, `!document.documentElement.classList.contains('dt-booting') && !document.querySelector('[data-preloader]')`, 15000);
  if (sel) await P.eval(`document.querySelector(${JSON.stringify(sel)})?.scrollIntoView({ block: 'center' }); true`);
  await sleep(1200); await P.shot(name);
};
const alias = 'Mo' + Date.now().toString(36).slice(-6);
try {
  const S = await L.newPage('st', 1440, 900);
  await S.go('/?intro=0'); await sleep(400);
  const st = await S.eval(`fetch('/api/account/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({alias:'${alias}',password:'zorro-azul-mesa-72-lluvia'})}).then(r=>r.status)`);
  check(st === 200, `alta de alumno (${st})`);
  await S.eval(`localStorage.setItem('dt:student-session','cookie'); localStorage.setItem('dt:student-alias','${alias}'); true`);

  // 1) aviso diario
  await S.go('/mi?intro=0');
  check(await waitFor(S, has('[data-daily-nudge]')), 'aviso diario al entrar');
  check(await S.eval(`/misión de hoy/i.test(document.querySelector('[data-daily-nudge]').innerText)`), 'el aviso propone la misión de hoy');
  await snap(S, 'nudge');
  await S.eval(`document.querySelector('.dn-x').click(); true`);
  check(await waitFor(S, `!document.querySelector('[data-daily-nudge]')`, 3000), '«Cerrar» oculta el aviso');
  await S.go('/curso?intro=0'); await sleep(1500);
  check(await S.eval(`!document.querySelector('[data-daily-nudge]')`), 'cerrado sigue oculto el resto del día');

  // 2) /plus: cómo pedirlo + prueba
  await S.go('/plus?intro=0');
  check(await waitFor(S, has('[data-plus-how]')), '/plus: cómo pedir Plus');
  check(await S.eval(`!/bizum/i.test(document.body.innerText)`), '/plus: sin Bizum (el profesor no lo tiene)');
  check(await S.eval(`document.querySelector('[data-plus-how]').innerText.includes('«${alias}»') && document.querySelector('[data-plus-how]').innerText.includes('12,50')`), 'cómo pedirlo: con su alias y 12,50 €/mes');
  check(await waitFor(S, has('[data-plus-trial] button')), '/plus: botón «Probar Plus 3 días gratis»');
  await snap(S, 'plus-trial', '[data-plus-trial]');
  await S.eval(`document.querySelector('[data-plus-trial] button').click(); true`);
  check(await waitFor(S, has('[data-plus-active]'), 15000), 'tras activar la prueba: «Tu cuenta ya tiene la prueba de Plus»');
  check(await S.eval(`/la prueba de Plus/.test(document.querySelector('[data-plus-active]').innerText) && /hasta el/.test(document.querySelector('[data-plus-active]').innerText)`), 'muestra hasta qué día dura la prueba');
  check(await S.eval(`!document.querySelector('[data-plus-trial]')`), 'el botón de prueba ya no aparece');
  await S.go('/hablar?intro=0');
  check(await waitFor(S, `!!document.querySelector('.rd-scene, [data-redet]') && !document.querySelector('[data-klaus-plus="required"]')`, 15000), 'con la prueba, Redet se abre');

  // 3) profesor
  const T = await L.newPage('te', 1440, 900);
  await T.go('/teacher?intro=0');
  check(await waitFor(T, has('input[type=password], input.field')), 'Teacher OS: pide la clave');
  await T.eval(`(() => { const i = document.querySelector('input[type=password]') ?? document.querySelector('input.field'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, ${JSON.stringify(process.env.TEACHER_PASSWORD)}); i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  await clickText(T, 'button', 'Entrar en Teacher OS');
  check(await waitFor(T, has('[data-plus-summary]'), 15000), 'Übersicht: tarjeta «Plus · suscripciones»');
  check(await T.eval(`/1 en prueba/.test(document.querySelector('[data-plus-summary]').innerText)`), 'la tarjeta cuenta 1 en prueba');
  check(await T.eval(`!!document.querySelector('[data-plus-expiring]') && document.querySelector('[data-plus-expiring]').innerText.includes('${alias}')`), '«Caducan pronto» lista la prueba');
  await snap(T, 'overview-plus', '[data-plus-summary]');
  await T.go('/teacher/schueler?intro=0');
  check(await waitFor(T, `[...document.querySelectorAll('.tos-table tr')].some(tr => tr.textContent.includes('${alias}'))`), 'lista de alumnos con la cuenta');
  await T.eval(`[...document.querySelectorAll('.tos-table tr')].find(tr => tr.textContent.includes('${alias}')).click(); true`);
  check(await waitFor(T, has('[data-plan-pay]'), 15000), 'ficha: botón «Pago recibido · +1 mes»');
  check(await T.eval(`/Prueba gratis hasta el/.test(document.querySelector('[data-plan-until]').innerText)`), 'ficha: «Prueba gratis hasta el …»');
  await T.eval(`window.confirm = () => true; document.querySelector('[data-plan-pay]').click(); true`);
  check(await waitFor(T, `/^Plus hasta el/.test(document.querySelector('[data-plan-until]')?.innerText ?? '')`, 10000), 'tras el pago: «Plus hasta el …»');
  check(await waitFor(T, `!!document.querySelector('[data-plan-payments]') && document.querySelector('[data-plan-payments]').innerText.includes('12,50')`), 'historial: pago de 12,50 €');
  await snap(T, 'student-plan', '[data-plan-pay]');
  await T.go('/teacher?intro=0');
  check(await waitFor(T, `!!document.querySelector('[data-plus-summary]') && /1 de pago/.test(document.querySelector('[data-plus-summary]').innerText) && document.querySelector('[data-plus-summary]').innerText.includes('12,50')`, 15000), 'Übersicht: 1 de pago e ingreso 12,50 €');

  // móvil: aviso diario no se sale de la pantalla
  const M = await L.newPage('mob', 390, 844, true);
  await M.go('/?intro=0'); await sleep(300);
  const st2 = await M.eval(`fetch('/api/account/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({alias:'${alias}m',password:'zorro-azul-mesa-72-lluvia'})}).then(r=>r.status)`);
  await M.eval(`localStorage.setItem('dt:student-session','cookie'); localStorage.setItem('dt:student-alias','${alias}m'); true`);
  await M.go('/mi?intro=0');
  check(st2 === 200 && await waitFor(M, has('[data-daily-nudge]')), 'móvil: aviso diario');
  check(await M.eval(`(() => { const r = document.querySelector('[data-daily-nudge]').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; })()`), 'móvil: el aviso cabe en pantalla');
  await snap(M, 'nudge-mobile');
} catch (e) { check(false, `excepción: ${e.message}`); }
finally { await L.close(); }
console.log(fails.length ? `plus-month FAIL (${fails.length})` : 'plus-month OK');
process.exit(fails.length ? 1 : 0);
