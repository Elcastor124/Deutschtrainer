// DEUTSCHTRAINER — geometría de marca (fuente única de verdad).
// Todo son trazos de centro (stroke paths) sobre una retícula: así el mismo dato sirve para
// el logo estático, el favicon, el dibujo animado de la intro y las texturas 3D.
//
// Símbolo «Punkt» (dirección ganadora): una D cuyo trazo recorre los tres colores de Alemania
// en orden — asta negra/papel, panza roja, y aterriza en un punto dorado. En alemán el verbo
// viaja al final de la frase y la frase termina en punto: «…, weil ich Deutsch lerne.»

export const BRAND = {
  name: 'Deutschtrainer',
  black: '#0A0A0A',
  ink: '#121211',
  paper: '#F2F1EE',
  red: '#FF3832',
  redDeep: '#B3201B',
  gold: '#E9B949',
  goldDeep: '#A87C1E',
} as const;

/** Símbolo en una retícula de 48×48. */
export const SYMBOL_VIEWBOX = '0 0 48 48';
export const SYMBOL_STROKE = 6.4;
export const SYMBOL = {
  tile: { x: 0, y: 0, w: 48, h: 48, r: 12 },
  /** Asta vertical (sujeto). */
  stem: 'M14.5 11.5 V27',
  /** Panza: sale de lo alto del asta y vuelve hacia abajo (el verbo que viaja al final). */
  bowl: 'M14.5 11.5 H21.5 A12.5 12.5 0 0 1 21.5 36.5 H22.5',
  /** Punto final (Punkt) donde aterriza la frase. */
  dot: { cx: 14.5, cy: 36.5, r: 4.4 },
} as const;

// ── Wordmark monolínea, altura de mayúscula 20 (líneas de centro entre y=2 e y=18) ──
interface Glyph { d: string; w: number }
export const GLYPHS: Record<string, Glyph> = {
  D: { d: 'M2 2 V18 H8 A8 8 0 0 0 8 2 Z', w: 18 },
  E: { d: 'M13.5 2 H2 V18 H13.5 M2 10 H11', w: 15 },
  U: { d: 'M2 2 V12 A6 6 0 0 0 14 12 V2', w: 16 },
  T: { d: 'M1 2 H15 M8 2 V18', w: 16 },
  S: { d: 'M13.2 4.6 C11.8 2.9 10.1 2 7.9 2 C4.8 2 2.6 3.8 2.6 6.1 C2.6 8.6 4.9 9.4 8.1 10 C11.3 10.6 13.6 11.5 13.6 14.1 C13.6 16.3 11.4 18 8 18 C5.7 18 3.8 17.2 2.3 15.5', w: 16 },
  C: { d: 'M15.4 4.6 A8 8 0 1 0 15.4 15.4', w: 17 },
  H: { d: 'M2 2 V18 M14 2 V18 M2 10 H14', w: 16 },
  R: { d: 'M2 18 V2 H8.5 A4 4 0 0 1 8.5 10 H2 M8.5 10 L14 18', w: 16 },
  A: { d: 'M1.6 18 L8 2 L14.4 18 M4.4 12.5 H11.6', w: 16 },
  I: { d: 'M2 2 V18', w: 4 },
  N: { d: 'M2 18 V2 L14 18 V2', w: 16 },
};

export const WORD_GAP = 3.2;
export interface PlacedGlyph { ch: string; d: string; x: number; w: number }
export function layoutWord(word: string, x0 = 0, gap = WORD_GAP): { glyphs: PlacedGlyph[]; width: number } {
  let x = x0;
  const glyphs: PlacedGlyph[] = [];
  for (const ch of word.toUpperCase()) {
    const g = GLYPHS[ch];
    if (!g) throw new Error(`Glifo sin dibujar: ${ch}`);
    glyphs.push({ ch, d: g.d, x, w: g.w });
    x += g.w + gap;
  }
  return { glyphs, width: x - gap - x0 };
}

/** Wordmark: DEUTSCH (grueso) + TRAINER (fino) + punto dorado. */
export const WORDMARK = (() => {
  const strong = layoutWord('DEUTSCH');
  const light = layoutWord('TRAINER', strong.width + WORD_GAP + 2.6, 4.6);
  const dotX = light.glyphs[light.glyphs.length - 1].x + light.glyphs[light.glyphs.length - 1].w + 3.2;
  return { strong: strong.glyphs, light: light.glyphs, dot: { cx: dotX, cy: 17.2, r: 2.6 }, width: dotX + 3, height: 20 };
})();
export const WORDMARK_STROKE = { strong: 3.9, light: 2.1 } as const;

/** Traslada un path de glifo a una cadena con transform para canvas/Path2D. */
export function glyphPath(g: PlacedGlyph): string { return g.d; }

/** SVG completo del símbolo (para favicon, texturas y exportación). */
export function symbolSvg({ tile = true, size = 48, mono }: { tile?: boolean; size?: number; mono?: string } = {}): string {
  const stem = mono ?? (tile ? BRAND.paper : BRAND.black);
  const red = mono ?? BRAND.red;
  const gold = mono ?? BRAND.gold;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${SYMBOL_VIEWBOX}" width="${size}" height="${size}">` +
    (tile ? `<rect width="48" height="48" rx="${SYMBOL.tile.r}" fill="${BRAND.black}"/>` : '') +
    `<g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="${SYMBOL_STROKE}">` +
    `<path d="${SYMBOL.bowl}" stroke="${red}"/><path d="${SYMBOL.stem}" stroke="${stem}"/></g>` +
    `<circle cx="${SYMBOL.dot.cx}" cy="${SYMBOL.dot.cy}" r="${SYMBOL.dot.r}" fill="${gold}"/></svg>`;
}
