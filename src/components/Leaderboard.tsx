import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import type { PlayerPub } from '../../shared/types.ts';
import { Counter } from './bits.tsx';
import { CHEST_ROWS, DotGlyph, Glyph, STAR_ROWS } from './Glyph.tsx';

const SEG = 24;

/** Ranking con animación FLIP al adelantar, medidor segmentado y estado de cada jugador. */
export function Leaderboard({ players, me, compact, stars, items = true }: { players: PlayerPub[]; me?: string; compact?: boolean; stars?: boolean; items?: boolean }) {
  const refs = useRef(new Map<string, HTMLDivElement>());
  const prev = useRef(new Map<string, number>());
  const order = players.map((p) => p.id).join(',');
  useLayoutEffect(() => {
    const next = new Map<string, number>();
    for (const [id, el] of refs.current) {
      const top = el.getBoundingClientRect().top;
      next.set(id, top);
      const before = prev.current.get(id);
      if (before !== undefined && Math.abs(before - top) > 2) {
        const up = before > top;
        el.animate([{ transform: `translateY(${before - top}px) scale(${up ? 1.04 : 0.98})` }, { transform: 'none' }], { duration: 700, easing: 'cubic-bezier(.2,.8,.2,1)' });
        if (up) { el.classList.remove('overtake'); void el.offsetWidth; el.classList.add('overtake'); }
      }
    }
    prev.current = next;
  }, [order]);
  const ref = (id: string) => (el: HTMLDivElement | null) => { if (el) refs.current.set(id, el); else refs.current.delete(id); };
  const value = (p: PlayerPub) => (stars ? p.stars : p.score);
  const max = Math.max(1, ...players.map(value));
  if (compact) {
    return (
      <div className="mini-lb">
        {players.map((p, i) => (
          <div key={p.id} ref={ref(p.id)} data-lb={p.id} className={`r${p.id === me ? ' me' : ''}${p.connected ? '' : ' off'}`}>
            <span className="pos">{i + 1}</span>
            <span className="nm">{p.name}</span>
            <span className="icons">
              {p.shield && <Glyph item="shield" className="ico" color="#F2F1EE" dim="transparent" />}
              {p.sabotaged && <Glyph item="sabotage" className="ico" color="#FF3832" dim="transparent" />}
              {p.chests > 0 && <DotGlyph rows={CHEST_ROWS} className="ico chest-ico" color="#CFCFCB" dim="transparent" />}
            </span>
            <Counter className="sc" value={value(p)} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="lb">
      {players.map((p, i) => {
        const lit = Math.round((value(p) / max) * SEG);
        return (
          <div key={p.id} ref={ref(p.id)} data-lb={p.id} className={`r${p.connected ? '' : ' off'}${i === 0 && value(p) > 0 ? ' lead' : ''}`} style={{ '--i': i } as CSSProperties}>
            <span className="pos">{i + 1}</span>
            <span className="nm">
              <b>{p.name}</b>
              <small>
                {p.streak >= 2 && <span className="tagx streak">racha ×{p.streak}</span>}
                {p.shield && <span className="tagx"><Glyph item="shield" className="ico" color="#F2F1EE" dim="transparent" />escudo</span>}
                {p.sabotaged && <span className="tagx red"><Glyph item="sabotage" className="ico" color="#FF3832" dim="transparent" />saboteado</span>}
                {!stars && items && <span className="tagx">{p.items} en mano</span>}
                {p.chests > 0 && <span className="tagx"><DotGlyph rows={CHEST_ROWS} className="ico" color="#CFCFCB" dim="transparent" />{p.chests}</span>}
                {!stars && p.stars > 0 && <span className="tagx"><DotGlyph rows={STAR_ROWS} className="ico" color="#E9B949" dim="transparent" />{p.stars}</span>}
                {!p.connected && <span className="tagx red">desconectado</span>}
              </small>
            </span>
            <Counter className="sc" value={value(p)} />
            <span className="meter" aria-hidden="true">{Array.from({ length: SEG }, (_, k) => <i key={k} className={k < lit ? 'on' : ''} />)}</span>
          </div>
        );
      })}
      {!players.length && <p className="empty">Todavía no hay nadie en la sala.</p>}
    </div>
  );
}
