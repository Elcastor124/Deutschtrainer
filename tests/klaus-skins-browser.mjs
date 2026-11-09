// Port de las skins de Klaus (motor Canvas): navegador real contra el servidor del clon.
// Ejecutar tras `npm run build`:  node --disable-warning=ExperimentalWarning tests/klaus-skins-browser.mjs
import assert from 'node:assert/strict';
import { launch, sleep } from '../scripts/cdp.mjs';

const L = await launch({ shots: 'shots/klaus-skins', ...(process.env.BASE ? { base: process.env.BASE } : {}) });
let checks = 0;
const check = (ok, label) => { assert.ok(ok, label); checks++; console.log(`  PASS ${label}`); };
try {
  const B = await L.newPage('klaus skins', 1280, 900);
  await B.go('/preview/klaus');
  await B.until(`!!window.KlausWeb || !!document.querySelector('[data-klaus-engine="canvas"][data-klaus-ready="true"]')`, 'motor cargado por la app');
  check(await B.eval(`window.KlausWeb.skins().length === 52`), 'el motor registra 52 skins');
  check(await B.eval(`window.KlausWeb.states().length === 12`), 'el motor expone los 12 estados originales');
  check(await B.eval(`!!document.querySelector('[data-klaus-engine="canvas"] canvas')`), 'KlausFigure monta un <canvas> del motor');
  check(await B.eval(`document.querySelectorAll('script[data-klaus-engine]').length === 1`), 'el script del motor se carga una sola vez');

  // 52 skins × 12 estados: sin excepciones y con tinta visible (el lienzo no sale vacío).
  const sweep = await B.eval(`(() => {
    const api = window.KlausWeb, out = { empty: [], errors: [], drawn: 0 };
    const c = document.createElement('canvas'); c.style.cssText = 'position:fixed;left:0;top:0;width:240px;height:200px;opacity:0;pointer-events:none'; document.body.appendChild(c);
    for (const s of api.skins()) for (const st of api.states()) {
      try { api.render(c, { skin: s.id, state: st, time: 1.3, animate: true });
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let ink = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 16) ink++;
        out.drawn++; if (ink < 200) out.empty.push(s.id + ':' + st);
      } catch (e) { out.errors.push(s.id + ':' + st + ':' + e.message); }
    }
    c.remove(); return out;
  })()`);
  check(sweep.errors.length === 0, `624 dibujos (52 skins × 12 estados) sin excepciones${sweep.errors.length ? ' → ' + sweep.errors.slice(0, 3) : ''}`);
  check(sweep.drawn === 624 && sweep.empty.length === 0, `ninguno sale vacío (${sweep.drawn} dibujados)${sweep.empty.length ? ' → ' + sweep.empty.slice(0, 5) : ''}`);

  // Colección real: cuenta de alumno con skin equipada y listado (cada ficha con su canvas fijo).
  const reg = await B.eval(`fetch('/api/account/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({alias:'SkinQA'+(Date.now()%1000),password:'zorro-azul-mesa-72-lluvia',rankingOptIn:false})}).then(async r=>({s:r.status,e:(await r.json()).error||null}))`);
  check(reg.s === 200, `cuenta de prueba creada (HTTP ${reg.s}${reg.e ? ': ' + reg.e : ''})`);
  await B.eval(`localStorage.setItem('dt:student-session','cookie'); true`);
  await B.go('/klaus');
  await B.until(`!!document.querySelector('.ks-card')`, 'colección /klaus');
  const grid = await B.eval(`({cards: document.querySelectorAll('.ks-card').length, locked: document.querySelectorAll('.ks-card.locked').length, canvases: document.querySelectorAll('.ks-card [data-klaus-engine=canvas] canvas').length, still: [...document.querySelectorAll('.ks-card [data-klaus-engine=canvas]')].every(e => e.dataset.klausMotion === 'reduced')})`);
  check(grid.cards === 52, `la colección lista las 52 skins (${grid.cards})`);
  check(grid.canvases >= 1 && grid.still, 'las fichas poseídas usan lienzo fijo (sin bucle de animación por tarjeta)');

  // Pausa global de efectos y prefers-reduced-motion: el motor deja de animar.
  await B.go('/preview/klaus');
  await B.until(`!!document.querySelector('[data-klaus-engine="canvas"][data-klaus-ready="true"]')`, 'figura lista');
  check(await B.eval(`document.querySelector('[data-klaus-engine="canvas"]').dataset.klausMotion === 'full'`), 'con efectos activos la figura anima');
  await B.eval(`localStorage.setItem('dt:effects','off'); dispatchEvent(new Event('dt:effects-change')); true`);
  await sleep(300);
  check(await B.eval(`[...document.querySelectorAll('[data-klaus-engine="canvas"]')].every(e => e.dataset.klausMotion === 'reduced')`), 'la pausa global de efectos detiene la animación');

  // Rendimiento: coste medio de un fotograma del motor con la skin más pesada.
  const perf = await B.eval(`(() => { const api = window.KlausWeb, c = document.createElement('canvas'); c.style.cssText='position:fixed;left:0;top:0;width:320px;height:260px;opacity:0'; document.body.appendChild(c);
    const per = {}; for (const s of api.skins()) { const t0 = performance.now(); for (let i = 0; i < 6; i++) api.render(c, { skin: s.id, state: 'celebrating', time: i * .2, animate: true }); per[s.id] = (performance.now() - t0) / 6; }
    c.remove(); const v = Object.entries(per).sort((a, b) => b[1] - a[1]); return { worst: v[0], avg: Object.values(per).reduce((a, b) => a + b, 0) / v.length }; })()`);
  console.log(`  INFO fotograma medio ${perf.avg.toFixed(2)} ms; peor ${perf.worst[0]} ${perf.worst[1].toFixed(2)} ms (presupuesto a 30 fps: 33 ms)`);
  check(perf.worst[1] < 33, 'la skin más pesada cabe en un fotograma a 30 fps');
  const errs = B.errors(); check(errs.length === 0, `sin errores de consola ni de página${errs.length ? ' → ' + errs.slice(0, 2) : ''}`);
  console.log(`OK · ${checks} comprobaciones`);
} finally { await L.close(); }
