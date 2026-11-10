// Modo voz de Redet («como ChatGPT»): escuchar → enviar → Klaus habla → volver a escuchar, sin tocar nada.
// Usa el reconocimiento de voz del navegador (Web Speech API, gratis; en Chrome/Edge el audio lo procesa el servicio del
// navegador) y la voz alemana del navegador para Klaus. Solo se activa cuando el alumno pulsa el botón: nunca hay autoplay.
import { useCallback, useEffect, useRef, useState } from 'react';
import { speak, stopSpeaking } from './speech.ts';

type Rec = {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null; onspeechstart?: (() => void) | null;
};
type RecCtor = new () => Rec;
const Ctor = (): RecCtor | null => (typeof window === 'undefined' ? null : ((window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor }).SpeechRecognition
  ?? (window as unknown as { webkitSpeechRecognition?: RecCtor }).webkitSpeechRecognition ?? null));
export const browserSttSupported = () => !!Ctor();

export type VoicePhase = 'off' | 'listening' | 'thinking' | 'speaking' | 'paused';

/**
 * Bucle de conversación por voz. `send(text)` manda el turno y devuelve la respuesta de Klaus (o null si falló).
 * Tras un silencio de ~1,4 s con algo dicho, se envía solo. Si el alumno habla mientras Klaus habla, Klaus se calla.
 */
export function useVoiceLoop(send: (text: string) => Promise<string | null>, opts: { speakReply: (text: string, onEnd: () => void) => void }) {
  const [phase, setPhase] = useState<VoicePhase>('off');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Rec | null>(null);
  const live = useRef(false);            // el modo voz está activo
  const heard = useRef('');               // texto final acumulado del turno
  const silence = useRef<number | null>(null);
  const sendRef = useRef(send); sendRef.current = send;
  const speakRef = useRef(opts.speakReply); speakRef.current = opts.speakReply;

  const clearSilence = () => { if (silence.current) { clearTimeout(silence.current); silence.current = null; } };
  const listen = useCallback(() => {
    const C = Ctor(); if (!C || !live.current) return;
    rec.current?.abort();
    const r = new C(); rec.current = r;
    r.lang = 'de-DE'; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
    heard.current = ''; setInterim(''); setPhase('listening');
    r.onresult = (e) => {
      let fin = '', tmp = '';
      for (let i = 0; i < e.results.length; i++) { const res = e.results[i]; const t = res[0]?.transcript ?? ''; if (res.isFinal) fin += t; else tmp += t; }
      heard.current = fin.trim(); setInterim(`${fin}${tmp}`.trim());
      clearSilence();
      if (`${fin}${tmp}`.trim()) silence.current = window.setTimeout(() => { r.stop(); }, 1400);
    };
    r.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      setError(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'El navegador no deja usar el micrófono. Revisa el permiso (icono del candado).' : 'El reconocimiento de voz ha fallado. Prueba otra vez o escribe.');
      live.current = false; setPhase('off');
    };
    r.onend = async () => {
      clearSilence(); if (rec.current !== r) return; rec.current = null;
      if (!live.current) { setPhase('off'); return; }
      const said = (heard.current || '').trim() || interimRef.current.trim();
      if (!said) { listen(); return; }      // silencio: seguimos escuchando
      setPhase('thinking'); setInterim(said);
      const reply = await sendRef.current(said);
      if (!live.current) return;
      if (!reply) { setPhase('paused'); return; }
      setPhase('speaking');
      speakRef.current(reply, () => { if (live.current) listen(); });
    };
    try { r.start(); } catch { /* ya arrancado */ }
  }, []);
  const interimRef = useRef(''); interimRef.current = interim;

  const start = useCallback(() => {
    if (!Ctor()) { setError('Este navegador no tiene reconocimiento de voz. Usa Chrome o Edge, o escribe.'); return; }
    setError(null); live.current = true; stopSpeaking(); listen();
  }, [listen]);
  const stop = useCallback(() => { live.current = false; clearSilence(); rec.current?.abort(); rec.current = null; stopSpeaking(); setPhase('off'); setInterim(''); }, []);
  /** Mientras Klaus habla: cortarle y escuchar ya. */
  const interrupt = useCallback(() => { stopSpeaking(); if (live.current) listen(); }, [listen]);
  /** Tras pausa por error: reintentar. */
  const resume = useCallback(() => { if (!live.current) live.current = true; listen(); }, [listen]);
  /** Terminar el turno ya (sin esperar al silencio). */
  const done = useCallback(() => { clearSilence(); rec.current?.stop(); }, []);

  useEffect(() => () => { live.current = false; rec.current?.abort(); stopSpeaking(); }, []);
  return { phase, interim, error, start, stop, interrupt, resume, done, supported: browserSttSupported() };
}

/** Voz de Klaus en alemán con la voz del navegador. */
export const speakGerman = (text: string, onEnd: () => void) => speak([{ text, lang: 'de' }], undefined, onEnd);
