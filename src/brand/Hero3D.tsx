import { useEffect, useMemo, useRef, useState } from 'react';
import { VOCAB } from '../../shared/vocab.ts';
import { BrandSymbol } from './Logo.tsx';
import { reducedMotion } from './motion.ts';
import type { Article, HeroHandle } from './hero3d.ts';

function useWords() {
  return useMemo(() => {
    const out: Record<Article, { de: string; es: string }[]> = { der: [], die: [], das: [] };
    for (const v of VOCAB) {
      const m = /^(der|die|das) ([A-ZÄÖÜ][\wäöüß-]{2,13})$/.exec(v.de);
      if (m && !v.pl?.includes('only')) out[m[1] as Article].push({ de: v.de, es: v.es });
    }
    // Mezcla estable por artículo
    for (const k of Object.keys(out) as Article[]) out[k] = out[k].filter((_, i) => i % 2 === 0).concat(out[k].filter((_, i) => i % 2 === 1));
    return out;
  }, []);
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

/** Fallback estático (sin WebGL): el símbolo y los tres artículos en SVG/CSS. */
export function HeroStatic() {
  return (
    <div className="dt-hero-static" aria-hidden="true">
      <div className="dt-hero-static-ring" />
      <BrandSymbol size="58%" tile />
      <span className="dt-art der">der</span><span className="dt-art die">die</span><span className="dt-art das">das</span>
    </div>
  );
}

/** Lienzo 3D: se carga three.js bajo demanda, se pausa fuera de pantalla y con la pestaña oculta. */
export function Hero3D() {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'static'>('loading');
  const [hit, setHit] = useState<{ article: Article; de: string; es: string } | null>(null);
  const words = useWords();
  useEffect(() => {
    let handle: HeroHandle | null = null, cancelled = false, io: IntersectionObserver | null = null;
    if (!webglAvailable()) { setState('static'); return; }
    const boot = () => import('./hero3d.ts').then(({ mountHero }) => {
      if (cancelled || !canvas.current) return;
      try {
        handle = mountHero(canvas.current, { words, reduced: reducedMotion(), onArticle: setHit });
        setState('ready');
        io = new IntersectionObserver(([e]) => handle?.setActive(e.isIntersecting), { threshold: 0.02 });
        io.observe(wrap.current!);
      } catch (err) { console.warn('3D desactivado:', err); setState('static'); }
    }).catch(() => setState('static'));
    // Primero la pintura de la página; luego el 3D.
    const idle = (globalThis as { requestIdleCallback?: (f: () => void, o?: object) => number }).requestIdleCallback;
    const schedule = () => (idle ? idle(boot, { timeout: 600 }) : setTimeout(boot, 120));
    // Durante la intro el hilo principal es para la animación: el 3D arranca cuando termina.
    const root = document.documentElement;
    let mo: MutationObserver | null = null;
    if (root.classList.contains('dt-intro-lock')) {
      mo = new MutationObserver(() => { if (!root.classList.contains('dt-intro-lock')) { mo?.disconnect(); mo = null; schedule(); } });
      mo.observe(root, { attributes: true, attributeFilter: ['class'] });
    } else schedule();
    return () => { cancelled = true; mo?.disconnect(); io?.disconnect(); handle?.dispose(); };
  }, [words]);
  return (
    <div className={`dt-hero-3d is-${state}`} ref={wrap}>
      {state === 'static' ? <HeroStatic /> : <canvas ref={canvas} aria-label="Símbolo de Deutschtrainer en 3D con los dados der, die y das. Toca un dado para ver una palabra." role="img" />}
      {state !== 'static' && <p className="dt-hero-hint" aria-live="polite">
        {hit ? <><b className={`dt-art-chip ${hit.article}`}>{hit.article}</b> <span lang="de">{hit.de.replace(/^(der|die|das) /, '')}</span> <span className="dim">· {hit.es}</span></>
          : <>Toca un dado: <b className="dt-art-chip der">der</b> <b className="dt-art-chip die">die</b> <b className="dt-art-chip das">das</b></>}
      </p>}
    </div>
  );
}
