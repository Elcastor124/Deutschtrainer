// Animaciones al desplazarse por la web: las piezas de contenido aparecen en cascada al entrar en pantalla, y una barra fina
// arriba indica cuánto llevas leído. Un solo IntersectionObserver para toda la página; nunca toca la posición del scroll.
// Sin efectos (interruptor de la web) o con «reducir movimiento»: todo visible desde el principio y sin barra.
import { useEffect, useRef } from 'react';
import { useEffectsEnabled } from './effects.ts';
import './scroll-reveal.css';

/** Piezas de contenido que se animan. Las pantallas de juego (.app, .boxing en partida) y lo que ya tiene su propia animación quedan fuera. */
export const REVEAL_SELECTOR = [
  '.libre > header', '.libre-card', '.libre-stats > div', '.acc-hero', '.acc-card', '.acc-perks li', '.acc-profile', '.acc-advice',
  '.bdg-group', '.bdg', '.rk-head', '.rk-me', '.rk-stats > div', '.rk-rules', '.rk-rules li', '.private-lobby',
  '.bx-landing-intro', '.bx-landing-scene', '.bx-entry-panel', '.bx-rules span', '.home > *', '.practice-account', '.wp',
].join(',');
const SKIP = '[data-reveal], .app *, .rk-stage *, .rk-list *, .bx-arena *, .bdg-toast *';

export function ScrollReveal({ path }: { path: string }) {
  const enabled = useEffectsEnabled();
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = document.documentElement;
    if (!enabled || typeof IntersectionObserver === 'undefined') { root.classList.remove('sr-on'); return; }
    root.classList.add('sr-on');
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('sr-in'); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    const tag = () => {
      for (const el of document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR)) {
        if (el.dataset.sr !== undefined || el.matches(SKIP)) continue;
        // Escalonado entre hermanos que se revelan juntos (las tarjetas de una rejilla entran una tras otra).
        const i = el.parentElement ? [...el.parentElement.children].filter((c) => (c as HTMLElement).dataset.sr !== undefined).length : 0;
        el.dataset.sr = '';
        el.style.setProperty('--sr-i', String(Math.min(i, 8)));
        io.observe(el);
      }
    };
    tag();
    // El contenido llega tarde (datos del servidor, cambios de pestaña): se etiqueta lo nuevo sin re-animar lo ya visto.
    const mo = new MutationObserver(() => tag());
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { mo.disconnect(); io.disconnect(); };
  }, [enabled, path]);
  useEffect(() => {
    const el = bar.current;
    if (!el || !enabled) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - innerHeight;
      el.style.transform = `scaleX(${max > 40 ? Math.min(1, scrollY / max) : 0})`;
      el.style.opacity = max > 40 && scrollY > 4 ? '1' : '0';
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    addEventListener('scroll', on, { passive: true }); addEventListener('resize', on);
    return () => { removeEventListener('scroll', on); removeEventListener('resize', on); cancelAnimationFrame(raf); };
  }, [enabled, path]);
  return enabled ? <div ref={bar} className="sr-progress" aria-hidden="true" /> : null;
}
