import { useId } from 'react';
import { setEffectsEnabled, useEffectsEnabled, useEffectsReducedMotion } from './effects.ts';
import './ambient-field.css';

/** Shared nav control. A system reduced-motion setting is intentionally not overridable. */
export function EffectsToggle() {
  const enabled = useEffectsEnabled();
  const reduced = useEffectsReducedMotion();
  const description = useId();
  return <span className="dt-effects-control">
    <button
      className="dt-effects-toggle"
      data-effects-toggle
      type="button"
      role="switch"
      aria-label="Efectos visuales"
      aria-checked={enabled}
      aria-describedby={reduced ? description : undefined}
      disabled={reduced}
      title={reduced ? 'Desactivados por movimiento reducido del sistema' : enabled ? 'Pausar efectos visuales' : 'Activar efectos visuales'}
      onClick={() => setEffectsEnabled(!enabled)}
    >
      <span className="dt-effects-toggle-track" aria-hidden="true"><i /></span>
      <span>Efectos: <b>{enabled ? 'sí' : 'no'}</b></span>
      {reduced && <small>sistema</small>}
    </button>
    {reduced && <span id={description} className="dt-effects-description">Movimiento reducido del sistema: los efectos permanecen desactivados.</span>}
  </span>;
}
