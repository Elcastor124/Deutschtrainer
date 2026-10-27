import { useSyncExternalStore } from 'react';

/** One-shot boot gate.
 * index.html paints the preloader before any JS runs and marks <html class="dt-booting">.
 * Critical work (fonts, the hero GPU warm-up, window load) registers with holdBoot();
 * nothing cinematic starts until it has all settled, so the intro never competes with
 * bundle parsing, shader compilation or font swaps for the main thread.
 */
type Listener = () => void;
const listeners = new Set<Listener>();
const holds: Promise<unknown>[] = [];
let booting = typeof document !== 'undefined' && document.documentElement.classList.contains('dt-booting');
let started = false;

export const BOOT_FADE_MS = 420;

export function isBooting(): boolean { return booting; }

/** Register work the preloader should wait for. Ignored once the app is ready. */
export function holdBoot(work: Promise<unknown>): void {
  if (booting) holds.push(work.then(() => undefined, () => undefined));
}

export function subscribeBoot(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useBooted(): boolean {
  return useSyncExternalStore(subscribeBoot, () => !booting, () => true);
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
// rAF does not tick in background tabs: a timer bounds each frame so boot always completes.
const frames = (n = 2) => new Promise<void>((resolve) => {
  if (typeof requestAnimationFrame !== 'function') { resolve(); return; }
  const step = () => {
    if (--n <= 0) { resolve(); return; }
    let done = false;
    const next = () => { if (!done) { done = true; step(); } };
    requestAnimationFrame(next); setTimeout(next, 120);
  };
  let done = false;
  const first = () => { if (!done) { done = true; step(); } };
  requestAnimationFrame(first); setTimeout(first, 120);
});

function finish(): void {
  if (!booting) return;
  booting = false;
  document.documentElement.classList.remove('dt-booting');
  listeners.forEach((listener) => listener());
}

/** Resolve once every registered hold has settled (holds may register more holds). */
async function settleHolds(): Promise<void> {
  let seen = 0;
  while (seen < holds.length) {
    const batch = holds.slice(seen);
    seen = holds.length;
    await Promise.all(batch);
    await frames(2);
  }
}

/** Await critical work, then fade the preloader out and release the app.
 * maxMs bounds slow networks/GPUs: the page is never held hostage by a stuck asset.
 */
export async function runBoot({ maxMs = 8000, minMs = 650 }: { maxMs?: number; minMs?: number } = {}): Promise<void> {
  if (!booting || started) return;
  started = true;
  const loader = document.querySelector<HTMLElement>('[data-preloader]');
  const t0 = Number((globalThis as { __dtBootStart?: number }).__dtBootStart ?? performance.now());
  const loaded = document.readyState === 'complete' ? Promise.resolve() : new Promise<void>((resolve) => addEventListener('load', () => resolve(), { once: true }));
  const work = (async () => {
    await frames(2); // let React commit and component effects register their holds
    await Promise.all([loaded, document.fonts?.ready ?? Promise.resolve()]);
    await settleHolds();
  })();
  await Promise.race([work, wait(maxMs)]);
  // Two quiet frames: the first visible animation frame must not be a compile frame.
  await frames(2);
  // Never flash the preloader: once shown, it is visible long enough to read.
  const elapsed = performance.now() - t0;
  if (elapsed < minMs) await wait(minMs - elapsed);
  // Release the app first so the intro's dark first frame mounts under the fading loader:
  // a cross-fade between two dark frames, never a flash of the page in between.
  finish();
  if (loader) {
    loader.dataset.preloader = 'done';
    loader.setAttribute('aria-busy', 'false');
    await wait(BOOT_FADE_MS);
    loader.remove();
  }
}
