// Prueba de navegador (clics reales):
//  1) Progreso del curso POR CUENTA: Ana marca 2 pasos en /curso; Ben, en el MISMO navegador, ve 0 %; Ana vuelve y ve
//     sus 2 pasos (vienen del servidor). Antes todos veían el mismo porcentaje porque se guardaba por navegador.
//  2) Teacher OS → «Tablón»: ve la petición con su autor, «Marcar como solucionada» (el alumno lo ve «Hecha») y
//     «Quitar del tablón» (desaparece para el alumno).
// Uso: node tests/tablon-progress-browser.mjs
import { mkdirSync } from 'node:fs';
import { setPlan } from './helpers/plus-browser.mjs';
import { launch, sleep } from '../scripts/cdp.mjs';
const OUT = 'shots/tablon-progress'; mkdirSync(OUT, { recursive: true });
const L = await launch({ shots: OUT });
const fails = [];
const waitFor = async (P, js, ms = 12000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await P.eval(js)) return true; await sleep(150); } return false; };
const has = (sel) => `!!document.querySelector(${JSON.stringify(sel)})`;
const check = (ok, msg) => { console.log(`${ok ? 'OK ' : 'FAIL'} ${msg}`); if (!ok) fails.push(msg); };
const clickText = (P, sel, t) => P.eval(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find(x => x.textContent.includes(${JSON.stringify(t)})); if (!b) return false; b.click(); return true; })()`);
const snap = async (P, name, sel) => {
  await waitFor(P, `!document.documentElement.classList.contains('dt-booting') && !document.querySelector('[data-preloader]')`, 15000);
  if (sel) await P.eval(`document.querySelector(${JSON.stringify(sel)})?.scrollIntoView({ block: 'center' }); true`);
  await sleep(1000); await P.shot(name);
};
const PW = 'zorro-azul-mesa-72-lluvia';
const stamp = Date.now().toString(36).slice(-5);
const ana = 'Ana' + stamp, ben = 'Ben' + stamp;
const login = async (P, alias, kind) => {
  const st = await P.eval(`fetch('/api/account/${kind}',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({alias:'${alias}',password:'${PW}'})}).then(r=>r.status)`);
  await P.eval(`localStorage.setItem('dt:student-session','cookie'); localStorage.setItem('dt:student-alias','${alias}'); true`);
  return st;
};
const pct = (P) => P.eval(`(() => { const t = document.querySelector('.cp-progress .cp-mono')?.textContent ?? ''; return t; })()`);
try {
  const S = await L.newPage('st', 1440, 900);
  await S.go('/?intro=0'); await sleep(400);
  // Progreso viejo «del navegador» (lo que veían todos): no debe aparecer como de nadie.
  await S.eval(`localStorage.setItem('dt:course:v1', JSON.stringify({ v: 1, done: ['bruecke-a1:ver', 'bruecke-a1:practicar', 'bank:ver'] })); true`);
  check(await login(S, ana, 'register') === 200, 'alta de Ana');
  await S.go('/curso?intro=0');
  check(await waitFor(S, has('[data-step="bruecke-a1:ver"]')), 'curso cargado');
  check(await waitFor(S, `(document.querySelector('.cp-progress .cp-mono')?.textContent ?? '').startsWith('0/')`), `Ana empieza en 0 pasos aunque el navegador tenía 3 de antes (${await pct(S)})`);
  check(await waitFor(S, has('.cp-legacy')), 'aviso: hay pasos de antes en este navegador → «Eran míos / No eran míos»');
  await snap(S, 'legacy', '.cp-legacy');
  await clickText(S, '.cp-legacy button', 'No eran míos');
  check(await waitFor(S, `!document.querySelector('.cp-legacy')`, 3000), '«No eran míos» lo quita');
  for (const id of ['bruecke-a1:ver', 'bruecke-a1:practicar']) {
    await S.eval(`(() => { const n = document.querySelector('[data-step="${id}"]'); n.scrollIntoView({ block: 'center' }); const b = n.querySelector('button.cp-tile'); if (b.getAttribute('aria-expanded') !== 'true') b.click(); return true; })()`);
    await sleep(500);
    const ok = await S.eval(`(() => { const c = document.querySelector('.cp-pop input[type=checkbox]'); if (!c) return false; c.click(); return true; })()`);
    check(ok, `Ana marca ${id}`);
    await sleep(600);
  }
  check(await waitFor(S, `(document.querySelector('.cp-progress .cp-mono')?.textContent ?? '').startsWith('2/')`), `Ana: 2 pasos (${await pct(S)})`);
  await sleep(800);
  const server = await S.eval(`fetch('/api/course/progress',{credentials:'same-origin'}).then(r=>r.json()).then(j=>j.done.join(','))`);
  check(server === 'bruecke-a1:ver,bruecke-a1:practicar', `guardado en el servidor para Ana (${server})`);
  await snap(S, 'ana-2', '.cp-progress');

  // Ben, mismo navegador
  await S.eval(`fetch('/api/account/logout',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}).then(()=>true)`);
  check(await login(S, ben, 'register') === 200, 'alta de Ben en el mismo navegador');
  await S.go('/curso?intro=0');
  check(await waitFor(S, `(document.querySelector('.cp-progress .cp-mono')?.textContent ?? '').startsWith('0/')`), `Ben ve SU progreso: 0 pasos (${await pct(S)})`);
  await S.go('/?intro=0');
  check(await waitFor(S, `!!document.querySelector('.dt-resume [aria-label^="Curso completado al 0%"]')`), 'inicio de Ben: 0 %');
  // Ana vuelve: sus pasos vienen del servidor
  await S.eval(`fetch('/api/account/logout',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}).then(()=>true)`);
  await S.eval(`localStorage.clear(); true`);
  check(await login(S, ana, 'login') === 200, 'Ana vuelve a entrar (navegador limpio, como otro dispositivo)');
  await S.go('/curso?intro=0');
  check(await waitFor(S, `(document.querySelector('.cp-progress .cp-mono')?.textContent ?? '').startsWith('2/')`), `Ana recupera sus 2 pasos desde el servidor (${await pct(S)})`);

  // 2) Tablón: Ana hace una actividad mínima y abre una petición (vía API real, con su cookie)
  // Actividad (requisito del tablón): como en tablon-browser, guardar un borrador de Schreibt (Plus desde Teacher OS).
  await setPlan(L.base, (x) => x.alias === ana);
  await S.go('/escribir?intro=0');
  check(await waitFor(S, has('#kw-text'), 15000), 'Schreibt abierto');
  await S.eval(`(() => { const t = document.querySelector('#kw-text'); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(t, 'Am Wochenende habe ich Fußball gespielt.'); t.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  await S.eval(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Guardar borrador')).click(); true`);
  check(await waitFor(S, `document.querySelector('.kw-msg')?.textContent.includes('Borrador guardado')`), 'borrador guardado (actividad)');
  const t1 = await S.eval(`fetch('/api/tablon/ticket',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({category:'error',title:'El audio no suena ${stamp}',body:'En la lección 3 el audio del diálogo no se oye en el móvil.'})}).then(async r=>r.status+' '+(await r.text()).slice(0,80))`);
  const t2 = await S.eval(`fetch('/api/tablon/ticket',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({category:'contenido',title:'Más ejercicios de Dativ ${stamp}',body:'Me gustaría tener más ejercicios de Dativ con preposiciones.'})}).then(r=>r.status)`);
  check(t1.startsWith('200') && t2 === 200, `Ana abre 2 peticiones (${t1} / ${t2})`);

  const T = await L.newPage('te', 1440, 900);
  await T.go('/teacher?intro=0');
  check(await waitFor(T, has('input[type=password], input.field')), 'Teacher OS: pide la clave');
  await T.eval(`(() => { const i = document.querySelector('input[type=password]') ?? document.querySelector('input.field'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, ${JSON.stringify(process.env.TEACHER_PASSWORD)}); i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  await clickText(T, 'button', 'Entrar en Teacher OS');
  check(await waitFor(T, `[...document.querySelectorAll('.tos-nav a')].some(a => a.textContent.includes('Tablón'))`, 15000), 'menú de Teacher OS con «Tablón»');
  await clickText(T, '.tos-nav a', 'Tablón');
  check(await waitFor(T, has('[data-tos="tablon"] .tos-tb-item')), 'Teacher OS → Tablón: lista de peticiones');
  check(await T.eval(`document.querySelector('[data-tos="tablon"]').innerText.includes('${ana}')`), 'el profesor ve quién la abrió');
  await snap(T, 'teacher-tablon', '[data-tos="tablon"]');
  const card = (t) => `[...document.querySelectorAll('.tos-tb-item')].find(li => li.textContent.includes(${JSON.stringify(t)}))`;
  await T.eval(`(() => { const li = ${card('El audio no suena ' + stamp)}; [...li.querySelectorAll('button')].find(b => b.textContent.includes('Marcar como solucionada')).click(); return true; })()`);
  check(await waitFor(T, `!${card('El audio no suena ' + stamp)}`, 6000), '«Marcar como solucionada» la saca de Pendientes');
  await clickText(T, '[data-tos="tablon"] .tos-toolbar button', 'Hechas');
  check(await waitFor(T, `!!${card('El audio no suena ' + stamp)}`, 4000), 'aparece en «Hechas»');
  // Quitar la otra
  await clickText(T, '[data-tos="tablon"] .tos-toolbar button', 'Pendientes');
  await T.eval(`window.confirm = () => true; true`);
  await T.eval(`(() => { const li = ${card('Más ejercicios de Dativ ' + stamp)}; [...li.querySelectorAll('button')].find(b => b.textContent.includes('Quitar del tablón')).click(); return true; })()`);
  check(await waitFor(T, `!${card('Más ejercicios de Dativ ' + stamp)}`, 6000), '«Quitar del tablón» la quita de la lista');

  // Lo que ve el alumno
  await S.go('/tablon?intro=0');
  check(await waitFor(S, `document.body.innerText.includes('El audio no suena ${stamp}')`), 'el alumno sigue viendo la solucionada');
  check(await S.eval(`(() => { const li = [...document.querySelectorAll('.tb-ticket')].find(x => x.textContent.includes('El audio no suena ${stamp}')); return !!li && li.querySelector('.tb-status').textContent.includes('Hecha'); })()`), '…marcada «Hecha»');
  check(await S.eval(`!document.body.innerText.includes('Más ejercicios de Dativ ${stamp}')`), 'la quitada ya no está en el tablón del alumno');
  await snap(S, 'student-tablon');
} catch (e) { fails.push(String(e?.stack ?? e)); console.error(e); }
finally { await L.close(); }
console.log(fails.length ? `\n${fails.length} FALLOS` : '\nTablón + progreso por cuenta: todo OK');
process.exit(fails.length ? 1 : 0);
