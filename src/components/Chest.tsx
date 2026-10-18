import { useEffect, useRef, useState } from 'react';
import { CHESTS, ITEMS } from '../../shared/rules.ts';
import type { ChestPub, Fx, RoomView } from '../../shared/types.ts';
import { flash, ring, shake, sleep } from '../fx/juice.ts';
import { burst } from '../fx/particles.ts';
import { sfx } from '../fx/sound.ts';
import type { Ack } from '../net.ts';
import { CHEST_ROWS, DotGlyph } from './Glyph.tsx';
import { ItemCard } from './Inventory.tsx';

const TIER_COLOR = { bronze: '#B9763F', silver: '#CFCFCB', gold: '#E9B949', black: '#FF3832' } as const;
const TAPS = 3;
const LID = CHEST_ROWS.slice(0, 4);
const BASE = CHEST_ROWS.slice(3);

/**
 * Abrir un cofre: tres golpes (anticipación local, sin datos) y después el servidor decide.
 * Lo que sale se muestra solo cuando llega del servidor (registro «chest-open»).
 */
export function ChestOpener({ chest, view, onOpen, onClose }: { chest: ChestPub; view: RoomView; onOpen: () => Promise<Ack>; onClose: () => void }) {
  const [taps, setTaps] = useState(0);
  const [stage, setStage] = useState<'closed' | 'waiting' | 'open'>('closed');
  const [err, setErr] = useState<string | null>(null);
  const [prize, setPrize] = useState<Fx | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const since = useRef<number>(view.log.length ? view.log[view.log.length - 1].id : 0);
  const me = view.me?.id;
  const color = TIER_COLOR[chest.tier];

  // El contenido llega con el registro del servidor.
  useEffect(() => {
    if (stage !== 'waiting' || prize) return;
    const f = [...view.log].reverse().find((x) => x.kind === 'chest-open' && x.by === me && x.id > since.current);
    if (f) setPrize(f);
  }, [view.log, stage, prize, me]);

  useEffect(() => {
    if (!prize) return;
    (async () => {
      const el = box.current;
      sfx.chestOpen(chest.tier);
      flash(chest.tier === 'black' ? 'red' : chest.tier === 'gold' ? 'gold' : 'white', 520);
      ring(el, color, 700);
      shake(1.2);
      const r = el?.getBoundingClientRect();
      if (r) {
        burst(r.left + r.width / 2, r.top + r.height * 0.35, 'pixel', 70, { colors: [color, '#F2F1EE'] });
        if (prize.amount) burst(r.left + r.width / 2, r.top + r.height * 0.3, 'coin', 26);
      }
      await sleep(200);
      setStage('open');
    })();
  }, [prize]);

  const tap = async () => {
    if (stage !== 'closed') return;
    const n = taps + 1;
    setTaps(n);
    sfx.chestTap(n - 1);
    const el = box.current;
    el?.animate([{ transform: 'rotate(0)' }, { transform: `rotate(${n % 2 ? -7 : 7}deg) scale(${1 + n * 0.04})` }, { transform: 'rotate(0)' }], { duration: 260, easing: 'cubic-bezier(.3,1.6,.5,1)' });
    const r = el?.getBoundingClientRect();
    if (r) burst(r.left + r.width / 2, r.top + r.height / 2, 'pixel', 10 + n * 8, { colors: [color, '#F2F1EE'], speed: 0.6 + n * 0.2 });
    if (n < TAPS) return;
    setStage('waiting');
    setErr(null);
    const res = await onOpen();
    if (!res.ok) {
      setErr(res.error ?? 'No se ha podido abrir.');
      setStage('closed');
      setTaps(0);
    }
  };

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && stage !== 'waiting') { e.preventDefault(); onClose(); }
      else if ((e.key === ' ' || e.key === 'Enter') && stage === 'closed') { e.preventDefault(); void tap(); }
      else if ((e.key === ' ' || e.key === 'Enter') && stage === 'open') { e.preventDefault(); onClose(); }
    };
    addEventListener('keydown', on);
    return () => removeEventListener('keydown', on);
  });

  const item = prize?.item;
  return (
    <div className={`ovl chest-ovl t-${chest.tier}`} role="dialog" aria-modal="true" aria-label={CHESTS[chest.tier].name}>
      <div className="chest-stage">
        <p className="chest-title"><b>{CHESTS[chest.tier].de}</b><span>{CHESTS[chest.tier].name} · {chest.reason}</span></p>
        {stage !== 'open' ? (
          <>
            <div ref={box} className={`chest-big t-${chest.tier}${stage === 'waiting' ? ' waiting' : ''}`} onClick={tap} role="button" tabIndex={0}
              aria-label={`Golpea el cofre (${TAPS - taps} golpes)`} style={{ color }}>
              <span className="halo" aria-hidden="true" />
              <DotGlyph rows={LID} className="lid" color="currentColor" dim="transparent" />
              <DotGlyph rows={BASE} className="base" color="currentColor" dim="transparent" />
              {Array.from({ length: taps }, (_, i) => <span key={i} className={`crack c${i}`} aria-hidden="true" />)}
            </div>
            <div className="tap-meter" aria-hidden="true">{Array.from({ length: TAPS }, (_, i) => <i key={i} className={i < taps ? 'on' : ''} />)}</div>
            <p className="chest-help">{stage === 'waiting' ? 'Abriendo…' : taps === 0 ? 'Golpea el cofre 3 veces para abrirlo' : `${TAPS - taps} más…`}</p>
          </>
        ) : item ? (
          <div className="prize">
            <ItemCard item={item} className="prize-card" />
            <p className="prize-name"><b>{ITEMS[item].name}</b>{prize?.amount ? <span className="coins">+{prize.amount} puntos</span> : null}</p>
            <p className="prize-rule">{ITEMS[item].rule}</p>
            <button className="btn primary lg" autoFocus onClick={onClose}>A la mano <kbd>Enter</kbd></button>
          </div>
        ) : null}
        {err && <p className="err-msg" role="alert">{err}</p>}
        {stage === 'closed' && <button className="btn ghost sm chest-later" onClick={onClose}>Abrir más tarde</button>}
      </div>
    </div>
  );
}
