import { useEffect, useRef, type RefObject } from 'react';
import { readEffectsEnabled, useEffectsEnabled } from './effects.ts';

export const reducedMotion = () => !readEffectsEnabled();
const finePointer = () => typeof matchMedia !== 'undefined' && matchMedia('(hover: hover) and (pointer: fine)').matches;

/** Capped magnetic travel: invitation to click, never a moving target. */
export function useMagnetic<T extends HTMLElement>(strength = 0.18): RefObject<T | null> {
  const ref = useRef<T>(null);
  const enabled = useEffectsEnabled();
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || !finePointer()) return;
    let raf = 0;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = Math.max(-5, Math.min(5, (e.clientX - r.left - r.width / 2) * strength));
      const y = Math.max(-4, Math.min(4, (e.clientY - r.top - r.height / 2) * strength));
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`; el.style.setProperty('--mx', `${e.clientX - r.left}px`); el.style.setProperty('--my', `${e.clientY - r.top}px`); });
    };
    const leave = () => { cancelAnimationFrame(raf); el.style.transform = ''; };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    return () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); leave(); el.style.removeProperty('--mx'); el.style.removeProperty('--my'); };
  }, [strength, enabled]);
  return ref;
}

/** Reveal once. Content is visible without observers, JS or motion. */
export function useReveal(root: RefObject<HTMLElement | null>, deps: unknown[] = []) {
  const enabled = useEffectsEnabled();
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const items = Array.from(el.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (!enabled || typeof IntersectionObserver === 'undefined') { items.forEach((i) => i.classList.add('is-in')); return; }
    el.classList.add('dt-reveal-on');
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach((i) => io.observe(i));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);
}

/** No scroll listener/RAF while effects are paused. Never changes scroll position. */
export function useScrollVar(ref: RefObject<HTMLElement | null>) {
  const enabled = useEffectsEnabled();
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let raf = 0;
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => el.style.setProperty('--scroll', String(Math.min(scrollY, 1200)))); };
    on(); addEventListener('scroll', on, { passive: true });
    return () => { removeEventListener('scroll', on); cancelAnimationFrame(raf); el.style.removeProperty('--scroll'); };
  }, [ref, enabled]);
}
