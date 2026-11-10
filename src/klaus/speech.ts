// Voz de Klaus en el navegador (Web Speech API, gratis y local). Solo se habla cuando el alumno lo pide: nunca hay autoplay.
// Si el navegador no tiene una voz alemana, se dice así en vez de leer el alemán con una voz española.
import { useSyncExternalStore } from 'react';

export type SpeechLang = 'de' | 'es';
export interface Spoken { text: string; lang: SpeechLang; focus?: string }

const supported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
const listeners = new Set<() => void>();
let snapshot = '';
function read(): string {
  if (!supported()) return 'none';
  const vs = speechSynthesis.getVoices();
  const has = (l: string) => vs.some((v) => v.lang.toLowerCase().replace('_', '-').startsWith(l));
  return `${has('de') ? 'de' : ''}${has('es') ? '+es' : ''}` || 'none';
}
function subscribe(fn: () => void) {
  listeners.add(fn);
  if (supported() && listeners.size === 1) speechSynthesis.addEventListener?.('voiceschanged', notify);
  return () => { listeners.delete(fn); if (supported() && !listeners.size) speechSynthesis.removeEventListener?.('voiceschanged', notify); };
}
function notify() { const next = read(); if (next !== snapshot) { snapshot = next; listeners.forEach((l) => l()); } }
const get = () => (snapshot ||= read());

/** Qué voces tiene este navegador: 'none' | 'de' | '+es' | 'de+es'. */
export function useBrowserVoices(): { de: boolean; es: boolean } {
  const v = useSyncExternalStore(subscribe, get, () => 'none');
  return { de: v.startsWith('de'), es: v.includes('es') };
}

const voiceFor = (lang: SpeechLang) => {
  const vs = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith(lang));
  return vs.find((v) => /de-DE|es-ES/i.test(v.lang) && /natural|neural|online/i.test(v.name)) ?? vs.find((v) => /de-DE|es-ES/i.test(v.lang)) ?? vs[0] ?? null;
};

/** Lee los segmentos en orden con la voz de su idioma. `onSegment(i)` se llama al empezar cada uno (para resaltar). Devuelve cancelar. */
export function speak(segments: Spoken[], onSegment?: (i: number) => void, onEnd?: () => void): () => void {
  if (!supported() || !segments.length) { onEnd?.(); return () => {}; }
  speechSynthesis.cancel();
  let cancelled = false;
  segments.forEach((s, i) => {
    const u = new SpeechSynthesisUtterance(s.text);
    const v = voiceFor(s.lang);
    u.lang = s.lang === 'de' ? 'de-DE' : 'es-ES';
    if (v) u.voice = v;
    u.rate = s.lang === 'de' ? 0.92 : 1;
    u.onstart = () => { if (!cancelled) onSegment?.(i); };
    if (i === segments.length - 1) { u.onend = () => { if (!cancelled) onEnd?.(); }; u.onerror = () => { if (!cancelled) onEnd?.(); }; }
    speechSynthesis.speak(u);
  });
  return () => { cancelled = true; speechSynthesis.cancel(); };
}
export const stopSpeaking = () => { if (supported()) speechSynthesis.cancel(); };
