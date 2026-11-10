// Prueba de navegador del Tablón (/tablon) y de los accesos nuevos: nav (Redet/Schreibt mit Klaus, Tablón), escritura libre,
// teoría de la Lektion y acceso directo a la clase de Klaus.
// Uso: node tests/tablon-browser.mjs [--base http://localhost:5173]
import { mkdirSync } from 'node:fs';
import { launch, sleep } from '../scripts/cdp.mjs';
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const OUT = 'shots/tablon'; mkdirSync(OUT, { recursive: true });
const L = await launch({ shots: OUT, ...(arg('--base') ? { base: arg('--base') } : {}) });
const fails = [];
const waitFor = async (P, js, ms = 12000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await P.eval(js)) return true; await sleep(150); } return false; };
const has = (sel) => `!!document.querySelector(${JSON.stringify(sel)})`;
// Captura cuando el preloader (logo) ya se ha ido.
const snap = async (P, name) => { await waitFor(P, `!document.documentElement.classList.contains('dt-booting') && !document.querySelector('[data-preloader]')`, 8000); await sleep(1200); await P.shot(name); };
const check = (ok, msg) => { console.log(`${ok ? 'OK ' : 'FAIL'} ${msg}`); if (!ok) fails.push(msg); };
const setVal = (P, sel, text) => P.eval(`(() => { const i = document.querySelector(${JSON.stringify(sel)}); const proto = i.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(i, ${JSON.stringify(text)}); i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
const register = async (P, pre) => {
  const st = await P.eval(`fetch('/api/account/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({alias:'${pre}'+Date.now().toString(36).slice(-6),password:'zorro-azul-mesa-72-lluvia'})}).then(r=>r.status)`);
  await P.eval(`localStorage.setItem('dt:student-session','cookie'); window.dispatchEvent(new Event('dt:account')); true`); return st;
};
const logout = (P) => P.eval(`fetch('/api/account/logout',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}).then(() => { localStorage.removeItem('dt:student-session'); localStorage.removeItem('dt:student-alias'); return true; })`);
const title = `Más ejercicios de Perfekt ${Date.now().toString(36).slice(-4)}`;
try {
  const P = await L.newPage('tb', 1440, 900);
  await L.send('Page.bringToFront', {}, P.sid);
  await P.go('/?intro=0'); await waitFor(P, has('.dt-nav-links a[href="/tablon"]'));
  // Nav: nombres en alemán y una sola entrada por destino
  const nav = await P.eval(`JSON.stringify([...document.querySelectorAll('.dt-nav-links a[data-nav-tab]')].map(a => [a.getAttribute('href'), a.querySelector('span').textContent]))`);
  const links = JSON.parse(nav);
  check(links.some(([h, t]) => h === '/hablar' && t === 'Redet mit Klaus'), 'nav: «Redet mit Klaus» → /hablar');
  check(links.some(([h, t]) => h === '/escribir' && t === 'Schreibt mit Klaus'), 'nav: «Schreibt mit Klaus» → /escribir');
  check(links.some(([h, t]) => h === '/tablon' && t === 'Tablón'), 'nav: «Tablón» → /tablon');
  check(new Set(links.map(([h]) => h)).size === links.length, 'nav: cada botón lleva a un sitio distinto');
  check(await P.eval(`document.documentElement.scrollWidth`) <= 1440, 'nav: sin desborde a 1440 px');
  await snap(P, 'nav');
  // Sin sesión: se lee, pero se pide entrar
  await P.eval(`document.querySelector('.dt-nav-links a[href="/tablon"]').click(); true`);
  check(await waitFor(P, has('.tb-page .tb-gate')), 'sin sesión: el tablón se ve y pide entrar');
  check(await P.eval(`document.querySelector('.dt-nav-links a[aria-current=page]')?.getAttribute('href')`) === '/tablon', 'el menú marca «Tablón»');
  // Cuenta nueva sin actividad: bloqueado con motivo
  const st = await register(P, 'Tb'); check(st === 200 || st === 201, `alta de alumno (${st})`);
  await P.go('/tablon?intro=0');
  check(await waitFor(P, has('[data-tablon-locked]')), 'cuenta sin actividad: no puede abrir peticiones');
  check(await P.eval(`document.querySelector('[data-tablon-locked]').textContent.includes('al menos una actividad')`), 'se explica por qué (al menos una actividad)');
  await snap(P, 'locked');
  // Escritura libre: modo por defecto, ideas para empezar; guardar un borrador = actividad
  await P.go('/escribir?intro=0');
  check(await waitFor(P, has('[data-writing-mode="libre"]')), 'Schreibt: arranca en «Escritura libre»');
  check(await P.eval(`![...document.querySelectorAll('.kw-controls label')].some(l => l.textContent.trim().startsWith('Tarea'))`), 'escritura libre: sin selector de tarea');
  check(await P.eval(`document.querySelectorAll('.kw-idea').length >= 3`), 'escritura libre: ideas para empezar');
  await P.eval(`document.querySelector('.kw-idea').click(); true`);
  check((await P.eval(`document.querySelector('#kw-text').value`)).startsWith('Am Wochenende habe ich'), 'una idea pone la primera frase');
  await P.eval(`[...document.querySelectorAll('.kw-mode button')].find(b => b.textContent.includes('Tarea')).click(); true`);
  check(await waitFor(P, has('.kw-task')), 'tarea guiada: muestra la tarea');
  await P.eval(`[...document.querySelectorAll('.kw-mode button')].find(b => b.textContent.includes('libre')).click(); true`);
  check(await waitFor(P, `!document.querySelector('.kw-task')`), 'volver a libre quita la tarea');
  await snap(P, 'escribir-libre');
  await P.eval(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Guardar borrador')).click(); true`);
  check(await waitFor(P, `document.querySelector('.kw-msg')?.textContent.includes('Borrador guardado')`), 'borrador guardado');
  // Con actividad: formulario → publicar
  await P.go('/tablon?intro=0');
  check(await waitFor(P, has('[data-tablon-form]')), 'con actividad: aparece el formulario');
  await P.eval(`[...document.querySelectorAll('.tb-cats label')].find(l => l.textContent.includes('Función')).click(); true`);
  await setVal(P, '#tb-title', title);
  await setVal(P, '#tb-body', 'Me gustaría practicar el Perfekt con verbos irregulares, con más ejercicios de huecos.');
  await P.eval(`document.querySelector('[data-tablon-form] button[type=submit]').click(); true`);
  check(await waitFor(P, `[...document.querySelectorAll('.tb-ticket h3')].some(h => h.textContent === ${JSON.stringify(title)})`), 'la petición aparece en el tablón');
  check(await P.eval(`[...document.querySelectorAll('.tb-ticket')].find(t => t.textContent.includes(${JSON.stringify(title)})).querySelector('.tb-mine') !== null`), 'marcada como «Tuya»');
  check(await P.eval(`[...document.querySelectorAll('.tb-ticket')].find(t => t.textContent.includes(${JSON.stringify(title)})).querySelector('.tb-vote').disabled`), 'no puedes apoyar tu propia petición');
  await snap(P, 'posted');
  // Otra cuenta con actividad (una conversación libre) apoya la petición
  await logout(P); const st2 = await register(P, 'Tc'); check(st2 === 200 || st2 === 201, `segunda cuenta (${st2})`);
  await P.go('/hablar?intro=0'); await waitFor(P, has('[data-redet-free] .rd-topic'));
  await P.eval(`document.querySelector('[data-redet-free] .rd-topic').click(); true`); await waitFor(P, has('#rd-input'));
  await setVal(P, '#rd-input', 'Ich spiele gern Fußball.'); await P.eval(`document.querySelector('.rd-compose button[type=submit]').click(); true`);
  await waitFor(P, `document.querySelectorAll('.rd-msg.is-klaus').length === 2`);
  await P.go('/tablon?intro=0'); await waitFor(P, has('[data-tablon-form]'));
  const voteSel = `[...document.querySelectorAll('.tb-ticket')].find(t => t.textContent.includes(${JSON.stringify(title)})).querySelector('.tb-vote')`;
  check(await P.eval(`!${voteSel}.disabled`), 'otra cuenta con actividad puede apoyar');
  await P.eval(`${voteSel}.click(); true`);
  check(await waitFor(P, `${voteSel}.getAttribute('aria-pressed') === 'true' && ${voteSel}.textContent.trim() === '1'`), 'apoyo: 1 y marcado');
  // Teoría desde el curso y acceso directo a la clase
  await P.go('/teoria/akkusativ?intro=0');
  check(await waitFor(P, `document.querySelectorAll('[data-theory-item]').length >= 3`), 'teoría: explicaciones y tablas de la Lektion');
  check(await P.eval(`!document.querySelector('.th-page .kx-options, .th-page .kx-fill, .th-page input')`), 'teoría: sin ejercicios');
  await snap(P, 'teoria');
  await P.eval(`document.querySelector('[data-theory-class]').click(); true`);
  check(await waitFor(P, has('.kx-room .kx-stage')), 'botón «Clase con Klaus» abre la clase directamente');
  check(await P.eval(`document.querySelector('.kx-bar h1').textContent.includes('Akkusativ')`), 'es la clase del tema (Akkusativ)');
  check(await P.eval(`location.pathname + location.search`) === '/unterricht', 'la URL queda limpia (/unterricht)');
  // Móvil
  const M = await L.newPage('tbm', 390, 844, true);
  await L.send('Page.bringToFront', {}, M.sid);
  await M.go('/tablon?intro=0'); await waitFor(M, has('.tb-list, .tb-empty'));
  check(await M.eval(`document.documentElement.scrollWidth`) <= 390, 'móvil: tablón sin desborde');
  await snap(M, 'mobile');
  await M.go('/teoria/unterwegs?intro=0'); await waitFor(M, has('[data-theory-item]'));
  check(await M.eval(`document.documentElement.scrollWidth`) <= 390, 'móvil: teoría sin desborde');
  await snap(M, 'teoria-mobile');
  const errs = [...P.errors(), ...M.errors()].filter((e) => !/401|403/.test(JSON.stringify(e)));
  check(errs.length === 0, `sin errores de consola ${errs.length ? JSON.stringify(errs).slice(0, 300) : ''}`);
} finally { await L.close(); }
if (fails.length) { console.log(`\n${fails.length} fallos`); process.exit(1); }
console.log('\nTablón OK');
