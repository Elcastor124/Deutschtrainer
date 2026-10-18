import { useLayoutEffect, useRef } from 'react';
import type { PlayerPub } from '../../shared/types.ts';
import { Counter } from './bits.tsx';

/** Ranking con animación FLIP al cambiar de posición y medidor de puntos. */
export function Leaderboard({ players, me, compact }: { players: PlayerPub[]; me?: string; compact?: boolean }) {
  const refs = useRef(new Map<string, HTMLDivElement>());
  const prev = useRef(new Map<string, number>());
  const order = players.map((p) => p.id).join(',');
  useLayoutEffect(() => {
    const next = new Map<string, number>();
    for (const [id, el] of refs.current) {
      const top = el.getBoundingClientRect().top;
      next.set(id, top);
      const before = prev.current.get(id);
      if (before !== undefined && before !== top) {
        el.animate([{ transform: `translateY(${before - top}px)` }, { transform: 'none' }], { duration: 650, easing: 'cubic-bezier(.2,.8,.2,1)' });
      }
    }
    prev.current = next;
  }, [order]);
  const max = Math.max(1, ...players.map((p) => p.score));
  if (compact) {
    return (
      <div className="mini-lb">
        {players.map((p, i) => (
          <div key={p.id} ref={(el) => { if (el) refs.current.set(p.id, el); else refs.current.delete(p.id); }} className={`r${p.id === me ? ' me' : ''}`}>
            <span className="pos">{i + 1}</span>
            <span>{p.name}{p.shield ? ' 🛡' : ''}{!p.connected ? ' · desconectado' : ''}</span>
            <Counter className="sc" value={p.score} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="lb">
      {players.map((p, i) => (
        <div key={p.id} ref={(el) => { if (el) refs.current.set(p.id, el); else refs.current.delete(p.id); }} className={`r${p.connected ? '' : ' off'}`}>
          <span className="pos">{i + 1}</span>
          <span className="nm">
            <b>{p.name}</b>
            <small>
              {p.streak >= 2 && <span>racha ×{p.streak}</span>}
              {p.shield && <span>🛡 escudo</span>}
              {p.sabotaged && <span className="red">saboteado</span>}
              <span>{p.items} obj.</span>
              {!p.connected && <span className="red">desconectado</span>}
            </small>
          </span>
          <Counter className="sc" value={p.score} />
          <i className="meter" style={{ width: `${(p.score / max) * 100}%` }} />
        </div>
      ))}
      {!players.length && <p className="dim">Todavía no hay alumnos en la sala.</p>}
    </div>
  );
}
