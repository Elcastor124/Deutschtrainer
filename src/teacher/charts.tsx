// Gráficos de Teacher OS (SVG propio, tokens de la marca). Regla de oro: cada barra o punto lleva su n; por debajo del mínimo
// se dibuja rayado y se rotula «datos insuficientes», para que nadie lea un 100 % de 3 respuestas como una conclusión.
import type { Agg } from './api.ts';

const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)} %`);

/** Barras horizontales de precisión con su n. */
export function AccuracyBars({ rows, minN, label, names }: { rows: Agg[]; minN: number; label: string; names?: (k: string) => string }) {
  if (!rows.some((r) => r.n > 0)) return <p className="tos-empty-inline">Sin respuestas en este filtro.</p>;
  return (
    <ul className="tos-bars" aria-label={label}>
      {rows.map((r) => {
        const weak = r.n < minN;
        return (
          <li key={r.key} className={weak ? 'is-weak' : ''} title={weak ? `Solo ${r.n} respuestas: datos insuficientes para concluir nada` : `${r.correct} de ${r.n} correctas`}>
            <span className="tos-bar-label">{names ? names(r.key) : r.key}</span>
            <span className="tos-bar-track"><i style={{ width: `${r.accuracy === null ? 0 : Math.round(r.accuracy * 100)}%` }} /></span>
            <span className="tos-bar-val">{r.n ? pct(r.accuracy) : '—'}</span>
            <span className="tos-bar-n">n={r.n}{weak && r.n > 0 ? ' · insuf.' : ''}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Evolución semanal: columnas = respuestas (volumen); línea = precisión (solo en semanas con datos suficientes, el resto punteado). */
export function TrendChart({ points, minN, label }: { points: { week: string; n: number; accuracy: number | null }[]; minN: number; label: string }) {
  const W = 640, H = 200, P = 28;
  if (!points.some((p) => p.n > 0)) return <div className="tos-empty-chart"><b>Aún no hay actividad</b><span>La evolución aparecerá cuando haya respuestas reales.</span></div>;
  const maxN = Math.max(1, ...points.map((p) => p.n));
  const x = (i: number) => P + (i * (W - 2 * P)) / Math.max(1, points.length - 1);
  const y = (a: number) => H - P - a * (H - 2 * P);
  const bw = Math.max(6, (W - 2 * P) / points.length * 0.5);
  const solid = points.map((p, i) => ({ p, i })).filter(({ p }) => p.accuracy !== null && p.n >= minN);
  const all = points.map((p, i) => ({ p, i })).filter(({ p }) => p.accuracy !== null);
  const path = (list: typeof all) => list.map(({ p, i }, k) => `${k ? 'L' : 'M'}${x(i)},${y(p.accuracy!)}`).join(' ');
  return (
    <figure className="tos-trend">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {[0, 0.5, 1].map((g) => <g key={g}><line x1={P} x2={W - P} y1={y(g)} y2={y(g)} className="tos-grid" /><text x={4} y={y(g) + 4} className="tos-axis">{g * 100}%</text></g>)}
        {points.map((p, i) => <rect key={p.week} x={x(i) - bw / 2} y={H - P - (p.n / maxN) * (H - 2 * P) * 0.6} width={bw} height={(p.n / maxN) * (H - 2 * P) * 0.6} rx={3} className={p.n < minN ? 'tos-col weak' : 'tos-col'}><title>{`${p.week}: ${p.n} respuestas · ${pct(p.accuracy)}`}</title></rect>)}
        {all.length > 1 && <path d={path(all)} className="tos-line dashed" />}
        {solid.length > 1 && <path d={path(solid)} className="tos-line" />}
        {all.map(({ p, i }) => <circle key={p.week} cx={x(i)} cy={y(p.accuracy!)} r={p.n >= minN ? 4.5 : 3} className={p.n >= minN ? 'tos-dot' : 'tos-dot weak'}><title>{`${p.week}: ${pct(p.accuracy)} (n=${p.n})`}</title></circle>)}
        {points.map((p, i) => (i % 2 === points.length % 2 || points.length < 9) && <text key={p.week} x={x(i)} y={H - 6} textAnchor="middle" className="tos-axis">{p.week.slice(-3)}</text>)}
      </svg>
      <figcaption><span className="tos-key col" /> respuestas por semana <span className="tos-key line" /> precisión (punteada si n &lt; {minN})</figcaption>
    </figure>
  );
}

/** Mini barras por dificultad dentro de un tema: distingue 5 fáciles de 100 de A2. */
export function DiffStack({ byDiff }: { byDiff: Agg[] }) {
  const names: Record<string, string> = { easy: 'fácil', medium: 'media', hard: 'difícil', special: 'examen', desconocida: '¿?' };
  return <span className="tos-diffs">{byDiff.filter((d) => d.n > 0).map((d) => <span key={d.key} title={`${names[d.key] ?? d.key}: ${d.correct}/${d.n}`}><b>{names[d.key] ?? d.key}</b> {pct(d.accuracy)} <small>n={d.n}</small></span>)}</span>;
}
