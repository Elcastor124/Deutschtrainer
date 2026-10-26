import { useEffect, useRef, type ReactNode } from 'react';
import './page-transition.css';
import { readEffectsEnabled } from './effects.ts';

const routeOrder = ['/', '/curso', '/tema/1', '/tema/1/taller', '/practica', '/jugar', '/jenga', '/boxeo', '/road-to-b1', '/profesor'];

/** One live page, never an exit copy or a keyed game subtree. */
export function PageTransition({ path, children }: { path: string; children: ReactNode }) {
  const surface = useRef<HTMLDivElement>(null);
  const accent = useRef<HTMLDivElement>(null);
  const previous = useRef(path);
  const journey = useRef([path]);
  const cursor = useRef(0);

  useEffect(() => {
    const page = surface.current;
    const stripe = accent.current;
    if (!page || !stripe || previous.current === path) return;
    const from = previous.current;
    previous.current = path;
    // Prefer the adjacent visited entry (browser Back/Forward); use the course order for new pages.
    const back = journey.current[cursor.current - 1] === path;
    const forward = journey.current[cursor.current + 1] === path;
    const direction = back ? -1 : forward ? 1 : routeOrder.indexOf(path) < routeOrder.indexOf(from) ? -1 : 1;
    if (back) cursor.current--;
    else if (forward) cursor.current++;
    else { journey.current = journey.current.slice(0, cursor.current + 1).concat(path); cursor.current++; }
    page.dataset.pageDirection = direction === -1 ? 'back' : 'forward';
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const animations: Animation[] = [];
    // A live preference change cancels both motions immediately, restoring the natural layout.
    const cancel = () => { animations.forEach((animation) => animation.cancel()); };
    if (readEffectsEnabled() && !document.querySelector('[data-intro]')) {
      animations.push(page.animate([
        { opacity: .88, transform: `translate3d(0, ${direction * 10}px, 0)` },
        { opacity: 1, transform: 'none' },
      ], { duration: 340, easing: 'cubic-bezier(.16,1,.3,1)' }));
      animations.push(stripe.animate([
        { opacity: 0, transform: `translateX(${-direction * 105}%) scaleX(.7)` },
        { opacity: 1, offset: .18 },
        { opacity: .9, offset: .65 },
        { opacity: 0, transform: `translateX(${direction * 105}%) scaleX(1)` },
      ], { duration: 460, easing: 'cubic-bezier(.22,.68,.2,1)' }));
    }
    const motionChanged = () => { if (!readEffectsEnabled()) cancel(); };
    addEventListener('dt:effects-change', motionChanged);
    media.addEventListener('change', motionChanged);
    // After Intro's cleanup, never steal its focus or focus a still-inert destination.
    // preventScroll leaves native/history and LearningNav's hash scrolling untouched.
    const frame = requestAnimationFrame(() => {
      if (page.isConnected && !page.closest('[inert]') && !document.querySelector('[data-intro]')) page.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(frame);
      cancel();
      media.removeEventListener('change', motionChanged);
      removeEventListener('dt:effects-change', motionChanged);
    };
  }, [path]);

  return <>
    <div className="dt-page-accent" aria-hidden="true"><div ref={accent} data-page-accent /></div>
    <div ref={surface} id="contenido" className="dt-content dt-page-surface" tabIndex={-1} data-page-transition data-page-route={path}>{children}</div>
  </>;
}
