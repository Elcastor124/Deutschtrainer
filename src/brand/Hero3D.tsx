import { useEffect, useRef, useState } from 'react';
import { BrandSymbol } from './Logo.tsx';
import { useEffectsEnabled } from './effects.ts';
import { holdBoot } from './boot.ts';
import type { HeroHandle } from './hero3d.ts';

/** Delay between the page being uncovered and the 3D scene starting to move. */
export const HANDOFF_MS = 900;

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
    // Release the probe context at once: browsers cap live contexts per page.
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return !!gl;
  } catch { return false; }
}

/** Fallback estático (sin WebGL): la placa con el símbolo y sus órbitas en SVG/CSS. */
export function HeroStatic() {
  return (
    <div className="dt-hero-static" aria-hidden="true">
      <div className="dt-hero-static-ring" /><div className="dt-hero-static-ring is-red" />
      <BrandSymbol size="58%" tile />
    </div>
  );
}

/** Lienzo 3D. three.js se descarga y sus shaders se compilan detrás de la pantalla de carga;
 * mientras dura la intro la escena queda en pausa para no competir con la animación. */
export function Hero3D() {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'static'>('loading');
  const effectsEnabled = useEffectsEnabled();
  useEffect(() => {
    if (!webglAvailable()) { setState('static'); return; }
    const abort = new AbortController();
    let handle: HeroHandle | null = null, io: IntersectionObserver | null = null, mo: MutationObserver | null = null;
    let onScreen = true, settleTimer = 0, settled = false;
    const root = document.documentElement;
    const covered = () => root.classList.contains('dt-intro-lock') || root.classList.contains('dt-booting');
    // After the intro, the headline's word entrance owns the first ~0.9 s; the scene keeps its
    // already-drawn still frame and only starts moving afterwards, so the two never compete.
    const sync = () => {
      if (covered()) { settled = false; clearTimeout(settleTimer); settleTimer = 0; handle?.setActive(false); return; }
      if (!settled) {
        if (!settleTimer) settleTimer = window.setTimeout(() => { settled = true; settleTimer = 0; sync(); }, HANDOFF_MS);
        return;
      }
      handle?.setActive(onScreen);
    };
    const mount = import('./hero3d.ts').then(async ({ mountHero }) => {
      if (abort.signal.aborted || !canvas.current) return;
      try {
        handle = mountHero(canvas.current, { reduced: !effectsEnabled, signal: abort.signal });
        sync();
        await handle.ready;
        if (abort.signal.aborted) return;
        setState('ready');
        io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; sync(); }, { threshold: 0.02 });
        io.observe(wrap.current!);
        mo = new MutationObserver(sync);
        mo.observe(root, { attributes: true, attributeFilter: ['class'] });
      } catch (err) { console.warn('3D desactivado:', err); handle?.dispose(); handle = null; setState('static'); }
    }).catch(() => setState('static'));
    // While the preloader is up, the hero (download + shader compile + first frame) is critical.
    holdBoot(mount);
    return () => { abort.abort(); clearTimeout(settleTimer); mo?.disconnect(); io?.disconnect(); handle?.dispose(); };
  }, [effectsEnabled]);
  return (
    <div className={`dt-hero-3d is-${state}`} ref={wrap}>
      {state === 'static' ? <HeroStatic /> : <canvas ref={canvas} aria-label="Símbolo de Deutschtrainer en 3D: el cuaderno y el lápiz forman la A de aprender." role="img" />}
    </div>
  );
}
