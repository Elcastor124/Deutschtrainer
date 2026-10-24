import { lazy, Suspense, type ComponentType } from 'react';

type Props = { compact?: boolean };

// El widget lo construye otro módulo (src/components/WeeklyPoints.tsx). import.meta.glob devuelve {}
// si el archivo aún no existe, así el build funciona en ambos casos.
const found = import.meta.glob<{ WeeklyPoints?: ComponentType<Props>; default?: ComponentType<Props> }>('../components/WeeklyPoints.tsx');
const loader = Object.values(found)[0];
const Lazy = loader ? lazy(async () => {
  const m = await loader();
  const C = m.WeeklyPoints ?? m.default;
  return { default: C ?? WeeklyPointsPlaceholder };
}) : null;

export function WeeklyPointsPlaceholder({ compact }: Props) {
  return (
    <div className={`dt-wp-placeholder${compact ? ' compact' : ''}`} role="status">
      <span className="dt-eyebrow">PUNKTE DER WOCHE</span>
      <p>Los puntos de la semana aparecerán aquí cuando practiques.</p>
    </div>
  );
}

/** Hueco para el marcador semanal: carga el widget real si existe, o un marcador neutro. */
export function WeeklyPointsSlot({ compact }: Props) {
  if (!Lazy) return <WeeklyPointsPlaceholder compact={compact} />;
  return <Suspense fallback={<WeeklyPointsPlaceholder compact={compact} />}><Lazy compact={compact} /></Suspense>;
}
