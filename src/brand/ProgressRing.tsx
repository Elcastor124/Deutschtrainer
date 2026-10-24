import { useMemo, type CSSProperties } from 'react';

/** Anillo de progreso (SVG). Oro al completarse; rojo mientras avanza. */
export function ProgressRing({ pct, size = 56, stroke = 5, label, children }: { pct: number; size?: number; stroke?: number; label?: string; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const style = useMemo(() => ({ '--c': c, '--off': c * (1 - Math.min(Math.max(pct, 0), 100) / 100), width: size, height: size } as CSSProperties), [c, pct, size]);
  return (
    <span className={`dt-ring${pct >= 100 ? ' is-full' : ''}`} style={style} role="img" aria-label={label ?? `${pct}% completado`}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
        <circle className="dt-ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle className="dt-ring-bar" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
      </svg>
      <span className="dt-ring-in" aria-hidden="true">{children ?? `${pct}%`}</span>
    </span>
  );
}
