// Prueba de navegador del sistema «Invita a un amigo» y de la base técnica, con clics reales:
//  1) Ana crea cuenta, entra en /invitar desde «Mi espacio» y ve su enlace.
//  2) Ben abre /i/CODIGO (otro navegador), ve «Ana te invita», crea su cuenta → la invitación queda PENDIENTE (sin días).
//  3) Ben responde una pregunta de práctica (primera actividad real) → los dos tienen +7 días de Plus (Klaus abierto).
//  4) Teacher OS → Resumen → «Invitaciones»: ve Ana → Ben premiada; «Anular» resta los días a los dos.
//  5) Base técnica: 404 real, robots.txt, sitemap.xml, manifest + iconos, cabeceras de seguridad, título por página,
//     /mi de un alumno nuevo sin «0 · 0 · 0», inicio en móvil sin three.js.
// Uso: npm run build && node tests/referral-browser.mjs
import { mkdirSync } from 'node:fs';
import './helpers/plus-browser.mjs'; // fija la clave de profesor temporal antes de arrancar el servidor
import { launch, sleep } from '../scripts/cdp.mjs';

const OUT = 'shots/referral'; mkdirSync(OUT, { recursive: true });
const L = await launch({ shots: OUT });
const fails = [];
const check = (c, m) => { console.log(`${c ? '  ✔' : '  ✘'} ${m}`); if (!c) fails.push(m); };
const ready = (P) => waitFor(P, `!document.documentElement.classList.contains('dt-booting') && document.querySelector('[data-preloader]')?.dataset.preloader !== 'loading'`, 15000).then(() => sleep(700));
const waitFor = async (P, expr, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await P.eval(expr).catch(() => false)) return true; await sleep(150); } return false; };
const PW = 'zorro-azul-mesa-72-lluvia';
const stamp = Date.now().toString(36).slice(-5);
const ana = 'Ana' + stamp, ben = 'Ben' + stamp;
const me = (P) => P.eval(`fetch('/api/referral/me',{headers:{'x-student-session':'cookie'}}).then(r=>r.json())`);
const plus = (P) => P.eval(`fetch('/api/plus/me',{headers:{'x-student-session':'cookie'}}).then(r=>r.json())`);
const DAY = 86_400_000;

try {
  // ── 5) base técnica (HTTP)
  const get = async (p) => { const r = await fetch(L.base + p); return { status: r.status, type: r.headers.get('content-type') ?? '', text: await r.text(), h: r.headers }; };
  const nf = await get('/no-existe-xyz');
  check(nf.status === 404 && nf.type.includes('text/html'), `ruta desconocida → 404 con la app (${nf.status})`);
  check((await get('/curso')).status === 200, '/curso → 200');
  check((await get('/i/ABCDEF')).status === 200, '/i/CODIGO → 200');
  check((await get('/assets/no-existe.js')).status === 404, 'archivo inexistente → 404 sin HTML');
  const robots = await get('/robots.txt');
  check(robots.status === 200 && robots.type.startsWith('text/plain') && /Disallow: \/teacher/.test(robots.text) && /Sitemap: /.test(robots.text), 'robots.txt válido');
  const sm = await get('/sitemap.xml');
  check(sm.status === 200 && sm.type.includes('xml') && /<loc>[^<]+\/curso<\/loc>/.test(sm.text) && !/teacher/.test(sm.text), 'sitemap.xml con páginas públicas');
  const mf = await get('/manifest.webmanifest');
  let man = null; try { man = JSON.parse(mf.text); } catch { /* */ }
  check(mf.status === 200 && mf.type.includes('manifest+json') && man?.icons?.some((i) => i.sizes === '512x512'), 'manifest instalable con icono 512');
  for (const i of man?.icons ?? []) { if (i.src.endsWith('.png')) { const r = await get(i.src); check(r.status === 200 && r.type === 'image/png', `icono ${i.src}`); } }
  const h = (await get('/')).h;
  check(/frame-ancestors 'self'/.test(h.get('content-security-policy') ?? '') && h.get('x-frame-options') === 'SAMEORIGIN' && /max-age=/.test(h.get('strict-transport-security') ?? ''), 'CSP, X-Frame-Options y HSTS');

  // ── 1) Ana
  const A = await L.newPage('ana', 1440, 900);
  await A.go('/registro?intro=0');
  check(await waitFor(A, `document.title === 'Crear cuenta · Deutschtrainer'`), `título propio en /registro («${await A.eval('document.title')}»)`);
  const st = await A.eval(`fetch('/api/account/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({alias:'${ana}',password:'${PW}'})}).then(r=>r.status)`);
  check(st === 200, 'alta de Ana');
  await A.eval(`localStorage.setItem('dt:student-session','cookie'); localStorage.setItem('dt:student-alias','${ana}'); true`);
  await A.go('/mi?intro=0');
  check(await waitFor(A, `!!document.querySelector('[data-first-day]')`), 'Mi espacio de alumna nueva: frase de primer día en vez de «0 · 0 días · 0»');
  check(await A.eval(`!/Sin nivel asignado/.test(document.body.innerText)`), 'sin «Sin nivel asignado»');
  check(await waitFor(A, `!!document.querySelector('[data-home-invite] a[href="/invitar"]')`), 'Mi espacio → tarjeta «Invita a un amigo»');
  await A.eval(`document.querySelector('[data-home-invite] a[href="/invitar"]').click(); true`);
  check(await waitFor(A, `location.pathname === '/invitar' && !!document.querySelector('[data-ref-code]')`), 'clic → /invitar con su enlace');
  const code = await A.eval(`document.querySelector('[data-ref-code]').dataset.refCode`);
  check(/^[A-Z2-9]{6}$/.test(code ?? ''), `código de Ana: ${code}`);
  check(await A.eval(`document.querySelector('[data-ref-whatsapp]').href.includes(encodeURIComponent('/i/${code}'))`), 'botón de WhatsApp con el enlace');
  await ready(A); await A.shot('invitar-ana');

  // ── 2) Ben abre el enlace (otro navegador)
  const B = await L.newPage('ben', 390, 844, true);
  await B.go(`/i/${code}?intro=0`);
  check(await waitFor(B, `!!document.querySelector('[data-invite-landing]') && document.body.innerText.includes('${ana} te invita')`), 'Ben ve «Ana te invita…»');
  await ready(B); await B.shot('landing-ben');
  await B.eval(`document.querySelector('[data-invite-register]').click(); true`);
  check(await waitFor(B, `location.pathname === '/registro' && !!document.querySelector('[data-register-invite]')`), 'registro muestra la invitación');
  await B.type('input[autocomplete=username]', ben);
  const pws = await B.eval(`document.querySelectorAll('input[type=password]').length`);
  for (let i = 0; i < pws; i++) await B.type('input[type=password]', PW, i);
  await B.eval(`document.querySelector('form.auth-form button[type=submit], form.auth-form .btn.primary').click(); true`);
  check(await waitFor(B, `location.pathname === '/mi'`, 15000), `Ben crea su cuenta con clics (está en ${await B.eval('location.pathname')})`);
  let bm = await me(B);
  check(bm.invitedBy?.alias === ana && bm.invitedBy?.status === 'pending', `invitación pendiente (${JSON.stringify(bm.invitedBy)})`);
  check((await plus(B)).plan === 'free', 'Ben aún sin Plus (no se premia solo por registrarse)');
  check((await me(A)).friends?.[0]?.status === 'pending', 'Ana ve a Ben pendiente');

  // ── 3) primera actividad real de Ben: una práctica
  await B.go('/practica?intro=0&temas=dativ');
  await waitFor(B, `!!document.querySelector('form .btn.primary.lg')`, 15000);
  await B.eval(`document.querySelector('form .btn.primary.lg').click(); true`);
  check(await waitFor(B, `globalThis.__bcNet?.state?.view?.phase === 'question'`, 15000), 'Ben empieza a practicar');
  await B.eval(`globalThis.__bcNet.request({t:'answer', qid: globalThis.__bcNet.state.view.q.id, a:{choice:0,text:'x',gaps:['x','x','x','x'],order:[],index:0,fix:'x',pairs:[0,0,0,0]}})`);
  check(await waitFor(B, `globalThis.__bcNet.state.view.phase !== 'question'`, 8000), 'Ben responde una pregunta');
  await sleep(800);
  const pb = await plus(B), pa = await plus(A);
  check(pb.plan === 'plus' && pb.until - Date.now() > 6.9 * DAY && pb.until - Date.now() <= 7 * DAY + 60_000, `Ben: Plus 7 días (${pb.plan})`);
  check(pa.plan === 'plus' && pa.until - Date.now() > 6.9 * DAY, `Ana: Plus 7 días (${pa.plan})`);
  bm = await me(B); const am = await me(A);
  check(bm.invitedBy?.status === 'rewarded' && am.rewarded === 1, 'los dos ven la invitación premiada');
  await A.go('/invitar?intro=0');
  check(await waitFor(A, `document.querySelector('[data-ref-rewarded]')?.textContent === '7' && /\\+7 días/.test(document.querySelector('[data-ref-friends]')?.innerText ?? '')`), 'Ana ve «7 días ganados» y a Ben con +7');
  await ready(A); await A.shot('invitar-ana-premiada');
  await A.go('/escribir?intro=0');
  check(await waitFor(A, `!document.querySelector('.po-page, [data-plus-offer]') && document.body.innerText.length > 100`, 12000), 'Ana ya puede entrar en Schreibt (Plus)');

  // antiabuso por la API real
  const again = await B.eval(`fetch('/api/referral/claim',{method:'POST',headers:{'content-type':'application/json','x-student-session':'cookie'},body:JSON.stringify({code:'${code}'})}).then(r=>r.status)`);
  check(again === 409, `Ben no puede usar otro código (${again})`);
  const selfc = await A.eval(`fetch('/api/referral/claim',{method:'POST',headers:{'content-type':'application/json','x-student-session':'cookie'},body:JSON.stringify({code:'${code}'})}).then(r=>r.json())`);
  check(selfc.code === 'self', 'Ana no puede usar su propio código');

  // ── 4) Teacher OS
  const T = await L.newPage('teacher', 1440, 900);
  await T.go('/teacher?intro=0');
  await waitFor(T, `!!document.querySelector('input[type=password], input.field')`, 10000);
  await T.eval(`(() => { const i = document.querySelector('input[type=password]') ?? document.querySelector('input.field'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, ${JSON.stringify(process.env.TEACHER_PASSWORD)}); i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  await T.eval(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Entrar en Teacher OS')).click(); true`);
  check(await waitFor(T, `!!document.querySelector('[data-referral-list]')`, 15000), 'Teacher OS → Resumen: tarjeta de invitaciones');
  check(await T.eval(`[...document.querySelectorAll('[data-referral=rewarded]')].some((li) => li.innerText.includes('${ana} → ${ben}'))`), `ve «${ana} → ${ben}» premiada`);
  await T.eval(`document.querySelector('[data-referral-list]').scrollIntoView({block:'center'}); true`);
  await T.shot('teacher-referrals');
  await T.eval(`window.confirm = () => true; [...document.querySelectorAll('[data-referral=rewarded]')].find((li) => li.innerText.includes('${ben}')).querySelector('[data-referral-cancel]').click(); true`);
  check(await waitFor(T, `[...document.querySelectorAll('[data-referral=cancelled]')].some((li) => li.innerText.includes('${ben}'))`), 'Anular → queda anulada');
  const pb2 = await plus(B), pa2 = await plus(A);
  check(pb2.plan === 'free' && pa2.plan === 'free', `al anular, los dos pierden los 7 días (${pb2.plan}/${pa2.plan})`);
  check((await me(A)).friends.length === 0, 'Ana ya no ve a Ben en su lista');

  // ── 5b) inicio en móvil sin three.js; título y 404 en el navegador
  const M = await L.newPage('mobile', 390, 844, true);
  await M.go('/?intro=0');
  check(await waitFor(M, `!!document.querySelector('.dt-hero-3d.is-static .dt-hero-static')`, 10000), 'móvil: inicio con el logo estático');
  check(await M.eval(`!performance.getEntriesByType('resource').some((r) => /hero3d/.test(r.name))`), 'móvil: three.js (hero3d) no se descarga');
  await M.go('/no-existe-xyz?intro=0');
  check(await waitFor(M, `!!document.querySelector('[data-not-found]') && /no encontrada/.test(document.title)`), 'página 404 en el navegador');
  await ready(M); await M.shot('404-mobile');
  const all = [A, B, T, M].flatMap((P) => P.errors());
  check(all.length === 0, `sin errores de JavaScript (${all.slice(0, 2).join(' | ')})`);
} catch (e) { check(false, `excepción: ${e.stack ?? e}`); }
finally { await L.close(); }
console.log(fails.length ? `referral FAIL (${fails.length})` : 'referral OK');
process.exit(fails.length ? 1 : 0);
