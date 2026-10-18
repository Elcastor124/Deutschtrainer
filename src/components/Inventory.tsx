import { useState, type ReactNode } from 'react';
import { ITEMS, MAX_INV, checkUse, type UseCtx } from '../../shared/rules.ts';
import type { ItemId, RoomView } from '../../shared/types.ts';
import type { Ack } from '../net.ts';
import { Glyph } from './Glyph.tsx';

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

export function ItemCard({ item, className = '', children, onClick, flipped }: {
  item: ItemId; className?: string; children?: ReactNode; onClick?: () => void; flipped?: boolean;
}) {
  const d = ITEMS[item];
  return (
    <div className={`card3d ${item}${flipped ? ' flipped' : ''} ${className}`}>
      <div className="inner">
        <button type="button" className="face front" onClick={onClick} aria-label={`${d.name}: ${d.short}. Ver detalles`}>
          <span className="name">{d.name}</span>
          <Glyph item={item} className="glyph" color={item === 'blackcard' ? '#FF3832' : '#F2F1EE'} />
          <span className="tagline">{d.short}</span>
        </button>
        <div className="face back">{children}</div>
      </div>
    </div>
  );
}

export function Inventory({ view, onUse }: { view: RoomView; onUse: (item: ItemId, target?: string) => Promise<Ack> }) {
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const ctx = useCtxFor(view);
  const me = view.me;
  if (!me || !ctx) return null;
  const rivals = view.players.filter((p) => p.id !== me.id);

  const use = async (item: ItemId, target?: string) => {
    setBusy(true);
    setMsg(null);
    const r = await onUse(item, target);
    setBusy(false);
    if (!r.ok) setMsg(r.error ?? 'No se pudo usar.');
    else setOpen(null);
  };

  return (
    <section className="tray" aria-label="Inventario">
      <div className="tray-head">
        <span>Inventario <b className="dot">{me.inventory.length}/{MAX_INV}</b></span>
        {!view.blockItems ? <span>sin objetos en este bloque</span> : !view.itemsOn ? <span className="red">desactivados por el profesor</span> : null}
      </div>
      <div className="cards">
        {Array.from({ length: MAX_INV }, (_, i) => {
          const item = me.inventory[i];
          if (!item) return <div key={`e${i}`} className="card3d empty"><div className="inner"><div className="face">vacío</div></div></div>;
          const d = ITEMS[item];
          const needsTarget = !!d.target;
          const why = !needsTarget ? checkUse(ctx, item)
            : !rivals.length ? 'No hay rivales en la sala.'
            : rivals.some((r) => !checkUse(ctx, item, r.id)) ? null
            : checkUse(ctx, item, rivals[0].id);
          return (
            <ItemCard key={`${item}-${i}`} item={item} className={why ? '' : 'usable'} flipped={open === i} onClick={() => setOpen(open === i ? null : i)}>
              <span className="name">{d.name}</span>
              <span className="tagline">{d.tag}</span>
              {why ? <small className="red">No disponible</small> : needsTarget ? (
                <div className="targets">
                  {rivals.map((r) => (
                    <button key={r.id} className="btn signal sm use" disabled={busy || !!checkUse(ctx, item, r.id)} onClick={() => use(item, r.id)}>
                      Contra {r.name}
                    </button>
                  ))}
                </div>
              ) : (
                <button className="btn signal sm use" disabled={busy} onClick={() => use(item)}>Usar</button>
              )}
              <button className="btn ghost sm" onClick={() => setOpen(null)}>Volver</button>
            </ItemCard>
          );
        })}
      </div>
      {open !== null && me.inventory[open] && (() => {
        const it = me.inventory[open];
        const reason = ITEMS[it].target
          ? (rivals.some((r) => !checkUse(ctx, it, r.id)) ? null : rivals.length ? checkUse(ctx, it, rivals[0].id) : 'No hay rivales en la sala.')
          : checkUse(ctx, it);
        return (
          <div className="item-detail" aria-live="polite">
            <b>{ITEMS[it].name}</b> · {ITEMS[it].rule}
            {reason && <span className="red"> {reason}</span>}
          </div>
        );
      })()}
      {msg && <p className="err-msg" role="alert">{msg}</p>}
    </section>
  );
}
