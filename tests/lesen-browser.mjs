// Prueba de navegador del Leseverstehen 001 (/examenes/lesen-001), con clics reales en Edge headless.
// Servidor propio con DATA_DIR temporal (scripts/cdp.mjs): la cuenta de prueba no toca datos reales.
//  1) Aparece en /examenes y abre la práctica.  2) La página no contiene la clave antes de terminar.
//  3) Responder los 5 Teile (texto visible al lado), selectores de Teil 3 sin repetir anuncio, volver atrás.
//  4) Recargar conserva respuestas.  5) Corregir: nota total y por Teil, revisión con explicación, «repasar».
//  6) Recargar tras corregir NO duplica el resultado (1 intento en /api/lesen/mine y 1 actividad en el progreso).
//  7) Móvil 390 px y Chromebook 1366×768 sin desbordes.  8) Modo clase: profesor crea, alumno entra, empieza, responde, termina.
// Uso: npm run build && node tests/lesen-browser.mjs
import { mkdirSync } from 'node:fs';
import './helpers/plus-browser.mjs'; // fija una TEACHER_PASSWORD temporal para el servidor de prueba
import { launch, sleep } from '../scripts/cdp.mjs';

const OUT = 'shots/lesen'; mkdirSync(OUT, { recursive: true });
const L = await launch({ shots: OUT });
const fails = [];
const check = (c, m) => { console.log(`${c ? '  ✔' : '  ✘'} ${m}`); if (!c) fails.push(m); };
const waitFor = async (P, expr, ms = 12000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await P.eval(expr).catch(() => false)) return true; await sleep(150); } return false; };
const ready = (P) => waitFor(P, `!document.documentElement.classList.contains('dt-booting') && !document.querySelector('[data-preloader]')`, 15000);
const stamp = Date.now().toString(36).slice(-5), PW = 'zorro-azul-mesa-72-lluvia';
// Respuestas: clave real (sabida por el test, NO por la página) con 3 fallos a propósito: q4, q9, q15.
const KEY = { q1: 'F', q2: 'R', q3: 'F', q4: 'F', q5: 'R', q6: 'b', q7: 'a', q8: 'c', q9: 'a', q10: 'b', q11: 'B', q12: 'C', q13: 'F', q14: 'G', q15: 'D', q16: '0', q17: 'a', q18: 'b', q19: 'c', q20: 'a', q21: 'b', q22: 'b', q23: 'a', q24: 'c', q25: 'b' };
const MINE = { ...KEY, q4: 'R', q9: 'b', q15: 'E' };
const clickOpt = (P, q, o) => P.eval(`(()=>{const b=document.querySelector('[data-lesen-q="${q}"] [data-lesen-opt="${o}"]'); if(!b) return false; b.click(); return true})()`);
const choose = (P, q, v) => P.eval(`(()=>{const s=document.querySelector('[data-lesen-select="${q}"]'); if(!s) return 'missing'; const o=[...s.options].find(x=>x.value==='${v}'); if(!o||o.disabled) return 'disabled'; const set=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set; set.call(s,'${v}'); s.dispatchEvent(new Event('change',{bubbles:true})); return 'ok'})()`);
const answerPart = async (P, i, answers) => {
  await P.eval(`document.querySelector('[data-lesen-tab="${i}"]').click(); true`);
  await waitFor(P, `document.querySelector('[data-lesen-part="${i + 1}"]')`);
  const qs = await P.eval(`[...document.querySelectorAll('[data-lesen-q]')].map(x=>x.dataset.lesenQ)`);
  for (const q of qs) { if (i === 2) await choose(P, q, answers[q]); else await clickOpt(P, q, answers[q]); await sleep(40); }
  return qs;
};
const overflow = (P) => P.eval(`document.documentElement.scrollWidth - innerWidth`);

try {
  const A = await L.newPage('ana', 1440, 900);
  await A.go('/registro?intro=0'); await waitFor(A, `document.readyState==='complete'`);
  const st = await A.eval(`fetch('/api/account/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({alias:'Le${stamp}',password:'${PW}'})}).then(r=>r.status)`);
  check(st === 200, 'cuenta de prueba creada (DATA_DIR temporal)');
  await A.eval(`localStorage.setItem('dt:student-session','cookie'); localStorage.setItem('dt:student-alias','Le${stamp}'); true`);

  // ── 1) /examenes
  await A.go('/examenes?intro=0'); await ready(A);
  check(await waitFor(A, `[...document.querySelectorAll('.ex-block h2')].some(h=>h.textContent.includes('Leseverstehen — Alltag und Kommunikation'))`), '/examenes muestra «Leseverstehen — Alltag und Kommunikation»');
  check(await A.eval(`[...document.querySelectorAll('.ex-block')].filter(b=>b.textContent.includes('Hörverstehen 001') || b.textContent.includes('Die erste Prüfung')).length`) === 2, 'los otros exámenes siguen ahí');
  await A.eval(`[...document.querySelectorAll('.ex-block')].find(b=>b.textContent.includes('Leseverstehen')).querySelector('a.dt-btn').click(); true`);
  check(await waitFor(A, `location.pathname==='/examenes/lesen-001' && !!document.querySelector('[data-lesen-part="1"]')`), 'el botón abre la práctica en Teil 1');
  await A.eval(`window.__err=[];addEventListener('error',e=>__err.push(e.message));true`);
  check((await A.eval(`document.title`)).startsWith('Leseverstehen · Alltag und Kommunikation'), 'título de la pestaña');

  // ── 2) sin clave en la página ni en el bundle
  const leak = await A.eval(`(async()=>{const html=document.documentElement.outerHTML; const js=await Promise.all([...document.scripts].filter(s=>s.src).map(s=>fetch(s.src).then(r=>r.text()))); const all=html+js.join(''); return ['Seit drei Wochen wohne ich bei meiner Tante in Köln.» Son tres semanas','Respuesta correcta: Falsch','LÖSUNGSSCHLÜSSEL','«Diese müssen spätestens einen Tag vorher reserviert werden.»','Wir verkaufen keine Fahrräder.» '].filter(s=>all.includes(s))})()`);
  check(Array.isArray(leak) && leak.length === 0, `ni la página ni los JS contienen la clave o las explicaciones (${JSON.stringify(leak)})`);
  check(await A.eval(`fetch('/api/lesen/exam').then(r=>r.text()).then(t=>!/"answers"|"explain"|"key"/.test(t))`), '/api/lesen/exam no trae soluciones');

  // ── 3) dos columnas, responder, volver atrás
  const lay = await A.eval(`(()=>{const t=document.querySelector('.lv-text').getBoundingClientRect(), q=document.querySelector('.lv-answer').getBoundingClientRect(); return {side: t.right <= q.left + 1, top: Math.abs(t.top - q.top) < 40}})()`);
  check(lay.side && lay.top, 'escritorio: texto a la izquierda, preguntas a la derecha');
  check(await A.eval(`document.querySelector('.lv-text').textContent.includes('Seit drei Wochen wohne ich bei meiner Tante in Köln.')`), 'Teil 1: texto completo visible');
  check(await A.eval(`/\\d+:\\d\\d/.test(document.querySelector('[data-lesen-clock]').textContent) && document.querySelector('[data-lesen-clock]').textContent.includes('8:00 recomendados')`), 'tiempo transcurrido y recomendado (8 min) a la vista');
  const q1 = await answerPart(A, 0, MINE);
  check(q1.length === 5, 'Teil 1: 5 preguntas Richtig/Falsch');
  check(await A.eval(`!document.querySelector('.hv-q.ok,.hv-q.ko,[data-lesen-review]')`), 'al responder no se revela si está bien o mal');
  await A.shot('01-teil1');
  const q2 = await answerPart(A, 1, MINE);
  check(q2.length === 5 && await A.eval(`document.querySelectorAll('.lv-table tbody tr').length`) === 5, 'Teil 2: tabla del Jugendzentrum + 5 preguntas');
  await A.shot('02-teil2');
  await A.eval(`document.querySelector('[data-lesen-tab="2"]').click(); true`); await waitFor(A, `document.querySelector('[data-lesen-part="3"]')`);
  check(await A.eval(`document.querySelectorAll('[data-lesen-ad]').length`) === 8, 'Teil 3: 8 anuncios A–H en tarjetas');
  check(await A.eval(`document.querySelectorAll('[data-lesen-select]').length`) === 6, 'Teil 3: 6 selectores (sin drag-and-drop)');
  check(await choose(A, 'q11', 'B') === 'ok', 'Teil 3: q11 = B');
  check(await choose(A, 'q12', 'B') === 'disabled', 'Teil 3: B ya no se puede usar en otra situación');
  await answerPart(A, 2, MINE);
  check(await A.eval(`[...document.querySelectorAll('[data-lesen-select]')].map(s=>s.value).join('')`) === 'BCFGE0', 'Teil 3: las 6 elegidas (con 0)');
  await A.shot('03-teil3');
  await answerPart(A, 3, MINE); check(await A.eval(`document.querySelector('.lv-meta').textContent.includes('Frau Becker')`), 'Teil 4: e-mail con Von/An/Betreff');
  await A.shot('04-teil4');
  // Dejo q25 sin responder para comprobar que cuenta 0.
  await A.eval(`document.querySelector('[data-lesen-tab="4"]').click(); true`); await sleep(300);
  for (const q of ['q22', 'q23', 'q24']) await clickOpt(A, q, MINE[q]);
  check(await A.eval(`document.querySelector('[data-lesen-answered]').dataset.lesenAnswered`) === '24', 'contador: 24/25 respondidas');
  // Volver a Teil 1 y cambiar una respuesta (luego la dejo como estaba).
  await A.eval(`document.querySelector('[data-lesen-tab="0"]').click(); true`); await sleep(300);
  await clickOpt(A, 'q1', 'R'); check(await A.eval(`document.querySelector('[data-lesen-q="q1"] [data-lesen-opt="R"]').getAttribute('aria-checked')`) === 'true', 'se puede volver a Teil 1 y cambiar una respuesta');
  await clickOpt(A, 'q1', 'F');

  // ── 4) recargar conserva
  await A.go('/examenes/lesen-001?modo=practica'); await waitFor(A, `document.querySelector('[data-lesen-answered]')`);
  check(await A.eval(`document.querySelector('[data-lesen-answered]').dataset.lesenAnswered`) === '24', 'recargar conserva las 24 respuestas');

  // ── 5) corregir
  await A.eval(`window.confirm=()=>true; document.querySelector('[data-lesen-finish]').click(); true`);
  check(await waitFor(A, `!!document.querySelector('[data-lesen-score]')`), 'Terminar y corregir → resultado');
  // 25 - 3 fallos - 1 sin responder = 21
  check(await A.eval(`document.querySelector('[data-lesen-score]').dataset.lesenScore`) === '21', 'nota: 21/25 (3 fallos + 1 en blanco)');
  check(await A.eval(`document.querySelector('.hv-score').textContent.includes('84 %')`), 'porcentaje 84 %');
  check(await A.eval(`[...document.querySelectorAll('.hv-score .hv-bars b')].map(b=>b.textContent).join(' ')`) === '4/5 4/5 5/6 5/5 3/4', 'puntos por Teil: 4/5 4/5 5/6 5/5 3/4');
  check(await A.eval(`document.querySelector('[data-lesen-saved]').dataset.lesenSaved`) === '1', 'guardado en la cuenta');
  check(await A.eval(`(()=>{const t=document.querySelector('.lv-repasar')?.textContent||''; return t.includes('Zeitangaben') || t.includes('Detailverstehen') || t.includes('Informationssuche')})()`), '«Conviene repasar» con categorías');
  check(await A.eval(`document.querySelector('[data-lesen-q="q1"]').classList.contains('ok') && document.querySelector('[data-lesen-q="q1"] blockquote').textContent.includes('Seit drei Wochen')`), 'revisión: q1 bien, con la frase que lo demuestra');
  await A.eval(`document.querySelector('[data-lesen-tab="0"]').click(); true`); await sleep(200);
  check(await A.eval(`document.querySelector('[data-lesen-q="q4"]').classList.contains('ko') && document.querySelector('[data-lesen-q="q4"] .hv-evidence').textContent.includes('Lösung: Falsch')`), 'revisión: q4 mal, muestra la solución');
  check(await A.eval(`!!document.querySelector('.lv-text')`), 'el texto original sigue visible en la revisión');
  await A.shot('05-resultado');
  await A.eval(`document.querySelector('[data-lesen-tab="4"]').click(); true`); await sleep(250);
  check(await A.eval(`document.querySelector('[data-lesen-q="q25"] .hv-evidence').textContent.includes('Sin respuesta')`), 'q25 en blanco → «Sin respuesta»');

  // ── 6) recargar tras corregir no duplica
  await A.go('/examenes/lesen-001?modo=practica'); await waitFor(A, `!!document.querySelector('[data-lesen-score]')`);
  check(await A.eval(`document.querySelector('[data-lesen-score]').dataset.lesenScore`) === '21', 'recargar: el resultado sigue (21)');
  // Reenviar el mismo intento a mano (como haría un refresco a medio envío) con otras respuestas: no cambia ni duplica.
  const again = await A.eval(`(async()=>{const s=JSON.parse(localStorage.getItem('dt:lesen:practice:v1')); const r=await fetch('/api/lesen/practice/check',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({attempt:s.attempt,answers:${JSON.stringify(KEY)},finish:true})}).then(r=>r.json()); return r.score.points})()`);
  check(again === 21, `reenviar el mismo intento devuelve lo guardado (${again}), no otra nota`);
  const mine = await A.eval(`fetch('/api/lesen/mine').then(r=>r.json()).then(d=>d.results.map(x=>x.points))`);
  check(JSON.stringify(mine) === '[21]', `un solo resultado guardado (${JSON.stringify(mine)})`);
  const acts = await A.eval(`fetch('/api/account/progress').then(r=>r.json()).then(d=>d.activities.filter(a=>a.game==='lesen').map(a=>a.correct+'/'+a.total))`);
  check(JSON.stringify(acts) === '["21/25"]', `progreso del alumno: UNA actividad «lesen» 21/25 (${JSON.stringify(acts)})`);
  await A.go('/mi?intro=0'); await ready(A);
  check(await waitFor(A, `document.body.innerText.includes('Leseverstehen')`, 8000), '«Mi espacio» lista el Leseverstehen en las últimas actividades');
  check((await A.eval(`window.__err||[]`)).length === 0, 'sin errores de JS');

  // ── 6b) Teacher OS: el profesor ve el resultado en la ficha del alumno
  const P = await L.newPage('tos', 1440, 900);
  await P.go('/teacher?intro=0'); await waitFor(P, `!!document.querySelector('input[type=password], input.field')`);
  await P.eval(`(() => { const i = document.querySelector('input[type=password]') ?? document.querySelector('input.field'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, ${JSON.stringify(process.env.TEACHER_PASSWORD)}); i.dispatchEvent(new Event('input', { bubbles: true })); return true })()`);
  await P.eval(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Entrar en Teacher OS')).click(); true`);
  await waitFor(P, `!document.body.innerText.includes('Entrar en Teacher OS')`);
  await P.go('/teacher/schueler?intro=0');
  await waitFor(P, `[...document.querySelectorAll('.tos-table tr')].some(tr => tr.textContent.includes('Le${stamp}'))`);
  await P.eval(`[...document.querySelectorAll('.tos-table tr')].find(tr => tr.textContent.includes('Le${stamp}')).click(); true`);
  check(await waitFor(P, `document.querySelector('main').innerText.includes('Actividades')`), 'Teacher OS: abre la ficha del alumno');
  await P.eval(`[...document.querySelectorAll('main button, main [role=tab], main a')].find(b => b.textContent.trim() === 'Aktivitäten')?.click(); true`);
  check(await waitFor(P, `[...document.querySelectorAll('.tos-list li')].some(li => li.textContent.includes('Leseverstehen') && li.textContent.includes('21/25'))`), 'Teacher OS · Aktivitäten: «Leseverstehen A2 · 21/25»');
  await P.shot('10-teacher-os');
  if (fails.at(-1)?.startsWith('Teacher OS')) console.log('DBG', await P.eval(`document.querySelector('main')?.innerText.replace(/\\s+/g,' ').slice(0,900)`));

  // ── 7) móvil y Chromebook
  const M = await L.newPage('movil', 390, 844, true);
  await M.go('/examenes/lesen-001?modo=practica&intro=0'); await waitFor(M, `!!document.querySelector('[data-lesen-part="1"]')`);
  check(await overflow(M) <= 1, `móvil 390: sin scroll horizontal (${await overflow(M)})`);
  check(await M.eval(`(()=>{const t=document.querySelector('.lv-text').getBoundingClientRect(), q=document.querySelector('.lv-answer').getBoundingClientRect(); return q.top >= t.bottom - 1})()`), 'móvil: texto arriba, preguntas debajo');
  await clickOpt(M, 'q1', 'F'); check(await M.eval(`document.querySelector('[data-lesen-q="q1"] [data-lesen-opt="F"]').getAttribute('aria-checked')`) === 'true', 'móvil: se puede responder con un toque');
  await M.eval(`document.querySelector('[data-lesen-tab="2"]').click(); true`); await sleep(300);
  check(await choose(M, 'q11', 'B') === 'ok' && await overflow(M) <= 1, 'móvil: Teil 3 con selector, sin desbordes');
  await M.eval(`document.querySelector('[data-lesen-tab="1"]').click(); true`); await sleep(300);
  check(await overflow(M) <= 1, 'móvil: la tabla de Teil 2 no desborda la página');
  await M.shot('06-movil-teil2');
  const C = await L.newPage('chromebook', 1366, 768);
  await C.go('/examenes/lesen-001?modo=practica&intro=0'); await waitFor(C, `!!document.querySelector('[data-lesen-part="1"]')`);
  for (let i = 0; i < 5; i++) { await C.eval(`document.querySelector('[data-lesen-tab="${i}"]').click(); true`); await sleep(250); if (await overflow(C) > 1) { check(false, `Chromebook 1366×768: desborde en Teil ${i + 1}`); break; } }
  await C.eval(`document.querySelector('.lv-split').scrollIntoView({block:'start'}); scrollBy(0, 400); true`); await sleep(300);
  check(await overflow(C) <= 1 && await C.eval(`(()=>{const t=document.querySelector('.lv-text').getBoundingClientRect(), q=document.querySelector('.lv-answer').getBoundingClientRect(); return t.right <= q.left + 1 && t.top >= 0 && t.bottom <= innerHeight + 2})()`), 'Chromebook 1366×768: dos columnas; al bajar, el texto se queda fijo y cabe en pantalla');
  await C.shot('07-chromebook-teil5');

  // ── 8) modo clase
  const T = await L.newPage('profe', 1440, 900);
  await T.go('/examenes/lesen-001?intro=0'); await waitFor(T, `!!document.querySelector('[data-lesen-create]')`);
  await T.eval(`document.querySelector('[data-lesen-create]').click(); true`);
  check(await waitFor(T, `/code=[A-F0-9]{6}/.test(location.search)`), 'profesor: crea la sala');
  const code = await T.eval(`new URLSearchParams(location.search).get('code')`);
  const S = await L.newPage('alumna', 1366, 768);
  await S.go(`/examenes/lesen-001?code=${code}&intro=0`); await waitFor(S, `!!document.querySelector('[data-lesen-name]')`);
  await S.type('[data-lesen-name]', 'Bea'); await sleep(100);
  await S.eval(`document.querySelector('[data-lesen-join]').click(); true`);
  check(await waitFor(S, `!!document.querySelector('[data-lesen-status="lobby"]')`), 'alumna: entra y espera');
  check(await waitFor(T, `!!document.querySelector('[data-lesen-student="Bea"]')`), 'profesor: ve a Bea');
  await T.eval(`document.querySelector('[data-lesen-start]').click(); true`);
  check(await waitFor(S, `!!document.querySelector('[data-lesen-status="running"] [data-lesen-part="1"]')`, 8000), 'alumna: empieza al pulsar el profesor');
  await clickOpt(S, 'q1', 'F'); await sleep(300); await clickOpt(S, 'q2', 'F'); await sleep(300);
  check(await waitFor(T, `document.querySelector('[data-lesen-student="Bea"]').textContent.includes('2/25')`, 6000), 'profesor: ve el avance (2/25)');
  check(await S.eval(`!document.querySelector('.hv-q.ok,.hv-q.ko,[data-lesen-score]')`), 'alumna: sin soluciones durante el examen');
  await T.eval(`window.confirm=()=>true; document.querySelector('[data-lesen-end]').click(); true`);
  check(await waitFor(S, `document.querySelector('[data-lesen-score]')?.dataset.lesenScore === '1'`, 8000), 'alumna: al terminar ve su nota (1/25)');
  check(await waitFor(T, `!!document.querySelector('[data-lesen-analysis]')`), 'profesor: análisis por pregunta en su panel');
  await T.shot('08-clase-profesor'); await S.shot('09-clase-alumna');
} catch (e) {
  console.error(e); fails.push(String(e));
} finally {
  await L.close();
}
if (fails.length) { console.log(`\nLESEN BROWSER FAIL (${fails.length})`); process.exit(1); }
console.log('\nLESEN BROWSER PASS');
