// QA de marca en navegador real (Edge headless vía CDP): portada, curso y rutas existentes en 4 tamaños.
// Comprueba desborde horizontal, errores de consola, intro (saltar con clic y Esc), marcar un paso del curso,
// menú móvil y fallback 3D. Capturas en shots/brand/.  Uso: npm run build && node scripts/brand-ui.mjs
import assert from 'node:assert/strict';
import { launch, sleep } from './cdp.mjs';

const SIZES = [[390, 844, true], [768, 1024, true], [1366, 768, false], [1920, 1080, false]];
const ROUTES = ['/', '/curso', '/practica', '/jugar', '/jenga', '/road-to-b1', '/boxeo', '/profesor', '/tema/1'];
const env = await launch({ shots: 'shots/brand' });
const report = { overflow: [], errors: [], checks: {} };
const overflowProbe = `(()=>{const W=document.documentElement.clientWidth;const bad=[];for(const e of document.querySelectorAll('body *')){const r=e.getBoundingClientRect();if(r.width&&r.right>W+1){let p=e,clip=false;while(p&&p!==document.body){const s=getComputedStyle(p);if(/hidden|clip/.test(s.overflowX)&&p!==e){clip=true;break}p=p.parentElement}if(!clip)bad.push((e.className&&e.className.baseVal===undefined?e.tagName+'.'+String(e.className).split(' ')[0]:e.tagName)+':'+Math.round(r.right))}}return {sw:document.documentElement.scrollWidth,W,bad:bad.slice(0,6)}})()`;
try {
  // 1 · Intro: aparece la primera vez, se salta con clic, no vuelve en la misma sesión.
  const a = await env.newPage('intro', 1366, 768);
  await a.go('/');
  await a.until(`!!document.querySelector('[data-testid=intro]:not(.is-waiting)')`, 'intro visible', 15000);
  await a.until(`!document.querySelector('[data-testid=intro]')`, 'intro termina sola en la primera visita', 8500);
  assert(!(await a.eval(`document.documentElement.classList.contains('dt-intro-lock')`)), 'scroll bloqueado tras la intro');
  await a.reload();
  await a.until(`!!document.querySelector('.dt-hero')`, 'landing');
  await sleep(300);
  assert(!(await a.eval(`!!document.querySelector('[data-testid=intro]')`)), 'la intro se repite en la misma sesión');
  // Clic real (CDP) en la capa de la intro: debe empezar la salida al instante y desaparecer en ≤600 ms.
  await a.go('/?intro=still'); // intro retenida: el clic es lo único que la cierra
  await a.until(`!!document.querySelector('.dt-intro.play')`, 'intro en reproducción', 12000);
  await a.eval(`(()=>{window.__skip=null;addEventListener('pointerdown',()=>{const t=performance.now();const tick=()=>{if(!document.querySelector('[data-testid=intro]'))window.__skip=Math.round(performance.now()-t);else requestAnimationFrame(tick)};tick()},{capture:true,once:true});return 1})()`);
  await a.click('[data-testid=intro]');
  await a.until(`window.__skip!==null`, 'intro cerrada tras clic', 3000);
  report.checks.introSkipMs = await a.eval('window.__skip');
  assert(report.checks.introSkipMs <= 900, 'saltar la intro tarda demasiado');
  // Esc también la salta; la nueva entrada cinematográfica dura 6.2 s.
  await a.go('/?intro=still');
  await a.until(`!!document.querySelector('.dt-intro.play')`, 'intro forzada');
  await a.key('Escape');
  await a.until(`!document.querySelector('.dt-intro.play')`, 'Esc inicia la salida', 1200);
  await a.until(`!document.querySelector('[data-testid=intro]')`, 'intro cerrada con Esc', 3000);
  await a.go('/?intro=1');
  await a.until(`!!document.querySelector('[data-testid=intro]:not(.is-waiting)')`, 'intro forzada 2', 15000);
  // Duración medida dentro de la página (las capturas no cuentan).
  await a.eval(`(()=>{const t=performance.now();window.__introMs=null;const mo=new MutationObserver(()=>{if(!document.querySelector('[data-testid=intro]')){window.__introMs=Math.round(performance.now()-t);mo.disconnect()}});mo.observe(document.body,{childList:true,subtree:true});return 1})()`);
  await sleep(2600);
  await a.until(`window.__introMs!==null`, 'intro termina sola', 5000);
  report.checks.introAutoMs = await a.eval('window.__introMs');
  assert(report.checks.introAutoMs >= 5000 && report.checks.introAutoMs <= 7200, 'intro fuera del contrato cinematográfico de 6.2 s');
  // Invitación a sala: sin intro.
  const inv = await env.newPage('invite', 1366, 768);
  await inv.go('/?sala=TEST');
  await inv.until(`!!document.querySelector('input[aria-label="Código de sala"]')`, 'invitación');
  assert(!(await inv.eval(`!!document.querySelector('[data-testid=intro]')`)), 'intro en invitación');

  // 2 · 3D: el lienzo se monta y renderiza (pestaña al frente: en segundo plano se pausa a propósito).
  await env.send('Page.bringToFront', {}, a.sid);
  await a.go('/?intro=0');
  await a.until(`!!document.querySelector('.dt-hero-3d.is-ready canvas')`, 'escena 3D lista', 30000);
  await sleep(1800);
  report.checks.webgl = await a.eval(`(()=>{const c=document.querySelector('.dt-hero-3d canvas');return {w:c.width,h:c.height}})()`);
  report.checks.heroCanvas = await a.eval(`document.querySelectorAll('.dt-hero-3d canvas').length`);
  assert.equal(report.checks.heroCanvas, 1, 'hero canvas mounted');
  await sleep(500);
  await a.shot('landing-hero-interactive');

  // 3 · Curso: el siguiente paso está destacado; marcarlo actualiza anillo y recomendación.
  const c = await env.newPage('curso', 1366, 768);
  await c.go('/curso?intro=0');
  await c.until(`!!document.querySelector('.cg-step.is-next')`, 'paso recomendado');
  const first = await c.eval(`document.querySelector('.cg-step.is-next input').id`);
  assert.equal(first, 'step-bruecke-a1-ver');
  await c.click('.cg-step.is-next .dt-check');
  await c.until(`document.querySelector('.cg-step.is-next input')?.id==='step-bruecke-a1-practicar'`, 'avanza al paso 2');
  const ring = await c.eval(`document.querySelector('#bruecke-a1 .dt-ring').getAttribute('aria-label')`);
  assert.match(ring, /1 de 3/);
  // Teclado: espacio sobre la casilla enfocada.
  await c.eval(`document.getElementById('step-bruecke-a1-practicar').focus()`);
  await c.key(' ');
  await c.until(`document.getElementById('step-bruecke-a1-practicar').checked`, 'marcar con teclado');
  await c.reload();
  await c.until(`document.getElementById('step-bruecke-a1-practicar')?.checked`, 'progreso persistente');
  report.checks.courseNext = await c.eval(`document.querySelector('.cg-step.is-next input').id`);
  await c.shot('course-progress-1366');
  // La portada refleja el progreso.
  await c.go('/?intro=0');
  await c.until(`/Continúa/.test(document.querySelector('.dt-resume')?.textContent||'')`, 'continúa donde lo dejaste');
  report.checks.resume = await c.eval(`document.querySelector('.dt-resume h2').textContent`);
  // Paso 1 abre la presentación real.
  const presHref = await c.eval(`(()=>{location.href='/curso?intro=0';return true})()`);
  await c.until(`!!document.querySelector('#bruecke-a1 .cg-step a[href$=".html"]')`, 'enlace presentación');
  const href = await c.eval(`document.querySelector('#bruecke-a1 .cg-step a[href$=".html"]').getAttribute('href')`);
  const r = await fetch(env.base + href); assert.equal(r.status, 200); void presHref;
  // /tema/1 enlaza al curso.
  await c.go('/tema/1');
  await c.until(`!!document.querySelector('a[href="/curso"]')`, 'tema 1 → curso');

  // 4 · Barrido de rutas × tamaños
  for (const [w, h, mobile] of SIZES) {
    const p = await env.newPage(`sweep-${w}`, w, h, mobile);
    for (const route of ROUTES) {
      await p.go(route + (route.includes('?') ? '&' : '?') + 'intro=0');
      await p.until(`document.readyState==='complete' && !!document.querySelector('#root > *')`, `${route} carga`);
      await sleep(route === '/' ? 1600 : 700);
      if (route === '/') await p.eval(`(async()=>{for(let y=0;y<document.body.scrollHeight;y+=innerHeight*0.7){scrollTo(0,y);await new Promise(f=>setTimeout(f,90))}scrollTo(0,0)})()`);
      await sleep(200);
      const o = await p.eval(overflowProbe);
      if (o.sw > o.W + 1 || o.bad.length) report.overflow.push({ route, w, ...o });
      const name = route === '/' ? 'landing' : route.slice(1).replace(/\//g, '-');
      if (['/', '/curso', '/profesor'].includes(route) || w === 390) await p.shot(`${name}-${w}`);
      if (route === '/' && w >= 1366) {
        await p.eval(`document.getElementById('juegos').scrollIntoView({block:'start'})`); await sleep(900); await p.shot(`landing-games-${w}`);
        await p.eval(`document.querySelector('.dt-flow').scrollIntoView({block:'center'})`); await sleep(900); await p.shot(`landing-flow-${w}`);
      }
    }
    // Menú móvil accesible
    if (w < 920) {
      await p.go('/curso?intro=0');
      await p.until(`!!document.querySelector('.dt-nav-toggle')`, 'toggle');
      await p.click('.dt-nav-toggle');
      await p.until(`document.querySelector('.dt-nav-toggle').getAttribute('aria-expanded')==='true'`, 'menú abierto');
      await sleep(300);
      await p.shot(`nav-open-${w}`);
      await p.click('.dt-nav-links a[href="/practica"]');
      await p.until(`location.pathname==='/practica' && document.querySelector('.dt-nav-toggle').getAttribute('aria-expanded')==='false'`, 'menú navega y se cierra');
    }
    const errs = p.errors();
    if (errs.length) report.errors.push({ w, errs });
  }
  for (const pg of [a, c]) if (pg.errors().length) report.errors.push({ page: pg.label, errs: pg.errors() });

  // 5 · Sin WebGL: fallback estático.
  const nogl = await env.newPage('nogl', 1366, 768);
  await env.send('Page.addScriptToEvaluateOnNewDocument', { source: `HTMLCanvasElement.prototype.getContext=function(){return null}` }, nogl.sid);
  await nogl.go('/?intro=0');
  await nogl.until(`!!document.querySelector('.dt-hero-static')`, 'fallback SVG sin WebGL');
  await sleep(600);
  await nogl.shot('landing-nowebgl-1366');
  report.checks.noWebglFallback = true;

  // Fotogramas: una carga por fotograma, animaciones CSS congeladas en el instante T (la captura tarda).
  for (const [T, n] of [[420, 'intro-1-dots'], [980, 'intro-2-draw'], [1750, 'intro-3-logo']]) {
    const f = await env.newPage('frame', 1366, 768);
    await f.go('/?intro=still');
    await f.until(`!!document.querySelector('.dt-intro.play') && document.fonts.status==='loaded'`, 'intro fotograma');
    await f.eval(`(()=>{document.getAnimations().forEach(x=>{x.pause();x.currentTime=${T}});return 1})()`);
    await f.shot(n);
    await f.go('/profesor?intro=0'); // libera el contexto WebGL de este fotograma
  }
  console.log(JSON.stringify(report, null, 1));
  assert.equal(report.overflow.length, 0, 'desborde horizontal');
  assert.equal(report.errors.length, 0, 'errores de consola');
  console.log(JSON.stringify({ ok: true, routes: ROUTES.length, sizes: SIZES.length }));
} finally { await env.close(); }
