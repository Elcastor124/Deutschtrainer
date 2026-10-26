import { useEffect, useRef, useState, type ReactNode } from 'react';
import { blockDef } from '../../shared/rules.ts';
import type { BlockId } from '../../shared/types.ts';
import { FxLayer } from '../fx/FxLayer.tsx';
import { useEffectsEnabled } from '../brand/effects.ts';
import { setJuiceLite } from '../fx/juice.ts';
import { setLite as setParticlesLite } from '../fx/particles.ts';
import { setSound, sfx } from '../fx/sound.ts';
import type { NetState } from '../net.ts';
import { isTyping, prefersReducedMotion, useSetting } from '../util.ts';
import { Hud } from './Hud.tsx';
import { Dictionary, KeysHelp, Scoreboard } from './Overlays.tsx';
import { useJengaFx } from './Tasks.tsx';

/**
 * Marco común: HUD, atajos de teclado, capa de efectos y «aura» de estado.
 * El aura refleja en toda la pantalla lo que le pasa al alumno: escudo, sabotaje, ataque recibido, Double XP, BlackCard.
 */
export function Shell({ st, me, teacher, onBlock, onKey, hudExtra, children }: {
  st: NetState; me?: string; teacher?: boolean; onBlock?: (b: BlockId) => void;
  onKey?: (e: KeyboardEvent) => void; hudExtra?: ReactNode; children: ReactNode;
}) {
  const [lite, setLite] = useSetting('bc:lite', prefersReducedMotion());
  const effects = useEffectsEnabled();
  const effectiveLite = lite || !effects;
  const [snd, setSnd] = useSetting(teacher ? 'bc:sound-t' : 'bc:sound', !!teacher);
  const [ov, setOv] = useState<'dict' | 'score' | 'help' | null>(null);
  const keyRef = useRef(onKey);
  keyRef.current = onKey;
  const v = st.view;
  useJengaFx(v);

  useEffect(() => { document.documentElement.dataset.lite = effectiveLite ? '1' : '0'; setParticlesLite(effectiveLite); setJuiceLite(effectiveLite); }, [effectiveLite]);
  useEffect(() => setSound(snd), [snd]);
  const pub = v?.players.find((p) => p.id === me);
  const live = !!v && (v.phase === 'question' || v.phase === 'review');
  const aura = {
    theme: v?.phase === 'final' ? 'final' : blockDef(v?.block ?? null)?.theme ?? '',
    bc: live && (teacher ? v!.uses.some((u) => u.item === 'blackcard') : v!.me?.used === 'blackcard'),
    shield: !!pub?.shield,
    sab: !!pub?.sabotaged,
    target: live && !!v?.me?.incoming.length,
    dbl: live && v?.me?.used === 'double',
    second: live && v?.me?.used === 'second',
  };
  useEffect(() => {
    const b = document.body.dataset;
    b.theme = aura.theme;
    b.bc = aura.bc ? 'on' : 'off';
    b.shield = aura.shield ? 'on' : 'off';
    b.sab = aura.sab ? 'on' : 'off';
    b.target = aura.target ? 'on' : 'off';
    b.dbl = aura.dbl ? 'on' : 'off';
    b.second = aura.second ? 'on' : 'off';
  }, [aura.theme, aura.bc, aura.shield, aura.sab, aura.target, aura.dbl, aura.second]);
  useEffect(() => () => { for (const k of ['theme', 'bc', 'shield', 'sab', 'target', 'dbl', 'second']) delete document.body.dataset[k]; }, []);
  // Latido mientras la BlackCard está en juego.
  useEffect(() => {
    if (!aura.bc) return;
    sfx.heartbeat();
    const id = setInterval(() => sfx.heartbeat(), 1400);
    return () => clearInterval(id);
  }, [aura.bc]);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOv(null); return; }
      if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.querySelector('.chest-ovl')) return;
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
  const tool = (label: string, key: string, onClick: () => void, extra = '', pressed?: boolean) => (
    <button className={`btn ghost sm tool ${extra}`} onClick={() => { sfx.key(); onClick(); }} title={`${label} (${key})`} aria-pressed={pressed}>
      <span className="lbl">{label}</span><kbd>{key}</kbd>
    </button>
  );
  const extra = (
    <>
      {hudExtra}
      {tool('Diccionario', 'D', () => setOv('dict'))}
      {tool('Marcador', 'P', () => setOv('score'))}
      {tool(lite ? 'Efectos: bajo' : 'Efectos: alto', 'L', () => setLite(!lite), `opt-tool${lite ? ' on' : ''}`, !lite)}
      {tool(snd ? 'Sonido' : 'Silencio', 'M', () => setSnd(!snd), `opt-tool${snd ? '' : ' on'}`, snd)}
      {tool('Atajos', '?', () => setOv('help'), 'opt-tool')}
    </>
  );
  return (
    <div className={`app${teacher ? ' is-teacher' : ''}`}>
      <Hud view={v} conn={st.conn} offset={st.offset} onBlock={onBlock} right={<div className="hud-tools">{extra}</div>} />
      <main className="main">{children}</main>
      <div className="aura" aria-hidden="true">
        <i className="a-frame" /><i className="a-scan" /><i className="a-vig" /><i className="a-corner c1" /><i className="a-corner c2" /><i className="a-corner c3" /><i className="a-corner c4" />
      </div>
      {aura.dbl && <div className="aura-tag dbl" role="status">×2 Double XP activo</div>}
      {aura.target && <div className="aura-tag target" role="status">Estás en el punto de mira</div>}
      <FxLayer view={v} me={me} lite={effectiveLite} />
      {ov === 'dict' && <Dictionary locked={dictLocked} onClose={() => setOv(null)} />}
      {ov === 'score' && v && <Scoreboard view={v} onClose={() => setOv(null)} />}
      {ov === 'help' && <KeysHelp teacher={!!teacher} onClose={() => setOv(null)} />}
    </div>
  );
}
