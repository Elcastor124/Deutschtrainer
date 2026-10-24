// Hoja de contactos de identidad DEUTSCHTRAINER: 11 conceptos → 3 finalistas → ganador.
// Genera shots/brand/explorations/*.svg + index.html y la captura en PNG con Edge headless.
// Uso: node scripts/brand/contact-sheet.mjs [final]
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { BRAND, SYMBOL, SYMBOL_STROKE, WORDMARK, WORDMARK_STROKE, symbolSvg } from '../../src/brand/geometry.ts';

const root = resolve(import.meta.dirname, '../..');
const out = join(root, 'shots/brand/explorations');
mkdirSync(out, { recursive: true });
const K = BRAND.black, P = BRAND.paper, R = BRAND.red, G = BRAND.gold;

// Cada concepto: función (fg, bg) → contenido de un SVG 48×48. fg = color "negro" del entorno.
const concepts = [
  { id: '01-punkt-d', name: 'Punkt-D', idea: 'Una D que recorre negro→rojo→oro y aterriza en un punto: la frase alemana termina con el verbo y un punto.', svg: (fg) =>
    `<g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="${SYMBOL_STROKE}"><path d="${SYMBOL.bowl}" stroke="${R}"/><path d="${SYMBOL.stem}" stroke="${fg}"/></g><circle cx="${SYMBOL.dot.cx}" cy="${SYMBOL.dot.cy}" r="${SYMBOL.dot.r}" fill="${G}"/>` },
  { id: '02-tricolor-dt', name: 'Tricolor DT', idea: 'Tres barras de la bandera que se cortan formando D y T.', svg: (fg) =>
    `<rect x="8" y="10" width="32" height="8" fill="${fg}"/><rect x="8" y="20" width="32" height="8" fill="${R}"/><rect x="8" y="30" width="32" height="8" fill="${G}"/><rect x="21" y="10" width="6" height="28" fill="none"/>` },
  { id: '03-umlaut-u', name: 'Umlaut Ü', idea: 'Ü de Übung: la U es el entrenamiento, los dos puntos rojo y oro.', svg: (fg) =>
    `<path d="M14 18 V28 A10 10 0 0 0 34 28 V18" fill="none" stroke="${fg}" stroke-width="6" stroke-linecap="round"/><circle cx="17" cy="9" r="3.6" fill="${R}"/><circle cx="31" cy="9" r="3.6" fill="${G}"/>` },
  { id: '04-artikel-wuerfel', name: 'Artikel-Würfel', idea: 'Cubo isométrico: der/die/das como tres caras de un mismo sustantivo.', svg: (fg) =>
    `<path d="M24 6 L40 15 L24 24 L8 15 Z" fill="${G}"/><path d="M8 15 L24 24 V42 L8 33 Z" fill="${fg}"/><path d="M40 15 L24 24 V42 L40 33 Z" fill="${R}"/>` },
  { id: '05-tor', name: 'Tor', idea: 'Puerta de Brandeburgo esquemática (cliché turístico).', svg: (fg) =>
    `<rect x="7" y="10" width="34" height="5" fill="${fg}"/><g fill="${R}"><rect x="9" y="18" width="4" height="22"/><rect x="17" y="18" width="4" height="22"/><rect x="27" y="18" width="4" height="22"/><rect x="35" y="18" width="4" height="22"/></g><rect x="20" y="5" width="8" height="5" fill="${G}"/>` },
  { id: '06-led-dt', name: 'LED DT', idea: 'D y T en matriz de puntos 5×7, la herencia de BlackCard; filas en los colores de la bandera.', svg: (fg) => {
    const D = ['1110', '1001', '1001', '1001', '1001', '1001', '1110'];
    const T = ['111', '010', '010', '010', '010', '010', '010'];
    let s = '';
    D.forEach((row, y) => [...row].forEach((c, x) => { if (c === '1') s += `<circle cx="${8 + x * 4.6}" cy="${10 + y * 4.6}" r="1.9" fill="${y < 2 ? fg : y < 5 ? R : G}"/>`; }));
    T.forEach((row, y) => [...row].forEach((c, x) => { if (c === '1') s += `<circle cx="${29 + x * 4.6}" cy="${10 + y * 4.6}" r="1.9" fill="${y < 2 ? fg : y < 5 ? R : G}"/>`; }));
    return s; } },
  { id: '07-sprechblase', name: 'Sprechblase ß', idea: 'Bocadillo con ß (genérico de idiomas).', svg: (fg) =>
    `<path d="M8 10 H40 V32 H22 L13 40 V32 H8 Z" fill="${R}"/><text x="24" y="28" font-size="18" font-weight="900" text-anchor="middle" fill="${fg}" font-family="serif">ß</text>` },
  { id: '08-verb-am-ende', name: 'Verb am Ende', idea: 'Una línea (la frase) y una flecha que empuja el verbo al final.', svg: (fg) =>
    `<path d="M7 24 H34" stroke="${fg}" stroke-width="5" stroke-linecap="round"/><path d="M27 15 L36 24 L27 33" fill="none" stroke="${R}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="41" cy="24" r="3.6" fill="${G}"/>` },
  { id: '09-satzklammer', name: 'Satzklammer', idea: 'La «pinza» de la frase alemana: dos corchetes (verbo 2 y verbo final) que abrazan el contenido.', svg: (fg) =>
    `<path d="M16 9 H10 V39 H16" fill="none" stroke="${R}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 9 H38 V39 H32" fill="none" stroke="${G}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="24" cy="24" r="4.4" fill="${fg}"/>` },
  { id: '10-stoppuhr', name: 'Stoppuhr-D', idea: 'D como cronómetro de entrenador.', svg: (fg) =>
    `<circle cx="24" cy="27" r="14" fill="none" stroke="${fg}" stroke-width="5"/><rect x="21" y="5" width="6" height="5" fill="${R}"/><path d="M24 27 L30 20" stroke="${R}" stroke-width="4" stroke-linecap="round"/><circle cx="24" cy="27" r="2.6" fill="${G}"/>` },
  { id: '11-stufen', name: 'Stufen A1→B1', idea: 'Tres escalones ascendentes negro, rojo, oro: el camino de niveles.', svg: (fg) =>
    `<rect x="7" y="30" width="11" height="11" rx="2" fill="${fg}"/><rect x="19" y="20" width="11" height="21" rx="2" fill="${R}"/><rect x="31" y="9" width="11" height="32" rx="2" fill="${G}"/>` },
];

const scores = {
  '01-punkt-d': [5, 5, 5, 5, 5, 'Finalista A (símbolo). Riesgo: la D por sí sola es común; la diferencia está en el reparto de color y el punto.'],
  '06-led-dt': [4, 4, 3, 2, 3, 'Finalista B (letra). Continúa BlackCard, pero a 16px los puntos se funden.'],
  '09-satzklammer': [5, 5, 4, 4, 4, 'Finalista C (concepto gramatical). Excelente idea, pero sin la D no dice «Deutsch».'],
  '03-umlaut-u': [3, 4, 5, 5, 4, 'Bonito pero muy cercano a apps de idiomas.'],
  '04-artikel-wuerfel': [3, 4, 4, 4, 3, 'Se lee como logo de software/bloques.'],
  '08-verb-am-ende': [4, 4, 5, 4, 3, 'Se lee como «play/siguiente», no como idioma.'],
  '11-stufen': [2, 3, 5, 5, 3, 'Gráfico de barras genérico.'],
  '02-tricolor-dt': [1, 3, 5, 5, 2, 'Es la bandera tal cual: cero propiedad.'],
  '05-tor': [1, 3, 3, 2, 2, 'Cliché turístico, ilegible pequeño.'],
  '07-sprechblase': [1, 3, 4, 3, 2, 'Bocadillo = cliché de idiomas.'],
  '10-stoppuhr': [2, 2, 4, 3, 3, 'Gimnasio, no alemán.'],
};

const wrap = (inner, bg, size, tile = false) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="${size}" height="${size}">${tile ? `<rect width="48" height="48" rx="12" fill="${K}"/>` : `<rect width="48" height="48" fill="${bg}"/>`}${inner}</svg>`;
for (const c of concepts) writeFileSync(join(out, c.id + '.svg'), wrap(c.svg(K), '#fff', 480));

const wordmarkSvg = (fg, h = 60) => {
  const vb = `-1 -2 ${WORDMARK.width + 2} 24`;
  const g = (arr, sw) => arr.map((x) => `<path transform="translate(${x.x} 0)" d="${x.d}"/>`).join('') && `<g fill="none" stroke="${fg}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${arr.map((x) => `<path transform="translate(${x.x} 0)" d="${x.d}"/>`).join('')}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" height="${h}" width="${h * (WORDMARK.width + 2) / 24}">${g(WORDMARK.strong, WORDMARK_STROKE.strong)}${g(WORDMARK.light, WORDMARK_STROKE.light).replace(`stroke="${fg}"`, `stroke="${fg}" opacity="0.92"`)}<circle cx="${WORDMARK.dot.cx}" cy="${WORDMARK.dot.cy}" r="${WORDMARK.dot.r}" fill="${G}"/></svg>`;
};

const final = process.argv[2] === 'final';
const css = `body{margin:0;background:#E9E7E1;font-family:system-ui,sans-serif;color:#111;padding:28px}h1{font-size:26px;margin:0 0 4px}h2{font-size:18px;margin:26px 0 10px}p{margin:0 0 6px;font-size:13px;max-width:70ch}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.card{background:#fff;border-radius:10px;padding:12px;display:grid;gap:8px}.card.f{outline:3px solid ${R}}
.sizes{display:flex;align-items:end;gap:10px}.dark{background:${K};border-radius:8px;padding:8px;display:flex;align-items:end;gap:10px}.n{font-weight:700;font-size:14px}.s{font-size:11px;color:#555}
table{border-collapse:collapse;font-size:12px;background:#fff}td,th{border:1px solid #ccc;padding:4px 8px;text-align:left}.wide{display:grid;grid-template-columns:1fr 1fr;gap:14px}.panel{border-radius:10px;padding:22px;display:flex;gap:18px;align-items:center}`;
let html = `<!doctype html><meta charset="utf-8"><style>${css}</style><h1>DEUTSCHTRAINER · identidad — ${final ? 'sistema final' : 'hoja de contactos'}</h1><p>Entorno principal blanco y negro; color solo como sistema (negro · rojo señal ${R} · oro ${G}). Cada concepto grande, 32, 24 y 16 px, en claro y en oscuro.</p>`;
if (!final) {
  html += `<h2>1 · Once conceptos</h2><div class="grid">`;
  for (const c of concepts) {
    const fin = ['01-punkt-d', '06-led-dt', '09-satzklammer'].includes(c.id);
    html += `<div class="card${fin ? ' f' : ''}"><div class="n">${c.name}${fin ? ' ★' : ''}</div><div class="sizes">${wrap(c.svg(K), '#fff', 96)}${wrap(c.svg(K), '#fff', 32)}${wrap(c.svg(K), '#fff', 24)}${wrap(c.svg(K), '#fff', 16)}</div><div class="dark">${wrap(c.svg(P), K, 48)}${wrap(c.svg(P), K, 24)}${wrap(c.svg(P), K, 16)}</div><div class="s">${c.idea}</div></div>`;
  }
  html += `</div><h2>2 · Autocrítica (1-5)</h2><table><tr><th>Concepto</th><th>Distintivo</th><th>Relevante</th><th>Simple</th><th>16-24px</th><th>Versátil</th><th>Veredicto</th></tr>`;
  for (const [id, s] of Object.entries(scores)) html += `<tr><td>${concepts.find((c) => c.id === id).name}</td>${s.slice(0, 5).map((v) => `<td>${v}</td>`).join('')}<td>${s[5]}</td></tr>`;
  html += `</table>`;
} else {
  html += `<h2>Símbolo final «Punkt-D» — app icon / favicon</h2><div class="sizes">${symbolSvg({ size: 160 })}${symbolSvg({ size: 64 })}${symbolSvg({ size: 32 })}${symbolSvg({ size: 24 })}${symbolSvg({ size: 16 })}${symbolSvg({ tile: false, size: 96 })}${symbolSvg({ tile: false, size: 96, mono: K })}</div>
  <h2>Wordmark</h2><div class="stack"><div class="panel" style="background:${K}">${symbolSvg({ size: 64 })}${wordmarkSvg(P, 40)}</div><div class="panel" style="background:#fff">${symbolSvg({ tile: false, size: 64 })}${wordmarkSvg(K, 40)}</div><div class="panel" style="background:${R}">${symbolSvg({ size: 64 })}${wordmarkSvg(K, 32)}</div></div>
  <h2>Paleta</h2><div class="sizes">${[[K, 'Schwarz #0A0A0A'], [P, 'Papier #F2F1EE'], [R, 'Signalrot #FF3832'], [G, 'Gold #E9B949'], [BRAND.redDeep, 'Rot tief #B3201B']].map(([c, n]) => `<div style="width:150px"><div style="height:70px;background:${c};border-radius:8px;border:1px solid #0002"></div><div class="s">${n}</div></div>`).join('')}</div>
  <p style="margin-top:14px">Tipografía: Space Grotesk (texto y titulares), Doto (marcadores de puntos, herencia BlackCard), JetBrains Mono (datos). Wordmark dibujado a mano, monolínea, DEUTSCH grueso + TRAINER fino.</p>`;
}
const name = final ? 'final' : 'index';
writeFileSync(join(out, name + '.html'), html);
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const png = join(root, 'shots/brand', final ? 'brand-final.png' : 'contact-sheet.png');
const r = spawnSync(EDGE, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--screenshot=${png}`, final ? '--window-size=1400,1100' : '--window-size=1500,1750', pathToFileURL(join(out, name + '.html')).href], { stdio: 'pipe', timeout: 60000 });
console.log(JSON.stringify({ png, status: r.status, exists: existsSync(png) }));
