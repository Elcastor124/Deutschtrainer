import { useSyncExternalStore } from 'react';

const KEY = 'dt:effects';
const EVENT = 'dt:effects-change';
const REDUCED = '(prefers-reduced-motion: reduce)';
const listeners = new Set<() => void>();
let stopListening: (() => void) | undefined;
let volatilePreference: boolean | undefined;

function motionQuery(): MediaQueryList | undefined {
  try { return typeof window !== 'undefined' ? window.matchMedia?.(REDUCED) : undefined; }
  catch { return undefined; }
}

export function readEffectsReducedMotion(): boolean {
  return motionQuery()?.matches ?? false;
}

/** Effective preference. System accessibility settings cannot be overridden. */
export function readEffectsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  if (readEffectsReducedMotion()) return false;
  if (volatilePreference !== undefined) return volatilePreference;
  try { return window.localStorage.getItem(KEY) !== 'off'; }
  catch { return true; }
}

function syncRoot() {
  if (typeof document !== 'undefined') document.documentElement.dataset.dtEffects = readEffectsEnabled() ? 'on' : 'off';
}

function notify() {
  syncRoot();
  for (const listener of listeners) listener();
}

/** Subscribe once across all React consumers; release browser listeners at zero. */
export function subscribeEffects(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  listeners.add(listener);
  if (!stopListening) {
    const query = motionQuery();
    const onStorage = (event: StorageEvent) => {
      if (event.key !== KEY && event.key !== null) return;
      volatilePreference = undefined;
      notify();
    };
    window.addEventListener(EVENT, notify);
    window.addEventListener('storage', onStorage);
    if (query?.addEventListener) query.addEventListener('change', notify);
    else query?.addListener?.(notify);
    stopListening = () => {
      window.removeEventListener(EVENT, notify);
      window.removeEventListener('storage', onStorage);
      if (query?.removeEventListener) query.removeEventListener('change', notify);
      else query?.removeListener?.(notify);
    };
  }
  syncRoot();
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      stopListening?.();
      stopListening = undefined;
    }
  };
}

export function setEffectsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, enabled ? 'on' : 'off');
    volatilePreference = undefined;
  } catch {
    // Storage denial must not prevent this tab from pausing effects.
    volatilePreference = enabled;
  }
  syncRoot();
  window.dispatchEvent(new Event(EVENT));
}

const serverOff = () => false;
const serverReduced = () => true;
export function useEffectsEnabled(): boolean {
  return useSyncExternalStore(subscribeEffects, readEffectsEnabled, serverOff);
}
export function useEffectsReducedMotion(): boolean {
  return useSyncExternalStore(subscribeEffects, readEffectsReducedMotion, serverReduced);
}
