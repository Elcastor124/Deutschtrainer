import { useRef, useState, type CSSProperties, type PointerEvent as RPE, type ReactNode } from 'react';
import { CHESTS, ITEMS, MAX_INV, checkUse, type UseCtx } from '../../shared/rules.ts';
import type { ChestPub, ItemId, RoomView } from '../../shared/types.ts';
import { markOrigin } from '../fx/origin.ts';
import { sfx } from '../fx/sound.ts';
import type { Ack } from '../net.ts';
import { CHEST_ROWS, DotGlyph, Glyph } from './Glyph.tsx';

export function useCtxFor(view: RoomView): UseCtx | null {
  const me = view.me;
  if (!me) return null;
  const pub = view.players.find((p) => p.id === me.id);
  return {
    phase: view.phase, blockItems: view.blockItems, itemsOn: view.itemsOn, itemsOff: view.itemsOff, q: view.q,
    inventory: me.inventory, used: me.used, state: me.state, shield: !!pub?.shield, wildPending: !!view.wildPending,
    lastQuestion: view.qNo >= view.qTotal, self: me.id,
    rivals: view.players.filter((x) => x.id !== me.id).map((x) => ({
      id: x.id, sabotaged: x.sabotaged, targeted: view.uses.some((u) => u.target === x.id && !!ITEMS[u.item].target),
    })),
  };
}

const KIND_LABEL = { self: 'Potenciador', attack: 'Ataque', defense: 'Defensa', meta: 'Táctica' } as const;
export const itemColor = (item: ItemId) => (item === 'blackcard' || ITEMS[item].kind === 'attack' ? '#FF3832' : '#F2F1EE');

/** Carta de objeto: se inclina siguiendo el puntero, brilla y se gira para ver su reverso. */
export function ItemCard({ item, className = '', children, onClick, flipped, style }: {
  item: ItemId; className?: string; children?: ReactNode; onClick?: (el: HTMLElement) => void; flipped?: boolean; style?: CSSProperties;
}) {
  const d = ITEMS[item];
  const tilt = useRef<HTMLDivElement>(null);
  const move = (e: RPE<HTMLDivElement>) => {
    const el = tilt.current;
    if (!el || e.pointerType === 'touch') return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    el.style.setProperty('--rx', `${(0.5 - y) * 16}deg`);
    el.style.setProperty('--ry', `${(x - 0.5) * 18}deg`);
    el.style.setProperty('--mx', `${x * 100}%`);
    el.style.setProperty('--my', `${y * 100}%`);
  };
  const leave = () => {
    const el = tilt.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  };
  return (
    <div className={`card3d ${item} k-${d.kind}${flipped ? ' flipped' : ''} ${className}`} style={style} onPointerMove={move} onPointerLeave={leave}>
      <div className="tilt" ref={tilt}>
        <div className="inner">
          <button type="button" className="face front" onClick={(e) => onClick?.(e.currentTarget)} aria-label={`${d.name}: ${d.short}. Ver detalles`}>
            <span className="kind">{KIND_LABEL[d.kind]}</span>
            <span className="name">{d.name}</span>
            <Glyph item={item} className="glyph" color={itemColor(item)} />
            <span className="tagline">{d.short}</span>
            <span className="sheen" aria-hidden="true" />
          </button>
          <div className="face back">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** La mano del alumno: hasta 3 cartas en abanico. Tocar = girar la carta y ver cómo usarla. */
export function Inventory({ view, onUse, onChest }: { view: RoomView; onUse: (item: ItemId, target?: string) => Promise<Ack>; onChest?: (c: ChestPub) => void }) {
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const cardEls = useRef<(HTMLElement | null)[]>([]);
  const ctx = useCtxFor(view);
  const me = view.me;
  if (!me || !ctx) return null;
  const rivals = view.players.filter((p) => p.id !== me.id);

  const use = async (i: number, item: ItemId, target?: string) => {
    setBusy(true);
    setMsg(null);
    markOrigin(item, cardEls.current[i]);
    const r = await onUse(item, target);
    setBusy(false);
    if (!r.ok) { setMsg(r.error ?? 'No se pudo usar.'); sfx.bad(); }
    else setOpen(null);
  };
  const reasonFor = (it: ItemId) => ITEMS[it].target
    ? (rivals.some((r) => !checkUse(ctx, it, r.id)) ? null : rivals.length ? checkUse(ctx, it, rivals[0].id) : 'No hay rivales en la sala.')
    : checkUse(ctx, it);

  const n = me.inventory.length;
  // En bloques sin objetos y con la mano vacía no se muestra nada (no hay nada que hacer con ella).
  if (!view.blockItems && !n && !me.chests.length) return null;
  return (
    <section className="hand" aria-label="Tu mano de objetos">
      <div className="hand-head">
        <span>Tu mano</span>
        <span className="slots" aria-label={`${n} de ${MAX_INV}`}>{Array.from({ length: MAX_INV }, (_, i) => <i key={i} className={i < n ? 'on' : ''} />)}</span>
        <span className="spacer" />
        {!view.blockItems ? <span className="note">sin objetos en este bloque</span> : !view.itemsOn ? <span className="note red">pausados por el profesor</span> : null}
      </div>
      <div className={`cards fan n${n}`}>
        {Array.from({ length: MAX_INV }, (_, i) => {
          const item = me.inventory[i];
          if (!item) return <div key={`e${i}`} className="card3d empty" style={{ '--k': i } as CSSProperties}><div className="tilt"><div className="inner"><div className="face">vacío</div></div></div></div>;
          const d = ITEMS[item];
          const why = reasonFor(item);
          return (
            <div key={`${item}-${i}`} ref={(el) => { cardEls.current[i] = el; }} className="slot" style={{ '--k': i } as CSSProperties}>
              <ItemCard item={item} className={`${why ? '' : 'usable'}${open === i ? ' raised' : ''}`} flipped={open === i}
                onClick={() => { sfx.key(); setOpen(open === i ? null : i); setMsg(null); }}>
                <button type="button" className="back-x" onClick={() => setOpen(null)} aria-label="Volver">×</button>
                <span className="name">{d.name}</span>
                <span className="tagline">{d.tag}</span>
                {why ? <small className="why-not">{why}</small> : d.target ? (
                  <div className="targets">
                    {rivals.map((r) => (
                      <button key={r.id} className="btn signal sm use" disabled={busy || !!checkUse(ctx, item, r.id)} onClick={() => use(i, item, r.id)}>
                        Contra {r.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <button className="btn signal sm use" disabled={busy} onClick={() => use(i, item)}>Usar</button>
                )}
              </ItemCard>
            </div>
          );
        })}
      </div>
      {open !== null && me.inventory[open] && (
        <div className="item-detail" aria-live="polite">
          <b>{ITEMS[me.inventory[open]].name}</b> {ITEMS[me.inventory[open]].rule}
        </div>
      )}
      {msg && <p className="err-msg" role="alert">{msg}</p>}
      {me.chests.length > 0 && (
        <div className="chest-tray">
          <span className="tray-label">Cofres sin abrir</span>
          <div className="chest-row">
            {me.chests.map((c, i) => (
              <button key={c.id} type="button" className={`chest-tile t-${c.tier}`} style={{ '--k': i } as CSSProperties}
                onClick={() => { sfx.key(); onChest?.(c); }} aria-label={`Abrir ${CHESTS[c.tier].name}: ${c.reason}`}>
                <DotGlyph rows={CHEST_ROWS} className="cg" color="currentColor" dim="transparent" />
                <span className="ct">{CHESTS[c.tier].de}</span>
                <span className="cr">{c.reason}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
