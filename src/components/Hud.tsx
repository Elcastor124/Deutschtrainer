import type { CSSProperties, ReactNode } from 'react';
import { PLAN } from '../../shared/rules.ts';
import type { BlockId, RoomView } from '../../shared/types.ts';
import type { Conn } from '../net.ts';
import { useTick } from '../util.ts';
import { ConnPill } from './bits.tsx';

/** Barra superior: marca, secuenciador de los 8 bloques (105 min) y estado. */
export function Hud({ view, conn, offset, onBlock, right }: {
  view: RoomView | null; conn: Conn; offset: number; onBlock?: (b: BlockId) => void; right?: ReactNode;
}) {
  useTick(1000, !!view?.blockStartedAt);
  const idx = view?.block ? PLAN.findIndex((b) => b.id === view.block) : -1;
  const elapsed = view?.blockStartedAt ? (Date.now() + offset - view.blockStartedAt) / 60000 : 0;
  const practice = view?.mode === 'practice';
  return (
    <header className="hud">
      <div className="brand"><span className="b-long">DEUTSCH TRAINER</span><span className="b-short">DT</span> <b>// BLACKCARD</b><small>{practice ? 'Práctica' : 'A1–A2'}</small></div>
      {!practice ? (
        <nav className="seq" aria-label="Bloques de la clase">
          {PLAN.map((b, i) => {
            const now = i === idx;
            const cls = `step${i < idx ? ' done' : ''}${now ? ' now' : ''}${now && elapsed > b.min ? ' over' : ''}`;
            const body = (
              <>
                <em>{i + 1}</em> <span>{b.name}</span>
                <span className="dim">{now ? `${Math.floor(elapsed)}/${b.min} min` : `${b.min} min`}</span>
              </>
            );
            const style = now ? ({ '--p': `${Math.min(100, (elapsed / b.min) * 100)}%` } as CSSProperties) : undefined;
            return onBlock ? (
              <button key={b.id} className={cls} style={style} onClick={() => onBlock(b.id)} title={`Ir a: ${b.name}`}>{body}</button>
            ) : (
              <div key={b.id} className={cls} style={style} aria-current={now ? 'step' : undefined}>{body}</div>
            );
          })}
        </nav>
      ) : <div className="hud-spacer" />}
      <div className="hud-right">
        {right}
        <ConnPill conn={conn} />
      </div>
    </header>
  );
}
