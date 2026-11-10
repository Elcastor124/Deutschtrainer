// Capturas de las pantallas principales en escritorio y móvil, con comprobaciones básicas
// (desborde horizontal, errores de consola, rutas). Contra el entorno local en marcha o un servidor propio.
//   node scripts/overhaul-shots.mjs [--base http://localhost:5173] [--out shots/overhaul] [--only practica,mi]
import { writeFileSync, mkdirSync } from 'node:fs';
import { launch, sleep } from './cdp.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const base = arg('--base', undefined);
const out = arg('--out', 'shots/overhaul');
const only = arg('--only', '')?.split(',').filter(Boolean) ?? [];
mkdirSync(out, { recursive: true });

const ROUTES = [
  ['landing', '/?intro=0', false],
  ['practica', '/practica?intro=0&temas=dativ,perfekt', false],
  ['curso', '/curso?intro=0', false],
  ['mi', '/mi?intro=0', true],
  ['klaus', '/klaus?intro=0', true],
  ['escribir', '/escribir?intro=0', true],
  ['examenes', '/examenes?intro=0', false],
  ['juegos', '/juegos?intro=0', false],
].filter(([n]) => !only.length || only.includes(n));
const SIZES = [['d', 1440, 900, false], ['m', 390, 844, true]];

const L = await launch({ shots: out, ...(base ? { base } : {}) });
let bad = 0;
try {
  // Una cuenta de alumno para las pantallas con sesión (datos aislados del servidor de pruebas o del local).
  const alias = `Ov${Date.now().toString(36).slice(-6)}`;
  for (const [tag, w, h, mobile] of SIZES) {
    const P = await L.newPage(`ov-${tag}`, w, h, mobile);
    // En segundo plano Edge no avanza transiciones: la pestaña va al frente y con foco emulado.
    await L.send('Page.bringToFront', {}, P.sid);
    await L.send('Emulation.setFocusEmulationEnabled', { enabled: true }, P.sid);
    let signed = false;
    for (const [name, path, needsAccount] of ROUTES) {
      if (needsAccount && !signed) {
        await P.go('/?intro=0'); await sleep(800);
        const r = await P.eval(`fetch('/api/account/${tag === 'd' ? 'register' : 'login'}', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({alias:'${alias}', password:'zorro-azul-mesa-72-lluvia', confirm:'zorro-azul-mesa-72-lluvia'})}).then(r => r.status)`);
        await P.eval(`localStorage.setItem('dt:student-session','cookie'); true`);
        signed = r === 200;
        if (!signed) console.log(`  ! cuenta ${tag}: ${r}`);
      }
      await P.go(path);
      await sleep(name === 'landing' ? 3200 : 2200);
      // Recorre la página para que se revelen las piezas que aparecen al hacer scroll, y vuelve arriba.
      await P.eval(`(async () => { const H = document.documentElement.scrollHeight; for (let y = 0; y < H; y += innerHeight * 0.7) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } scrollTo(0, 0); })()`);
      await sleep(700);
      const info = await P.eval(`({ sw: document.documentElement.scrollWidth, iw: innerWidth, h: document.documentElement.scrollHeight,
        wide: [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed'; })
          .filter((e) => { for (let p = e.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'hidden' || o === 'clip' || o === 'auto' || o === 'scroll') return false; } return true; })
          .slice(0, 3).map((e) => e.tagName.toLowerCase() + '.' + [...e.classList].join('.')) })`);
      const r = await L.send('Page.captureScreenshot', { format: 'jpeg', quality: 72, captureBeyondViewport: true,
        clip: { x: 0, y: 0, width: w, height: Math.min(info.h, mobile ? 2600 : 3400), scale: 1 } }, P.sid);
      writeFileSync(`${out}/${name}-${tag}.jpg`, Buffer.from(r.data, 'base64'));
      const errs = P.errors();
      const ok = info.sw <= info.iw && !info.wide.length && !errs.length;
      if (!ok) bad++;
      console.log(`${ok ? 'OK ' : 'MAL'} ${name}-${tag}  ancho ${info.sw}/${info.iw}${info.wide.length ? '  sale: ' + info.wide.join(' ') : ''}${errs.length ? '  errores: ' + JSON.stringify(errs.slice(0, 2)) : ''}`);
    }
  }
} finally { await L.close(); }
console.log(bad ? `\n${bad} pantalla(s) con problemas` : '\nSin desbordes ni errores de consola');
process.exit(bad ? 1 : 0);
