// Genera los iconos PNG de la app instalable (192, 512 y maskable 512) a partir de public/favicon.svg, con el
// navegador real (sin dependencias nuevas). Uso: node scripts/make-icons.mjs  → public/icons/*.png
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { launch } from './cdp.mjs';
const svg = readFileSync('public/favicon.svg', 'utf8');
mkdirSync('public/icons', { recursive: true });
const L = await launch({ shots: 'shots/icons' });
try {
  for (const [name, size, pad] of [['icon-192', 192, 0], ['icon-512', 512, 0], ['maskable-512', 512, 0.16], ['apple-touch-180', 180, 0.06]]) {
    const P = await L.newPage(name, size, size);
    const inner = Math.round(size * (1 - pad * 2));
    const html = `<html><body style="margin:0;background:#0A0A0A;width:${size}px;height:${size}px;display:grid;place-items:center">${svg.replace('<svg ', `<svg style="width:${inner}px;height:${inner}px" `)}</body></html>`;
    await P.go('/?intro=0');
    await P.eval(`document.open(); document.write(${JSON.stringify(html)}); document.close(); true`);
    await new Promise((r) => setTimeout(r, 300));
    const r = await L.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: size, height: size, scale: 1 } }, P.sid);
    writeFileSync(`public/icons/${name}.png`, Buffer.from(r.data, 'base64'));
    console.log(name, size);
  }
} finally { await L.close(); }
