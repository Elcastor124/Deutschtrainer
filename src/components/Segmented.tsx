// Control segmentado accesible (radiogroup con flechas) e indicador deslizante. Estilos en design/motion.css.
import type { CSSProperties, KeyboardEvent } from 'react';

export interface SegOption<T extends string | number> { id: T; label: string; tag?: string; disabled?: boolean; title?: string }

export function Segmented<T extends string | number>({ options, value, onChange, label, wide, className = '' }: {
  options: readonly SegOption<T>[]; value: T; onChange: (v: T) => void; label: string; wide?: boolean; className?: string;
}) {
  const idx = Math.max(0, options.findIndex((o) => o.id === value));
  const move = (e: KeyboardEvent<HTMLDivElement>) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    for (let k = 1; k < options.length; k++) {
      const j = (((idx + dir * k) % options.length) + options.length) % options.length;
      if (options[j].disabled) continue;
      onChange(options[j].id);
      e.currentTarget.querySelectorAll<HTMLButtonElement>('[role=radio]')[j]?.focus();
      return;
    }
  };
  return (
    <div className={`seg${wide ? ' wide' : ''} ${className}`.trim()} role="radiogroup" aria-label={label} onKeyDown={move}>
      <div className="seg-track" style={{ '--seg-i': idx, '--seg-n': options.length } as CSSProperties}>
        <i className="seg-ind" aria-hidden="true" />
        {options.map((o) => (
          <button key={String(o.id)} type="button" role="radio" className="seg-opt" aria-checked={o.id === value} disabled={o.disabled} title={o.title}
            tabIndex={o.id === value ? 0 : -1} onClick={() => onChange(o.id)}>
            <span>{o.label}</span>{o.tag && <small>{o.tag}</small>}
          </button>
        ))}
      </div>
    </div>
  );
}
