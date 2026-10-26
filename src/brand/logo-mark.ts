/** User's pencil sketch, refined on a 120-unit grid.
 * A = roof/learning path. D = curved notebook. T = horizontal pencil + book spine.
 * Kept independent from legacy geometry.ts (which is still used by the old 3D scene).
 */
export const DT_MARK = {
  viewBox: '0 0 120 120',
  peak: 'M17 101 L60 13 L103 101',
  notebook: 'M60 13 C84 23 101 46 101 72 C101 95 82 108 55 108 C40 108 27 105 17 101',
  spine: 'M60 62 V99',
  pageTurn: 'M60 99 Q79 93 97 98',
  pencil: 'M18 57 H99 V65 H18 Z',
  pencilFacet: 'M21 61 H99',
  tip: 'M99 57 L113 61 L99 65 Z',
  graphite: 'M108 59.6 L113 61 L108 62.4 Z',
  ferrule: 'M27 57 V65',
  lines: [
    'M68 72 H90',
    'M68 79 H91',
    'M68 86 H88',
    'M68 93 H81',
  ],
} as const;
