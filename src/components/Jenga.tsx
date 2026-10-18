import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPE } from 'react';
import { VOCAB, isNoun } from '../../shared/vocab.ts';

/** Último piso del que se puede sacar (misma regla que el servidor). */
export function maxPullLevel(levels: number[][]): number {
  const top = levels.length - 1;
  const full = levels[top].reduce((a, b) => a + b, 0) === 3;
  return full ? top - 1 : top - 2;
}

const WORDS = VOCAB.filter((v) => isNoun(v.de)).map((v) => v.de);
const wordFor = (l: number, s: number) => WORDS[(l * 7 + s * 13 + 5) % WORDS.length];

/**
 * Torre de Jenga en CSS 3D. Los pisos pares van a lo ancho y los impares a lo largo.
 * Se gira arrastrando. Si «canPull», las piezas permitidas se pueden tocar.
 */
export function Tower({ levels, canPull, onPull, fallen, risk, lastPull, big }: {
  levels: number[][]; canPull: boolean; onPull?: (level: number, slot: number) => void; fallen: boolean; risk: number;
  lastPull: { level: number; slot: number; by: string } | null; big?: boolean;
}) {
  const [yaw, setYaw] = useState(35);
  const drag = useRef<{ x: number; yaw: number } | null>(null);
  const maxL = maxPullLevel(levels);
  const prevKey = useRef<string>('');
  const [ghost, setGhost] = useState<{ level: number; slot: number; k: number } | null>(null);
  const [dropKey, setDropKey] = useState(0);

  // Pieza recién sacada: se dibuja una copia que se desliza fuera y la nueva cae arriba.
  const pullKey = lastPull ? `${lastPull.level}-${lastPull.slot}-${levels.length}-${levels[levels.length - 1].join('')}` : '';
  useEffect(() => {
    if (!lastPull || pullKey === prevKey.current) return;
    const first = prevKey.current === '';
    prevKey.current = pullKey;
    if (first) return;
    setGhost({ level: lastPull.level, slot: lastPull.slot, k: Date.now() });
    setDropKey((x) => x + 1);
    const t = setTimeout(() => setGhost(null), 900);
    return () => clearTimeout(t);
  }, [pullKey]);

  // Caída: cada pieza sale con una trayectoria propia.
  const chaos = useMemo(() => levels.map((l, i) => l.map((_, s) => ({
    x: ((i * 37 + s * 91) % 17 - 8) * 1.1, z: ((i * 53 + s * 29) % 13 - 6) * 1.2, r: ((i * 71 + s * 43) % 180) - 90, d: (levels.length - i) * 18 + s * 30,
  }))), [levels.length]);

  const down = (e: RPE<HTMLDivElement>) => { drag.current = { x: e.clientX, yaw }; };
  const move = (e: RPE<HTMLDivElement>) => { if (drag.current && e.buttons) setYaw(drag.current.yaw + (e.clientX - drag.current.x) * 0.4); };
  const up = () => { drag.current = null; };

  const top = levels.length - 1;
  const newest = levels[top].lastIndexOf(1);
  const block = (l: number, s: number, extra = '', style: CSSProperties = {}) => {
    const can = canPull && !fallen && l <= maxL && !!levels[l][s];
    const c = chaos[l]?.[s] ?? { x: 0, z: 0, r: 0, d: 0 };
    const odd = l % 2 === 1;
    const word = wordFor(l, s);
    return (
      <div key={`${l}-${s}${extra}`} className={`blk${odd ? ' odd' : ''}${can ? ' can' : ''}${l > maxL ? ' locked' : ''}${extra}`}
        style={{ '--l': l, '--s': s - 1, '--cx': c.x, '--cz': c.z, '--cr': `${c.r}deg`, '--cd': `${c.d}ms`, ...style } as CSSProperties}
        role={can ? 'button' : undefined} tabIndex={can ? 0 : -1} aria-label={can ? `Sacar pieza: piso ${l + 1}, posición ${s + 1}` : undefined}
        onClick={can ? (e) => { e.stopPropagation(); onPull?.(l, s); } : undefined}
        onKeyDown={can ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPull?.(l, s); } } : undefined}>
        <i className="f top" /><i className="f front"><span>{word}</span></i><i className="f back"><span>{word}</span></i><i className="f left" /><i className="f right" />
      </div>
    );
  };
  return (
    <div className={`tower-view${big ? ' big' : ''}${fallen ? ' fallen' : ''}${canPull ? ' armed' : ''}`} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
      style={{ '--levels': levels.length, '--wob': `${Math.min(3, risk * 9)}deg` } as CSSProperties}>
      <div className={`tower${risk > 0 && !fallen ? ' wobble' : ''}`} style={{ '--yaw': `${yaw}deg` } as CSSProperties}>
        <div className="floor" aria-hidden="true" />
        {levels.flatMap((l, i) => l.map((on, s) => (on ? block(i, s, i === top && s === newest && dropKey ? ` drop d${dropKey % 2}` : '') : null)))}
        {ghost && block(ghost.level, ghost.slot, ' ghost', { '--dir': ghost.slot === 0 ? -1 : 1 } as CSSProperties)}
      </div>
      <div className="tower-rot" aria-hidden="true">⟲ arrastra para girar</div>
    </div>
  );
}
