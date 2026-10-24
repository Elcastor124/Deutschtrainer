import type { CSSProperties, SVGProps } from 'react';
import './brand.css';
import { BRAND, SYMBOL, SYMBOL_STROKE, SYMBOL_VIEWBOX, WORDMARK, WORDMARK_STROKE, type PlacedGlyph } from './geometry.ts';

export { BRAND, SYMBOL, WORDMARK } from './geometry.ts';

type Tone = 'dark' | 'light' | 'mono';
interface SymbolProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  size?: number | string;
  /** Con baldosa negra redondeada (app icon / favicon). */
  tile?: boolean;
  /** dark = sobre fondo oscuro (asta papel), light = sobre fondo claro (asta negra). */
  tone?: Tone;
  /** Para la intro: cada parte expone pathLength=1 y una clase para animarla. */
  animated?: boolean;
  title?: string;
}

/** Símbolo «Punkt-D»: asta (sujeto) → panza roja (el verbo que viaja al final) → punto dorado. */
export function BrandSymbol({ size = 32, tile = false, tone = 'dark', animated, title, ...rest }: SymbolProps) {
  const stem = tone === 'mono' ? 'currentColor' : tile || tone === 'dark' ? BRAND.paper : BRAND.black;
  const red = tone === 'mono' ? 'currentColor' : BRAND.red;
  const gold = tone === 'mono' ? 'currentColor' : BRAND.gold;
  return (
    <svg viewBox={SYMBOL_VIEWBOX} width={size} height={size} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title} focusable="false" {...rest}>
      {tile && <rect className="dt-sym-tile" width="48" height="48" rx={SYMBOL.tile.r} fill={BRAND.black} />}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth={SYMBOL_STROKE}>
        <path className="dt-sym-bowl" d={SYMBOL.bowl} stroke={red} pathLength={animated ? 1 : undefined} />
        <path className="dt-sym-stem" d={SYMBOL.stem} stroke={stem} pathLength={animated ? 1 : undefined} />
      </g>
      <circle className="dt-sym-dot" cx={SYMBOL.dot.cx} cy={SYMBOL.dot.cy} r={SYMBOL.dot.r} fill={gold} />
    </svg>
  );
}

function Glyphs({ list, width, cls, animated, base = 0 }: { list: PlacedGlyph[]; width: number; cls: string; animated?: boolean; base?: number }) {
  return <g className={cls} strokeWidth={width}>{list.map((g, i) => (
    <path key={i} transform={`translate(${g.x} 0)`} d={g.d} pathLength={animated ? 1 : undefined} style={animated ? { '--i': base + i } as CSSProperties : undefined} />
  ))}</g>;
}

interface WordmarkProps extends Omit<SVGProps<SVGSVGElement>, 'children'> { height?: number | string; tone?: Tone; animated?: boolean }
/** Wordmark monolínea dibujado a mano: DEUTSCH (grueso) + TRAINER (fino) + Punkt dorado. */
export function Wordmark({ height = 18, tone = 'dark', animated, ...rest }: WordmarkProps) {
  const ink = tone === 'light' ? BRAND.black : tone === 'mono' ? 'currentColor' : BRAND.paper;
  const vbW = WORDMARK.width + 2;
  return (
    <svg viewBox={`-1 -2 ${vbW} 24`} height={height} width={typeof height === 'number' ? (height * vbW) / 24 : undefined} aria-hidden="true" focusable="false" className={`dt-wordmark ${rest.className ?? ''}`} {...rest}>
      <g fill="none" stroke={ink} strokeLinecap="round" strokeLinejoin="round">
        <Glyphs list={WORDMARK.strong} width={WORDMARK_STROKE.strong} cls="dt-wm-strong" animated={animated} />
        <Glyphs list={WORDMARK.light} width={WORDMARK_STROKE.light} cls="dt-wm-light" animated={animated} base={WORDMARK.strong.length} />
      </g>
      <circle className="dt-wm-dot" cx={WORDMARK.dot.cx} cy={WORDMARK.dot.cy} r={WORDMARK.dot.r} fill={tone === 'mono' ? 'currentColor' : BRAND.gold} />
    </svg>
  );
}

/** Logotipo horizontal: símbolo + wordmark. El nombre accesible es «Deutschtrainer». */
export function Logo({ height = 30, tone = 'dark', className = '' }: { height?: number; tone?: Tone; className?: string }) {
  return (
    <span className={`dt-logo ${className}`} role="img" aria-label="Deutschtrainer">
      <BrandSymbol size={height} tile={tone === 'dark'} tone={tone} />
      <Wordmark height={height * 0.52} tone={tone} />
    </span>
  );
}
