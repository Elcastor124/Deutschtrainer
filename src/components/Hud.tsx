import type { CSSProperties, ReactNode } from 'react';
import { PLAN, type BlockDef } from '../../shared/rules.ts';
import type { BlockId, RoomView } from '../../shared/types.ts';
import type { Conn } from '../net.ts';
import { useTick } from '../util.ts';
import { ConnPill } from './bits.tsx';

/** Barra superior: marca, secuenciador de bloques en dos actos (el juego · después del juego) y estado. */
export function Hud({ view, conn, offset, onBlock, right }: {
  view: RoomView | null; conn: Conn; offset: number; onBlock?: (b: BlockId) => void; right?: ReactNode;
}) {
  useTick(1000, !!view?.blockStartedAt);
  const idx = view?.block ? PLAN.findIndex((b) => b.id === view.block) : -1;
  const elapsed = view?.blockStartedAt ? (Date.now() + offset - view.blockStartedAt) / 60000 : 0;
  const practice = view?.mode === 'practice';
  const pad = (b: BlockDef) => {
    const i = PLAN.indexOf(b);
    const now = i === idx;
    const cls = `pad${i < idx ? ' done' : ''}${now ? ' now' : ''}${now && elapsed > b.min ? ' over' : ''}`;
    const body = (
      <>
        <i className="led" aria-hidden="true" />
        <em>{i + 1}</em>
        <span className="nm">{b.name}</span>
        <span className="tm">{now ? `${Math.floor(elapsed)}/${b.min}′` : `${b.min}′`}</span>
      </>
    );
    const style = now ? ({ '--p': `${Math.min(100, (elapsed / b.min) * 100)}%` } as CSSProperties) : undefined;
    return onBlock ? (
      <button key={b.id} type="button" className={cls} style={style} onClick={() => onBlock(b.id)} title={`Ir a: ${b.name} (${b.min} min)`}>{body}</button>
    ) : (
      <div key={b.id} className={cls} style={style} aria-current={now ? 'step' : undefined} title={`${b.name} · ${b.min} min`}>{body}</div>
    );
  };
  return (
    <header className="hud">
      <div className="brand" aria-label="Deutsch Trainer, BlackCard Edition">
        <span className="b-long">DEUTSCH TRAINER</span><span className="b-short">DT</span><b>//&nbsp;BLACKCARD</b>
        <small>{practice ? 'Üben' : 'A1–A2'}</small>
      </div>
      {!practice ? (
        <nav className="seq" aria-label="Bloques de la clase">
          <div className="act" data-act="I" title="Acto I · el juego">{PLAN.filter((b) => b.act === 1).map(pad)}</div>
          <div className="act" data-act="II" title="Acto II · después del juego">{PLAN.filter((b) => b.act === 2).map(pad)}</div>
        </nav>
      ) : <div className="hud-spacer" />}
      <div className="hud-right">
        {right}
        <ConnPill conn={conn} />
      </div>
    </header>
  );
}
