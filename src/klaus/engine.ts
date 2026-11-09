// Motor de skins de Klaus (Canvas 2D). `public/klaus/klaus-renderer.js` es el port del renderer de escritorio (52 skins, 12 estados)
// y se carga UNA vez, bajo demanda: las páginas sin Klaus no descargan sus 277 KB. Si el script no carga, KlausFigure usa el SVG de respaldo.
export interface KlausController {
  setSkin(skinId: string): KlausController; setState(state: string): KlausController;
  playState(state: string, durationMs?: number | null): KlausController; setPaused(paused: boolean): KlausController;
  setAnimationsEnabled(enabled: boolean): KlausController; destroy(): void;
}
export interface KlausWebApi {
  create(canvas: HTMLCanvasElement, options?: { skin?: string; state?: string; fps?: number; animations?: boolean; paused?: boolean }): KlausController;
  skins(): { id: string; label: string; accent: string; glow: boolean }[]; states(): string[]; skinExists(id: string): boolean;
}
declare global { interface Window { KlausWeb?: KlausWebApi } }

export const ENGINE_SRC = '/klaus/klaus-renderer.js';
let pending: Promise<KlausWebApi | null> | null = null;

export function loadKlausEngine(): Promise<KlausWebApi | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.KlausWeb) return Promise.resolve(window.KlausWeb);
  pending ??= new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = ENGINE_SRC; s.async = true; s.dataset.klausEngine = '';
    s.onload = () => resolve(window.KlausWeb ?? null);
    s.onerror = () => { s.remove(); pending = null; resolve(null); }; // permite reintentar más tarde
    document.head.appendChild(s);
  });
  return pending;
}

/** Reacción de la práctica → estado del motor (los 12 estados originales). */
export const REACTION_STATE: Record<string, string> = {
  waving: 'waving', idle: 'idle', thinking: 'thinking', support: 'motivating',
  correct: 'happy', streak3: 'happy', streak5: 'celebrating', streak10: 'celebrating', complete: 'proud',
};
