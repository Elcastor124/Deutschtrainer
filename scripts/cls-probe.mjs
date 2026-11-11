// Mide los saltos de diseño (CLS) de una ruta en móvil y dice qué elementos se movieron y cuándo.
// Uso: node scripts/cls-probe.mjs /curso
import { launch, sleep } from './cdp.mjs';
const route = process.argv[2] ?? '/curso';
const L = await launch({ shots: 'shots/audit' });
try {
  const P = await L.newPage('cls', 390, 844, true);
  await L.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__ls = [];
    new PerformanceObserver((l) => { for (const e of l.getEntries()) { if (e.hadRecentInput) continue;
      window.__ls.push({ v: +e.value.toFixed(4), t: Math.round(e.startTime), src: (e.sources || []).map((s) => {
        const n = s.node; const d = n && n.nodeType === 1 ? n.tagName + '.' + String(n.className).slice(0, 50) : String(n && n.nodeName);
        return d + ' ' + JSON.stringify([Math.round(s.previousRect.y), Math.round(s.currentRect.y), Math.round(s.previousRect.height), Math.round(s.currentRect.height)]); }) }); } })
      .observe({ type: 'layout-shift', buffered: true });` }, P.sid);
  await L.send('Emulation.setCPUThrottlingRate', { rate: 4 }, P.sid);
  await L.send('Network.enable', {}, P.sid);
  await L.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200_000, uploadThroughput: 90_000 }, P.sid);
  await P.go(route.includes('?') ? route : route + '?intro=0');
  await sleep(15000);
  const r = await P.eval('window.__ls');
  console.log('CLS total', r.reduce((n, e) => n + e.v, 0).toFixed(3));
  for (const e of r) console.log(e.t + 'ms', e.v, e.src.join(' | '));
} finally { await L.close(); }
