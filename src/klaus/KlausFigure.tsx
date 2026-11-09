import { useEffect, useRef, useState } from 'react';
import type { KlausReaction } from './events.ts';
import './klaus.css';
import type { KlausSkinDef } from '../../shared/klaus-skins.ts';
import { loadKlausEngine, REACTION_STATE, type KlausController } from './engine.ts';
import { KlausFigureSvg, reactionSkin, type KlausSkin } from './KlausFigureSvg.tsx';

export { reactionSkin, type KlausSkin };

/** Skin del motor: la equipada por el alumno manda; sin ella, el Klaus original con los toques suaves de cada reacción. */
export function engineSkin(reaction: KlausReaction, look?: KlausSkinDef): string {
  if (look && look.id !== 'default') return look.id;
  const r = reactionSkin(reaction);
  return r === 'original' ? 'default' : r;
}

/**
 * Klaus dibujado por el motor Canvas del port oficial (52 skins). Un `<canvas>` por figura:
 *  - `still` dibuja un fotograma fijo (rejillas y listados: sin un bucle de animación por tarjeta);
 *  - `reducedMotion` o las preferencias del sistema/globales también lo dejan fijo (el propio motor además se detiene en pestañas ocultas y fuera de pantalla);
 *  - si el script del motor no carga, se muestra el SVG de respaldo (misma cara canónica).
 */
export function KlausFigure({ reaction = 'idle', reducedMotion = false, skin, look, still = false }: {
  reaction?: KlausReaction; reducedMotion?: boolean; skin?: KlausSkin; look?: KlausSkinDef; still?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const ctl = useRef<KlausController | null>(null);
  const [engine, setEngine] = useState<'loading' | 'ready' | 'failed'>('loading');
  const skinId = skin ? (skin === 'original' ? 'default' : skin) : engineSkin(reaction, look);
  const state = REACTION_STATE[reaction] ?? 'idle';
  const animated = !(still || reducedMotion);
  const latest = useRef({ skinId, state, animated });
  latest.current = { skinId, state, animated };

  useEffect(() => {
    let dead = false;
    void loadKlausEngine().then((api) => {
      if (dead) return;
      if (!api || !canvas.current) return setEngine('failed');
      const c = latest.current;
      ctl.current = api.create(canvas.current, { skin: c.skinId, state: c.state, fps: 30, animations: c.animated });
      setEngine('ready');
    });
    return () => { dead = true; ctl.current?.destroy(); ctl.current = null; };
  }, []);
  useEffect(() => { ctl.current?.setSkin(skinId); }, [skinId, engine]);
  useEffect(() => { ctl.current?.setState(state); }, [state, engine]);
  useEffect(() => { ctl.current?.setAnimationsEnabled(animated); }, [animated, engine]);

  if (engine === 'failed') return <KlausFigureSvg reaction={reaction} reducedMotion={reducedMotion} look={look} />;
  const celebrating = ['correct', 'streak3', 'streak5', 'streak10', 'complete'].includes(reaction);
  return <div className="klaus-figure klaus-canvas" aria-hidden="true" data-klaus-figure="" data-klaus-engine="canvas" data-klaus-ready={engine === 'ready' ? 'true' : 'false'}
    data-klaus-reaction={reaction} data-klaus-engine-state={state} data-klaus-skin={skinId} data-klaus-look={look?.id ?? 'default'} data-klaus-motion={animated ? 'full' : 'reduced'}
    {...(celebrating && animated ? { 'data-klaus-burst': '' } : {})}>
    <canvas ref={canvas} />
  </div>;
}
