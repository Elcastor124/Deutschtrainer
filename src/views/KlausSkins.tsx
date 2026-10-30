// /klaus — Colección de skins de Klaus: lootbox del ganador semanal y elección de la skin propia.
import { useEffect, useState } from 'react';
import { KLAUS_SKINS, RARITY_LABEL, klausSkin, type KlausSkinDef } from '../../shared/klaus-skins.ts';
import { KlausFigure } from '../klaus/KlausFigure.tsx';
import { equipSkin, loadCollection, openLootbox, type KlausCollection } from '../klaus/skin-client.ts';
import { sfx } from '../fx/sound.ts';
import { navigate, studentSession } from '../util.ts';
import '../klaus-skins.css';

const ORDER = { mythic: 0, legendary: 1, epic: 2, rare: 3, common: 4 } as const;

export function KlausSkins() {
  const [c, setC] = useState<KlausCollection | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [phase, setPhase] = useState<'idle' | 'shake' | 'reveal'>('idle');
  const [won, setWon] = useState<KlausSkinDef | null>(null);
  useEffect(() => { void loadCollection().then(setC); }, []);

  if (!studentSession()) {
    return <div className="ks-page"><h1>Tus Klaus</h1>
      <p className="ks-sub">Entra con tu cuenta para ver tu colección de Klaus.</p>
      <div className="row"><a className="btn primary" href="/entrar?volver=/klaus" onClick={(e) => { e.preventDefault(); navigate('/entrar?volver=/klaus'); }}>Iniciar sesión</a></div></div>;
  }
  if (!c) return <div className="ks-page"><p role="status">Cargando tu colección…</p></div>;

  const open = async () => {
    setErr(null); setPhase('shake'); sfx.chestTap(0);
    setTimeout(() => sfx.chestTap(1), 350); setTimeout(() => sfx.chestTap(2), 700);
    try {
      const r = await openLootbox();
      await new Promise((ok) => setTimeout(ok, 1100));
      setC(r); setWon(r.skin ? klausSkin(r.skin) : null); setPhase('reveal');
      const t = r.skin ? klausSkin(r.skin).rarity : 'common';
      sfx.chestOpen(t === 'mythic' ? 'black' : t === 'legendary' ? 'gold' : t === 'epic' ? 'silver' : 'bronze'); if (t === 'legendary' || t === 'mythic') setTimeout(() => sfx.fanfare(), 500);
    } catch (e) { setErr((e as Error).message); setPhase('idle'); }
  };
  const equip = async (id: string) => { try { setC(await equipSkin(id)); sfx.item(); } catch (e) { setErr((e as Error).message); } };
  const list = [...KLAUS_SKINS].sort((a, b) => ORDER[a.rarity] - ORDER[b.rarity]);
  const owned = new Set(c.owned);

  return (
    <div className="ks-page">
      <header className="ks-head">
        <div>
          <h1>Tus Klaus <b>// colección</b></h1>
          <p className="ks-sub">Cada semana, quien queda <b>1.º en el ranking</b> gana una lootbox con un Klaus nuevo. La skin que elijas es solo tuya: te acompaña en la práctica y en el resto de la web.</p>
          <p className="ks-sub small">Tienes {c.owned.length} de {KLAUS_SKINS.length}. Para optar al premio activa el ranking en tu cuenta.</p>
        </div>
        <div className={`ks-box ks-${phase}`}>
          {phase === 'reveal' && won ? (
            <div className={`ks-reveal r-${won.rarity}`}>
              <div className="ks-fig"><KlausFigure reaction="correct" look={won} /></div>
              <b>{won.label}</b><span>{RARITY_LABEL[won.rarity]}</span>
              <div className="row"><button className="btn primary" onClick={() => void equip(won.id)}>Equipar</button><button className="btn ghost" onClick={() => setPhase('idle')}>Cerrar</button></div>
            </div>
          ) : (
            <>
              <div className="ks-crate" aria-hidden="true">🎁</div>
              <b>{c.boxes} lootbox{c.boxes === 1 ? '' : 'es'}</b>
              <button className="btn primary lg" disabled={c.boxes < 1 || phase !== 'idle'} onClick={() => void open()}>{phase === 'shake' ? 'Abriendo…' : 'Abrir lootbox'}</button>
              {c.boxes < 1 && <small>Gana el ranking semanal para conseguir una.</small>}
            </>
          )}
        </div>
      </header>
      {err && <p className="err-msg" role="alert">{err}</p>}
      <ul className="ks-grid">
        {list.map((s) => {
          const has = owned.has(s.id); const on = c.equipped === s.id;
          return <li key={s.id} className={`ks-card r-${s.rarity}${has ? '' : ' locked'}${on ? ' on' : ''}`}>
            <div className="ks-fig">{has ? <KlausFigure look={s} /> : <span className="ks-lock" aria-hidden="true">?</span>}</div>
            <b>{has ? s.label : '???'}</b><span>{RARITY_LABEL[s.rarity]}</span>
            {has && <button className={`btn sm${on ? ' on' : ''}`} disabled={on} onClick={() => void equip(s.id)}>{on ? 'Equipada' : 'Equipar'}</button>}
          </li>;
        })}
      </ul>
    </div>
  );
}
