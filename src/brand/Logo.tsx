import type { CSSProperties, SVGProps } from 'react';
import './brand.css';
import { BRAND, WORDMARK, WORDMARK_STROKE, type PlacedGlyph } from './geometry.ts';
import { DT_MARK } from './logo-mark.ts';

export { DT_MARK } from './logo-mark.ts';

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

/** D-cuaderno + T-lápiz, reunidos en el vértice de una A. Basado en el boceto del usuario. */
export function BrandSymbol({ size = 32, tile = false, tone = 'dark', animated, title, ...rest }: SymbolProps) {
  const ink = tone === 'mono' ? 'currentColor' : tile || tone === 'dark' ? BRAND.paper : BRAND.black;
  const red = tone === 'mono' ? 'currentColor' : BRAND.red;
  const gold = tone === 'mono' ? 'currentColor' : BRAND.gold;
  const length = animated ? 1 : undefined;
  return (
    <svg viewBox={DT_MARK.viewBox} width={size} height={size} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title} focusable="false" data-brand-symbol="dt-pencil-book" {...rest}>
      {tile && <rect width="120" height="120" rx="24" fill={BRAND.black} />}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path className="dt-mark-notebook" data-brand-part="d-notebook" d={DT_MARK.notebook} stroke={red} strokeWidth="5.2" pathLength={length} />
        <path className="dt-mark-peak" data-brand-part="a-peak" d={DT_MARK.peak} stroke={ink} strokeWidth="5.6" pathLength={length} />
        <path className="dt-mark-spine" data-brand-part="t-stem" d={DT_MARK.spine} stroke={ink} strokeWidth="3.2" pathLength={length} />
        <path className="dt-mark-page" d={DT_MARK.pageTurn} stroke={red} strokeWidth="1.7" pathLength={length} />
        <g className="dt-mark-lines" data-brand-part="notebook-lines" stroke={gold} strokeWidth="2.2">
          {DT_MARK.lines.map((d, i) => <path key={d} d={d} pathLength={length} style={{ '--line': i } as CSSProperties} />)}
        </g>
        <g className="dt-mark-pencil" data-brand-part="t-pencil">
          <path className="dt-mark-pencil-body" d={DT_MARK.pencil} fill={red} stroke={red} strokeWidth="2.2" pathLength={length} />
          <path d={DT_MARK.pencilFacet} stroke={ink} strokeWidth="1.3" pathLength={length} />
          <path d={DT_MARK.ferrule} stroke={ink} strokeWidth="1.6" pathLength={length} />
          <path data-brand-part="pencil-tip" d={DT_MARK.tip} stroke={gold} fill={gold} strokeWidth="1.2" pathLength={length} />
          <path d={DT_MARK.graphite} stroke="none" fill={tile || tone === 'dark' ? BRAND.black : ink} />
        </g>
      </g>
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
