import { useEffect, useRef, type ReactNode } from 'react';
import './page-transition.css';
import { readEffectsEnabled } from './effects.ts';
import { useBooted } from './boot.ts';

/** Orden del menú: avanzar hacia la derecha en la navegación hace que la página entre desde la derecha (y al revés). */
const routeOrder = ['/', '/curso', '/unterricht', '/tema/1', '/tema/1/taller', '/practica', '/hablar', '/escribir', '/juegos', '/jugar', '/jenga', '/boxeo', '/libre', '/ranking', '/examenes', '/mi', '/cuenta', '/klaus', '/profesor'];
const orderOf = (p: string) => { const i = routeOrder.indexOf(p.replace(/\/$/, '') || '/'); return i < 0 ? routeOrder.length : i; };
/** Pantallas con coreografía propia (portada editorial) o donde el movimiento estorbaría (partidas, profesor). */
const NO_CHOREO = /^\/($|jugar|jenga|boxeo|libre\/jugar|t\/|p\/|j\/|profesor|teacher)/;
const EASE = 'cubic-bezier(.22,1,.36,1)';

/** Entrada de cada pestaña: el titular se descubre tras una máscara y el resto sube en cascada. Solo transform/opacity/clip;
 *  nada bloquea la interacción (sin pointer-events ni retrasos de navegación) y todo se cancela si se desactivan los efectos. */
function choreograph(page: HTMLElement, direction: number): Animation[] {
  const path = page.dataset.pageRoute ?? '';
  if (NO_CHOREO.test(path) || page.querySelector('.app, [data-intro]')) return [];
  const head = page.querySelector<HTMLElement>('main > header, main header, header');
  if (!head) return [];
  const out: Animation[] = [];
  const skip = (el: Element) => el.matches('[data-sr], [data-m], [data-reveal]') || !!el.closest('[data-sr], [data-m]');
  const parts = [...head.children].filter((el): el is HTMLElement => el instanceof HTMLElement && !skip(el)).slice(0, 5);
  parts.forEach((el, i) => {
    const title = /^H[12]$/.test(el.tagName);
    out.push(el.animate(title
      ? [{ clipPath: 'inset(0 0 100% 0)', transform: 'translate3d(0, 0.5em, 0)', opacity: 0.2 }, { clipPath: 'inset(0 0 -12% 0)', transform: 'none', opacity: 1 }]
      : [{ opacity: 0 }, { opacity: 1 }],
    { duration: title ? 560 : 420, delay: 40 + i * 55, easing: EASE, fill: 'backwards' }));
  });
  // Primeros bloques bajo el encabezado: solo fundido. Nada interactivo cambia de posición mientras entra (un clic temprano acierta).
  const blocks: HTMLElement[] = [];
  for (let n = head.nextElementSibling; n && blocks.length < 3; n = n.nextElementSibling) if (n instanceof HTMLElement && !skip(n) && n.getBoundingClientRect().top < innerHeight) blocks.push(n);
  blocks.forEach((el, i) => out.push(el.animate(
    [{ opacity: 0 }, { opacity: 1 }],
    { duration: 420, delay: 120 + i * 70, easing: EASE, fill: 'backwards' })));
  return out;
}

/** One live page, never an exit copy or a keyed game subtree. */
export function PageTransition({ path, children }: { path: string; children: ReactNode }) {
  const surface = useRef<HTMLDivElement>(null);
  const accent = useRef<HTMLDivElement>(null);
  const previous = useRef(path);
  const journey = useRef([path]);
  const cursor = useRef(0);
  const booted = useBooted();
  const firstDone = useRef(false);

  // Primera carga de cualquier pestaña (no la portada, que tiene su intro): misma entrada, cuando termina el precargador.
  useEffect(() => {
    const page = surface.current;
    if (!booted || firstDone.current || !page) return;
    firstDone.current = true;
    if (!readEffectsEnabled() || document.querySelector('[data-intro]')) return;
    let anims: Animation[] = [];
    const frame = requestAnimationFrame(() => { anims = choreograph(page, 1); });
    const off = () => { if (!readEffectsEnabled()) anims.forEach((a) => a.cancel()); };
    addEventListener('dt:effects-change', off);
    return () => { cancelAnimationFrame(frame); removeEventListener('dt:effects-change', off); };
  }, [booted]);

  useEffect(() => {
    const page = surface.current;
    const stripe = accent.current;
    if (!page || !stripe || previous.current === path) return;
    const from = previous.current;
    previous.current = path;
    firstDone.current = true;
    // Prefer the adjacent visited entry (browser Back/Forward); use the menu order for new pages.
    const back = journey.current[cursor.current - 1] === path;
    const forward = journey.current[cursor.current + 1] === path;
    const direction = back ? -1 : forward ? 1 : orderOf(path) < orderOf(from) ? -1 : 1;
    if (back) cursor.current--;
    else if (forward) cursor.current++;
    else { journey.current = journey.current.slice(0, cursor.current + 1).concat(path); cursor.current++; }
    page.dataset.pageDirection = direction === -1 ? 'back' : 'forward';
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const animations: Animation[] = [];
    let frame2 = 0;
    // A live preference change cancels every motion immediately, restoring the natural layout.
    const cancel = () => { animations.forEach((animation) => animation.cancel()); };
    if (readEffectsEnabled() && !document.querySelector('[data-intro]')) {
      animations.push(page.animate([
        { opacity: .9, transform: `translate3d(${direction * 18}px, 0, 0)` },
        { opacity: 1, transform: 'none' },
      ], { duration: 380, easing: EASE }));
      animations.push(stripe.animate([
        { opacity: 0, transform: `translateX(${-direction * 105}%) scaleX(.7)` },
        { opacity: 1, offset: .18 },
        { opacity: .9, offset: .65 },
        { opacity: 0, transform: `translateX(${direction * 105}%) scaleX(1)` },
      ], { duration: 460, easing: 'cubic-bezier(.22,.68,.2,1)' }));
      // La vista nueva ya está en el DOM (efecto posterior al render): se coreografía en el siguiente frame.
      frame2 = requestAnimationFrame(() => { if (readEffectsEnabled()) animations.push(...choreograph(page, direction)); });
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
      cancelAnimationFrame(frame2);
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
