// Auditoría exploratoria: recorre todas las pantallas como visitante, alumno Free y alumno Plus, en móvil (390) y
// escritorio (1440). Por pantalla: errores JS, desbordamiento horizontal, tiempo hasta contenido, botones sin nombre,
// imágenes sin alt, objetivos táctiles pequeños, h1, título del documento y captura. Uso: node scripts/audit-tour.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { setPlan } from '../tests/helpers/plus-browser.mjs';
import { launch, sleep } from './cdp.mjs';
const OUT = 'shots/audit'; mkdirSync(OUT, { recursive: true });
const L = await launch({ shots: OUT });
const ROUTES = ['/', '/curso', '/practica', '/juegos', '/examenes', '/road-to-b1', '/mi', '/klaus', '/escribir', '/unterricht', '/hablar', '/tablon', '/teoria/akkusativ', '/plus', '/ranking', '/no-existe-xyz'];
const rows = [];
const PROBE = `(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const btns = [...document.querySelectorAll('button, a[href], [role=button]')].filter(vis);
  const unnamed = btns.filter((b) => !(b.getAttribute('aria-label') || b.textContent.trim() || b.getAttribute('title') || b.querySelector('img[alt]:not([alt=""])'))).map((b) => b.outerHTML.slice(0, 90));
  const small = innerWidth < 600 ? btns.filter((b) => { const r = b.getBoundingClientRect(); return (r.width < 32 || r.height < 32) && !b.closest('p, li > p, .prose'); }).map((b) => (b.textContent.trim() || b.getAttribute('aria-label') || b.tagName).slice(0, 30)) : [];
  const over = document.documentElement.scrollWidth > innerWidth + 1 ? [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > innerWidth + 2 && getComputedStyle(e).position !== 'fixed' && vis(e)).slice(0, 3).map((e) => e.tagName + '.' + String(e.className).slice(0, 40)) : [];
  const imgs = [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length;
  const h1 = [...document.querySelectorAll('h1')].filter(vis).map((h) => h.textContent.trim().slice(0, 40));
  const words = document.body.innerText.trim().split(/\\s+/).length;
  return { title: document.title, h1, unnamed: unnamed.slice(0, 4), small: [...new Set(small)].slice(0, 8), over, imgs, words, path: location.pathname, nodes: document.querySelectorAll('*').length };
})()`;
async function tour(P, who, w) {
  for (const r of ROUTES) {
    const t0 = Date.now();
    await P.go(r + (r.includes('?') ? '&' : '?') + 'intro=0');
    let ready = false;
    for (let k = 0; k < 80; k++) { ready = await P.eval(`!document.documentElement.classList.contains('dt-booting') && !document.querySelector('[data-preloader], .tos-skel, [aria-busy=true]') && document.body.innerText.trim().length > 80`).catch(() => false); if (ready) break; await sleep(100); }
    const ms = Date.now() - t0;
    await sleep(900);
    const p = await P.eval(PROBE).catch((e) => ({ err: String(e) }));
    const name = `${who}-${w}-${r.replace(/\W+/g, '_') || 'home'}`;
    await P.shot(name);
    const errs = P.errors().splice(0);
    rows.push({ who, w, route: r, ms, ready, errs: errs.slice(0, 3), ...p, shot: name });
    console.log(`${who} ${w} ${r} ${ms}ms ready=${ready} words=${p.words} errs=${errs.length} over=${(p.over ?? []).length} small=${(p.small ?? []).length} unnamed=${(p.unnamed ?? []).length} final=${p.path}`);
  }
}
try {
  for (const [w, h, m] of [[390, 844, true], [1440, 900, false]]) {
    const V = await L.newPage('visit' + w, w, h, m); await tour(V, 'visitante', w);
    const S = await L.newPage('free' + w, w, h, m);
    await S.go('/?intro=0'); await sleep(300);
    const alias = 'Au' + w + Date.now().toString(36).slice(-4);
    await S.eval(`fetch('/api/account/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({alias:'${alias}',password:'zorro-azul-mesa-72-lluvia'})}).then(r=>r.status)`);
    await S.eval(`localStorage.setItem('dt:student-session','cookie'); localStorage.setItem('dt:student-alias','${alias}'); true`);
    await tour(S, 'free', w);
    await setPlan(L.base, alias);
    await tour(S, 'plus', w);
  }
} catch (e) { console.error('ERR', e); }
finally { writeFileSync(`${OUT}/tour.json`, JSON.stringify(rows, null, 1)); await L.close(); }
