// /klaus — Colección de skins de Klaus: lootbox del ganador semanal y elección de la skin propia.
import { useEffect, useState, type CSSProperties } from 'react';
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
  const [focusId, setFocusId] = useState<string | null>(null);
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
  const equip = async (id: string) => { try { setC(await equipSkin(id)); setFocusId(id); sfx.item(); } catch (e) { setErr((e as Error).message); } };
  const owned = new Set(c.owned);
  const eq = klausSkin(c.equipped);
  const sel = focusId && owned.has(focusId) ? klausSkin(focusId) : eq;
  const tiers = (Object.keys(ORDER) as (keyof typeof ORDER)[]).map((r) => ({ r, skins: KLAUS_SKINS.filter((s) => s.rarity === r) }));
  const pct = Math.round((c.owned.length / KLAUS_SKINS.length) * 100);

  return (
    <div className="ks-page">
      <header className="ks-top" data-m="rise">
        <div className="ks-intro">
          <p className="m-label"><i>Sammlung</i>Tus Klaus</p>
          <h1>Colección<b className="dt-punkt">.</b></h1>
          <p className="ks-sub">Quien queda <b>1.º en el ranking semanal</b> gana una lootbox con un Klaus nuevo. El que elijas te acompaña en la práctica y en el resto de la web.</p>
          <div className="ks-meter" role="img" aria-label={`Tienes ${c.owned.length} de ${KLAUS_SKINS.length}`}>
            <span className="ks-meter-n"><b>{c.owned.length}</b>/{KLAUS_SKINS.length}</span>
            <span className="ks-meter-bar"><i style={{ width: `${Math.max(pct, 2)}%` }} /></span>
          </div>
        </div>
        {/* Escaparate: la skin elegida, grande y animada (una sola figura viva en la página). */}
        <section className={`ks-stage r-${sel.rarity}`} aria-label={`Klaus ${sel.label}`}>
          <div className="ks-stage-fig"><KlausFigure key={sel.id} reaction={phase === 'reveal' ? 'correct' : 'idle'} look={sel} /></div>
          <div className="ks-stage-cap">
            <span className="ks-tier">{RARITY_LABEL[sel.rarity]}</span>
            <b>{sel.label}</b>
            {sel.id === c.equipped
              ? <span className="ks-on-tag">Equipado</span>
              : <button className="btn primary sm" onClick={() => void equip(sel.id)}>Equipar</button>}
          </div>
        </section>
        <div className={`ks-box ks-${phase}`}>
          {phase === 'reveal' && won ? (
            <div className={`ks-reveal r-${won.rarity}`}>
              <div className="ks-fig"><KlausFigure reaction="correct" look={won} /></div>
              <b>{won.label}</b><span>{RARITY_LABEL[won.rarity]}</span>
              <div className="row"><button className="btn primary" onClick={() => void equip(won.id)}>Equipar</button><button className="btn ghost" onClick={() => setPhase('idle')}>Cerrar</button></div>
            </div>
          ) : (
            <>
              <svg className="ks-crate" viewBox="0 0 64 64" aria-hidden="true"><rect x="8" y="26" width="48" height="30" rx="4" /><rect x="5" y="17" width="54" height="11" rx="3" /><path d="M32 17v39" /><path d="M32 17c-6-10-16-8-14-2 1 3 8 3 14 2zm0 0c6-10 16-8 14-2-1 3-8 3-14 2z" /></svg>
              <b>{c.boxes} lootbox{c.boxes === 1 ? '' : 'es'}</b>
              <button className="btn primary" disabled={c.boxes < 1 || phase !== 'idle'} onClick={() => void open()}>{phase === 'shake' ? 'Abriendo…' : 'Abrir lootbox'}</button>
              {c.boxes < 1 && <small>Gana el ranking semanal para conseguir una.</small>}
            </>
          )}
        </div>
      </header>
      {err && <p className="err-msg" role="alert">{err}</p>}
      {tiers.map(({ r, skins }) => {
        const have = skins.filter((s) => owned.has(s.id)).length;
        return (
          <section key={r} className={`ks-tier-sec r-${r}`} aria-labelledby={`ks-t-${r}`}>
            <h2 id={`ks-t-${r}`} className="ks-tier-h"><span>{RARITY_LABEL[r]}</span><small>{have}/{skins.length}</small></h2>
            <ul className="ks-grid">
              {skins.map((s) => {
                const has = owned.has(s.id); const on = c.equipped === s.id; const isSel = sel.id === s.id;
                return <li key={s.id} className={`ks-card r-${s.rarity}${has ? '' : ' locked'}${on ? ' on' : ''}${isSel ? ' sel' : ''}`}>
                  {has
                    ? <button type="button" className="ks-pick" aria-pressed={isSel} aria-label={`Ver ${s.label}${on ? ' (equipado)' : ''}`} onClick={() => setFocusId(s.id)}>
                      <span className="ks-fig"><KlausFigure look={s} still /></span>
                      <b>{s.label}</b>{on && <span className="ks-dot" aria-hidden="true" />}
                    </button>
                    : <div className="ks-pick" aria-label={`${RARITY_LABEL[s.rarity]} sin desbloquear`}>
                      <span className="ks-fig"><span className="ks-lock" aria-hidden="true" style={{ '--a': s.accent } as CSSProperties} /></span>
                      <b>???</b>
                    </div>}
                </li>;
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
