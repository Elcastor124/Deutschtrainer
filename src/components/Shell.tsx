import { useEffect, useRef, useState, type ReactNode } from 'react';
import { blockDef } from '../../shared/rules.ts';
import type { BlockId } from '../../shared/types.ts';
import { FxLayer } from '../fx/FxLayer.tsx';
import { setLite as setParticlesLite } from '../fx/particles.ts';
import { setSound } from '../fx/sound.ts';
import type { NetState } from '../net.ts';
import { isTyping, prefersReducedMotion, useSetting } from '../util.ts';
import { Hud } from './Hud.tsx';
import { Dictionary, KeysHelp, Scoreboard } from './Overlays.tsx';

export function Shell({ st, me, teacher, onBlock, onKey, hudExtra, children }: {
  st: NetState; me?: string; teacher?: boolean; onBlock?: (b: BlockId) => void;
  onKey?: (e: KeyboardEvent) => void; hudExtra?: ReactNode; children: ReactNode;
}) {
  const [lite, setLite] = useSetting('bc:lite', prefersReducedMotion());
  const [snd, setSnd] = useSetting(teacher ? 'bc:sound-t' : 'bc:sound', !!teacher);
  const [ov, setOv] = useState<'dict' | 'score' | 'help' | null>(null);
  const keyRef = useRef(onKey);
  keyRef.current = onKey;
  const v = st.view;

  useEffect(() => { document.documentElement.dataset.lite = lite ? '1' : '0'; setParticlesLite(lite); }, [lite]);
  useEffect(() => setSound(snd), [snd]);
  useEffect(() => {
    const def = blockDef(v?.block ?? null);
    document.body.dataset.theme = v?.phase === 'final' ? 'final' : def?.theme ?? '';
    const live = !!v && (v.phase === 'question' || v.phase === 'review');
    const bcOn = live && (teacher ? v.uses.some((u) => u.item === 'blackcard') : v.me?.used === 'blackcard');
    document.body.dataset.bc = bcOn ? 'on' : 'off';
  }, [v, teacher]);
  useEffect(() => () => { document.body.dataset.theme = ''; document.body.dataset.bc = 'off'; }, []);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOv(null); return; }
      if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'd') setOv((o) => (o === 'dict' ? null : 'dict'));
      else if (k === 'p') setOv((o) => (o === 'score' ? null : 'score'));
      else if (k === '?') setOv((o) => (o === 'help' ? null : 'help'));
      else if (k === 'l') setLite(!lite);
      else if (k === 'm') setSnd(!snd);
      else if (k === 'f') { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.(); }
      else if (!ov) keyRef.current?.(e);
    };
    addEventListener('keydown', on);
    return () => removeEventListener('keydown', on);
  }, [lite, snd, ov]);

  const dictLocked = !teacher && v?.phase === 'question';
  const extra = (
    <>
      {hudExtra}
      <button className="btn ghost sm" onClick={() => setOv('dict')} title="Diccionario (D)" aria-label="Diccionario"><span className="lbl">Diccionario </span><kbd>D</kbd></button>
      <button className="btn ghost sm" onClick={() => setOv('score')} title="Marcador (P)" aria-label="Marcador"><span className="lbl">Marcador </span><kbd>P</kbd></button>
      <button className={`btn ghost sm opt-tool${lite ? ' on' : ''}`} onClick={() => setLite(!lite)} title="Modo ligero (L)">{lite ? 'Ligero' : 'Efectos'}</button>
      <button className={`btn ghost sm opt-tool${snd ? '' : ' on'}`} onClick={() => setSnd(!snd)} title="Sonido (M)" aria-pressed={snd}>{snd ? 'Sonido' : 'Silencio'}</button>
      <button className="btn ghost sm opt-tool" onClick={() => setOv('help')} aria-label="Atajos de teclado">?</button>
    </>
  );
  return (
    <div className={`app${teacher ? ' is-teacher' : ''}`}>
      <Hud view={v} conn={st.conn} offset={st.offset} onBlock={onBlock} right={<div className="hud-tools row">{extra}</div>} />
      <main className="main">{children}</main>
      <FxLayer view={v} me={me} lite={lite} />
      {ov === 'dict' && <Dictionary locked={dictLocked} onClose={() => setOv(null)} />}
      {ov === 'score' && v && <Scoreboard view={v} onClose={() => setOv(null)} />}
      {ov === 'help' && <KeysHelp teacher={!!teacher} onClose={() => setOv(null)} />}
    </div>
  );
}
