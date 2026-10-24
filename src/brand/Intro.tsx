import { useEffect, useState, type CSSProperties } from 'react';
import { BrandSymbol, Wordmark } from './Logo.tsx';
import { reducedMotion } from './motion.ts';

const KEY = 'dt:intro:v1';
export const INTRO_MS = 2400;
const COLS = 15, ROWS = 3;

/** Se muestra una vez por sesión, nunca en salas de juego/examen ni con reduced-motion. ?intro=1 la fuerza. */
export function shouldShowIntro(path: string, search: string): boolean {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return false;
  const q = new URLSearchParams(search);
  if (q.get('intro') === '1' || q.get('intro') === 'still') return true;
  if (q.get('intro') === '0' || q.get('sala')) return false;
  if (!/^\/(curso\/?)?$/.test(path)) return false;
  try { if (sessionStorage.getItem(KEY)) return false; } catch { return false; }
  return !reducedMotion();
}

// Desplazamientos pseudoaleatorios estables (sin Math.random en render).
const DOTS = Array.from({ length: COLS * ROWS }, (_, i) => {
  const a = Math.sin(i * 91.7) * 43758.5453, b = Math.sin(i * 47.3 + 3) * 24634.6345;
  return { i, row: Math.floor(i / COLS), col: i % COLS, dx: ((a - Math.floor(a)) - 0.5) * 760, dy: ((b - Math.floor(b)) - 0.5) * 520 };
});

export function Intro({ path, search }: { path: string; search: string }) {
  const [phase, setPhase] = useState<'off' | 'play' | 'exit'>(() => (shouldShowIntro(path, search) ? 'play' : 'off'));
  // ?intro=still (solo QA): mantiene la intro en pantalla para capturar fotogramas.
  const still = new URLSearchParams(search).get('intro') === 'still';
  useEffect(() => {
    if (phase === 'off') return;
    try { sessionStorage.setItem(KEY, '1'); } catch { /* modo privado */ }
    const root = document.documentElement;
    root.classList.add('dt-intro-lock');
    const hold = still && phase === 'play';
    const toExit = phase === 'play' && !hold ? setTimeout(() => setPhase('exit'), INTRO_MS - 520) : undefined;
    const done = hold ? undefined : setTimeout(() => setPhase('off'), phase === 'play' ? INTRO_MS : 520);
    const skip = (e: Event) => {
      if (e instanceof KeyboardEvent && ['Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(e.key)) return;
      setPhase((p) => (p === 'play' ? 'exit' : p));
    };
    addEventListener('keydown', skip);
    return () => { clearTimeout(toExit); clearTimeout(done); removeEventListener('keydown', skip); root.classList.remove('dt-intro-lock'); };
  }, [phase, still]);
  if (phase === 'off') return null;
  return (
    <div className={`dt-intro ${phase}`} data-testid="intro" onClick={() => setPhase('exit')} role="presentation">
      <div className="dt-intro-stage" aria-hidden="true">
        <div className="dt-intro-dots">
          {DOTS.map((d) => <i key={d.i} className={`r${d.row}`} style={{ '--dx': `${d.dx.toFixed(0)}px`, '--dy': `${d.dy.toFixed(0)}px`, '--d': `${(d.col * 22 + d.row * 40)}ms` } as CSSProperties} />)}
        </div>
        <BrandSymbol size={132} tone="dark" animated className="dt-intro-symbol" />
        <Wordmark height={30} tone="dark" animated className="dt-intro-word" />
        <p className="dt-intro-tag" lang="de">Schritt für Schritt</p>
      </div>
      <div className="dt-intro-wipe" aria-hidden="true"><b /><b /><b /></div>
      <button type="button" className="dt-intro-skip" onClick={(e) => { e.stopPropagation(); setPhase('exit'); }}>Saltar intro <kbd>Esc</kbd></button>
    </div>
  );
}
