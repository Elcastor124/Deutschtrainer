import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { BrandSymbol, Wordmark } from './Logo.tsx';
import { readEffectsEnabled, useEffectsEnabled } from './effects.ts';
import { useBooted } from './boot.ts';
import './intro-v2.css';

const KEY = 'dt:intro:v1'; // Keep the existing per-tab contract across the redesign.
export const INTRO_MS = 6200;
export const INTRO_EXIT_MS = 460;
export const INTRO_REPLAY_EVENT = 'dt:intro:replay';

// Decorative threads only: every one starts beyond a screen edge and terminates at the
// emblem's centre. Straight, GPU-composited beams (transform/opacity only): the old SVG
// strokes repainted the full viewport each frame and stuttered on mid-range phones.
// x/y are the start point relative to the centre, as a fraction of the half-viewport.
const CONVERGENCE = [
  { edge: 'left', tone: 'red', x: -1.25, y: -0.49, delay: 100, depth: 1 },
  { edge: 'right', tone: 'gold', x: 1.25, y: 0.42, delay: 180, depth: 1 },
  { edge: 'top', tone: 'gold', x: -0.47, y: -1.33, delay: 260, depth: 0 },
  { edge: 'bottom', tone: 'red', x: 0.53, y: 1.33, delay: 340, depth: 1 },
  { edge: 'left', tone: 'gold', x: -1.25, y: 0.24, delay: 420, depth: 0 },
  { edge: 'right', tone: 'red', x: 1.25, y: -0.29, delay: 500, depth: 0 },
  { edge: 'top', tone: 'red', x: 0.79, y: -1.33, delay: 200, depth: 1 },
  { edge: 'bottom', tone: 'gold', x: -0.82, y: 1.33, delay: 280, depth: 0 },
  { edge: 'left', tone: 'red', x: -1.25, y: -1.04, delay: 580, depth: 0 },
  { edge: 'right', tone: 'gold', x: 1.25, y: 1.02, delay: 660, depth: 1 },
] as const;

const GUIDES_SVG = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 360" fill="none">
<path d="M28 180 H332 M180 20 V340 M54 310 H307 M180 42 L53 310 M180 42 L307 310" stroke="#f2f1ee" stroke-opacity=".14" stroke-width=".6"/>
<circle cx="180" cy="180" r="145" stroke="#e9b949" stroke-opacity=".2" stroke-width=".6" stroke-dasharray="4 10"/>
<path d="M44 175 V185 M316 175 V185 M175 38 H185 M175 322 H185" stroke="#e9b949" stroke-opacity=".5"/>
</svg>`)}`;

/** Place in Landing/footer; it replays without reloading or clearing session progress. */
export function IntroReplayButton({ className = '' }: { className?: string }) {
  return <button type="button" className={`dt-intro-replay ${className}`} data-intro-replay onClick={() => window.dispatchEvent(new Event(INTRO_REPLAY_EVENT))}>
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 6a7 7 0 1 1-1 7M4 2v5h5" /></svg>
    Repetir intro
  </button>;
}

/** Stable edit/capture points; CSS animates continuously rather than on React renders. */
export const INTRO_CUES = [
  { at: 0, name: 'draft' },
  { at: 800, name: 'letters' },
  { at: 2000, name: 'notebook' },
  { at: 3200, name: 'signature' },
  { at: 4600, name: 'hold' },
] as const;

/** Never interrupt an invitation, classroom or assessment, including forced QA URLs. */
export function shouldShowIntro(path: string, search: string): boolean {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return false;
  const q = new URLSearchParams(search);
  if (q.get('intro') === '0' || q.has('sala')) return false;
  // Keep the original global matchMedia eligibility contract as well as the
  // shared preference gate (including embedders with only a global media API).
  if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  if (!/^\/(curso\/?)?$/.test(path) || !readEffectsEnabled()) return false;
  if (q.get('intro') === '1' || q.get('intro') === 'still') return true;
  try { if (sessionStorage.getItem(KEY)) return false; } catch { return false; }
  return readEffectsEnabled();
}

export function Intro({ path, search }: { path: string; search: string }) {
  const effectsEnabled = useEffectsEnabled();
  // The overlay mounts frozen on its first frame *behind* the preloader, so every layer is
  // styled and rasterized while the logo is still on screen; its clock (CSS + cue timers)
  // starts only once every critical asset is ready.
  const booted = useBooted();
  const [phase, setPhase] = useState<'off' | 'play' | 'exit'>(() => (shouldShowIntro(path, search) ? 'play' : 'off'));
  const [cue, setCue] = useState<string>('draft');
  // Remove the overlay in the preference-change render, not after the exit animation.
  const active = phase !== 'off' && effectsEnabled;
  const overlay = useRef<HTMLDivElement>(null);
  const skipButton = useRef<HTMLButtonElement>(null);
  const introLocation = useRef({ path, search });
  // ?intro=still holds the fully assembled composition. CSS animations remain seekable via CDP.
  const still = new URLSearchParams(search).get('intro') === 'still';

  useEffect(() => {
    // Re-enabling effects must not resurrect a cancelled cinematic.
    if (!effectsEnabled) setPhase('off');
  }, [effectsEnabled]);

  useEffect(() => {
    const cancelOnLocationChange = (nextPath: string, nextSearch: string) => {
      if (introLocation.current.path === nextPath && introLocation.current.search === nextSearch) return;
      introLocation.current = { path: nextPath, search: nextSearch };
      // Turning off runs the existing timer, inert, focus and listener cleanup.
      // Never re-evaluate eligibility here: navigation must not auto replay.
      setPhase('off');
    };
    cancelOnLocationChange(path, search);
    // usePath only updates for pathname changes; observe search-only SPA navigation too.
    const navigated = () => cancelOnLocationChange(window.location.pathname, window.location.search);
    window.addEventListener('popstate', navigated);
    return () => window.removeEventListener('popstate', navigated);
  }, [path, search]);

  useEffect(() => {
    const replay = () => {
      const currentLocation = introLocation.current;
      const query = new URLSearchParams(currentLocation.search);
      query.set('intro', '1');
      if (shouldShowIntro(currentLocation.path, query.toString())) setPhase((current) => current === 'off' ? 'play' : current);
    };
    window.addEventListener(INTRO_REPLAY_EVENT, replay);
    return () => window.removeEventListener(INTRO_REPLAY_EVENT, replay);
  }, [path, search]);

  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const siblings = Array.from(overlay.current?.parentElement?.children ?? [])
      .filter((el): el is HTMLElement => el instanceof HTMLElement && el !== overlay.current);
    const inertBefore = siblings.map((el) => el.inert);
    const root = document.documentElement;
    const wasLocked = root.classList.contains('dt-intro-lock');
    root.classList.add('dt-intro-lock');
    siblings.forEach((el) => { el.inert = true; });
    skipButton.current?.focus({ preventScroll: true });
    const keyboard = (e: KeyboardEvent) => {
      if (e.key === 'Tab') { e.preventDefault(); skipButton.current?.focus({ preventScroll: true }); }
      if (e.key === 'Escape') { e.preventDefault(); setPhase('off'); }
    };
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const motionChanged = () => { if (motion.matches) setPhase('off'); };
    motion.addEventListener('change', motionChanged);
    motionChanged();
    window.addEventListener('keydown', keyboard);
    return () => {
      motion.removeEventListener('change', motionChanged);
      window.removeEventListener('keydown', keyboard);
      if (!wasLocked) root.classList.remove('dt-intro-lock');
      siblings.forEach((el, i) => { el.inert = inertBefore[i]; });
      const target = previous?.isConnected && previous !== document.body ? previous : document.getElementById('contenido');
      target?.focus({ preventScroll: true });
    };
  }, [active]);

  // One intro per tab: seen as soon as it is on screen, even if skipped before boot finishes.
  useEffect(() => {
    if (phase === 'off' || !effectsEnabled) return;
    try { sessionStorage.setItem(KEY, '1'); } catch { /* storage may be disabled */ }
  }, [phase, effectsEnabled]);

  useEffect(() => {
    if (phase === 'off' || !effectsEnabled || !booted) return;
    if (phase === 'exit') {
      const done = window.setTimeout(() => setPhase('off'), INTRO_EXIT_MS);
      return () => window.clearTimeout(done);
    }
    setCue('draft');
    const timers = INTRO_CUES.slice(1).map((c) => window.setTimeout(() => setCue(c.name), c.at));
    if (!still) timers.push(window.setTimeout(() => setPhase('exit'), INTRO_MS - INTRO_EXIT_MS));
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [phase, still, effectsEnabled, booted]);

  if (!active) return null;
  return (
    <div ref={overlay} className={`dt-intro dt-intro-v2 ${phase}${booted ? '' : ' is-waiting'}`} data-testid="intro" data-intro="cinematic-v2" data-intro-phase={phase === 'exit' ? 'reveal' : cue} data-intro-duration={INTRO_MS} onClick={() => setPhase('off')} role="dialog" aria-modal="true" aria-label="Presentación de Deutschtrainer">
      <div className="dt-intro-field" aria-hidden="true"><i /><i /><i /></div>
      <div className="dt-intro-blueprint" aria-hidden="true"><i /><i /><i /></div>
      <div className="dt-intro-registration" aria-hidden="true"><i /><i /><i /><i /></div>
      <div className="dt-intro-masthead" aria-hidden="true"><span>Deutschtrainer<span className="dt-intro-slash"> / </span>Identität</span><span>D + T<span className="dt-intro-slash"> / </span>A</span></div>
      <div className="dt-intro-v2-stage" aria-hidden="true">
        <div className="dt-intro-drafting">
          <div className="dt-intro-convergence" data-intro-convergence aria-hidden="true">
            {CONVERGENCE.map((thread, i) => <i key={i} data-intro-edge={thread.edge} className={`dt-intro-thread is-${thread.tone} is-depth-${thread.depth}`} style={{ '--thread-delay': `${thread.delay}ms`, '--tx': thread.x, '--ty': thread.y } as CSSProperties}>
              <b className="dt-intro-thread-rail" />
              <b className="dt-intro-thread-pulse" data-intro-beam={thread.tone} />
            </i>)}
          </div>
          <div className="dt-intro-resonance" aria-hidden="true"><i /><i /></div>
          {/* Construction guides as a cached image layer: rasterized once, then only composited. */}
          <img className="dt-intro-guides" src={GUIDES_SVG} alt="" width={360} height={360} decoding="sync" draggable={false} />
          <span className="dt-intro-letter dt-intro-letter-d">D</span>
          <span className="dt-intro-letter dt-intro-letter-t">T</span>
          <BrandSymbol size={260} tone="dark" animated className="dt-intro-emblem" />
          <span className="dt-intro-annotation dt-intro-annotation-left">D<span>Das Heft</span></span>
          <span className="dt-intro-annotation dt-intro-annotation-right">T<span>Der Stift</span></span>
        </div>
        <div className="dt-intro-word-window"><Wordmark height={34} tone="dark" animated className="dt-intro-word" /></div>
        <p className="dt-intro-v2-tag" lang="de"><span>Schritt für Schritt.</span><b>Dein Deutsch.</b></p>
      </div>
      <div className="dt-intro-score" aria-hidden="true"><span>Eine Idee. Dein Weg.</span><div>{['D', 'T', 'A'].map((letter, i) => <i key={letter} style={{ '--chapter': i } as CSSProperties}><b />{letter}</i>)}</div></div>
      <div className="dt-intro-aperture" aria-hidden="true"><i /><i /></div>
      <div className="dt-intro-v2-reveal" aria-hidden="true"><i /><i /><i /></div>
      <button ref={skipButton} type="button" className="dt-intro-skip" data-intro-skip onClick={(e) => { e.stopPropagation(); setPhase('off'); }}>Saltar intro <kbd>Esc</kbd></button>
    </div>
  );
}
