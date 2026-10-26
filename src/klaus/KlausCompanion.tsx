import { useEffect, useMemo, useRef, useState } from 'react';
import type { NetState } from '../net.ts';
import { KlausEvents, restingReaction, type KlausReaction } from './events.ts';
import { KlausComments, REACTION_LABELS } from './comments.ts';
import { KlausFigure } from './KlausFigure.tsx';
import { useEffectsEnabled } from '../brand/effects.ts';
import { readKlausPreferences, saveKlausPreferences, type KlausPreferences } from './preferences.ts';

export interface KlausModel { reaction: KlausReaction; comment: string; id: string; streak: number; announce: boolean }

/** The view is already the player's public server snapshot. No question bank or answer inference. */
export function KlausCompanion({ state }: { state?: Pick<NetState, 'view' | 'conn'> }) {
  const view = state?.view ?? null;
  const [events] = useState(() => new KlausEvents());
  const [comments] = useState(() => new KlausComments());
  const [active, setActive] = useState<{ model: KlausModel; screen: string } | null>(null);
  const screen = `${view?.code ?? 'setup'}:${view?.qNo ?? 0}:${view?.phase ?? 'welcome'}`;
  const base = state?.conn === 'offline' ? 'idle' : restingReaction(view);
  const baseComment = useMemo(() => comments.next(base), [base, comments]);
  useEffect(() => {
    const event = events.observe(view);
    if (!event) return;
    setActive({ model: { reaction: event.kind, comment: comments.next(event.kind), id: event.id, streak: event.streak, announce: true }, screen });
  }, [view, events, comments, screen]);
  const eventId = active?.model.id;
  useEffect(() => {
    if (!eventId) return;
    const timer = setTimeout(() => setActive((value) => value?.model.id === eventId ? null : value), 5200);
    return () => clearTimeout(timer);
  }, [eventId]);
  const restingModel: KlausModel = {
    reaction: base, comment: state?.conn === 'offline' ? 'La conexión está descansando. Yo me quedo aquí; retomamos cuando vuelva.'
      : view?.phase === 'final' ? 'Práctica terminada. Puedes revisar tu resumen con calma. Buen descanso, equipo.' : baseComment,
    id: `rest:${screen}:${base}`, streak: view?.players.find((p) => p.id === view.me?.id)?.streak ?? 0, announce: false,
  };
  const model = active?.screen === screen ? active.model : restingModel;
  return <KlausPanel model={model} restingModel={restingModel} />;
}

/** Presentational shell shared by real practice and the explicitly labelled preview. */
export function KlausPanel({ model: incomingModel, restingModel }: { model: KlausModel; restingModel?: KlausModel }) {
  const [preferences, setPreferences] = useState(readKlausPreferences);
  const effectsEnabled = useEffectsEnabled();
  const [consumedVisualId, setConsumedVisualId] = useState<string | null>(() => preferences.hidden ? incomingModel.id : null);
  useEffect(() => {
    // Hidden events are consumed, not queued for a fresh figure mount on show.
    if (preferences.hidden || !effectsEnabled) setConsumedVisualId(incomingModel.id);
  }, [preferences.hidden, effectsEnabled, incomingModel.id]);
  const model = consumedVisualId === incomingModel.id && incomingModel.announce
    ? restingModel ?? { reaction: 'idle' as const, comment: 'Aquí seguimos, paso a paso.', id: `rest:${incomingModel.id}`, streak: incomingModel.streak, announce: false }
    : incomingModel;
  const [systemReduced, setSystemReduced] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const audio = useRef<AudioContext | null>(null);
  const sounded = useRef<string | null>(null);
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setSystemReduced(query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  useEffect(() => () => { void audio.current?.close(); }, []);
  useEffect(() => {
    if (preferences.muted || preferences.hidden || audio.current?.state === 'running') return;
    // A stored opt-in still needs a fresh browser gesture after reload. Unlock only;
    // never replay the restored reaction or play a test tone here.
    const unlock = () => {
      try { audio.current ??= new AudioContext(); void audio.current.resume(); } catch { /* Silent fallback. */ }
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, [preferences.muted, preferences.hidden]);
  useEffect(() => {
    // Mark even hidden/muted events consumed: toggling a preference never replays one.
    if (sounded.current === incomingModel.id) return;
    sounded.current = incomingModel.id;
    const ac = audio.current;
    if (preferences.muted || preferences.hidden || !incomingModel.announce || !ac || ac.state !== 'running') return;
    const frequencies = incomingModel.reaction === 'support' ? [330, 392] : incomingModel.reaction.startsWith('streak') || incomingModel.reaction === 'complete' ? [523, 659, 784] : [523, 659];
    frequencies.forEach((frequency, index) => {
      const oscillator = ac.createOscillator();
      const gain = ac.createGain();
      const start = ac.currentTime + index * .09;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.exponentialRampToValueAtTime(.018, start + .012);
      gain.gain.exponentialRampToValueAtTime(.0001, start + .15);
      oscillator.connect(gain).connect(ac.destination);
      oscillator.start(start); oscillator.stop(start + .16);
    });
  }, [incomingModel.id, incomingModel.reaction, incomingModel.announce, preferences.hidden, preferences.muted]);
  const update = (patch: Partial<KlausPreferences>) => {
    const next = { ...preferences, ...patch };
    // Consume synchronously on hide, and cover a result arriving just before show.
    if (next.hidden || preferences.hidden) setConsumedVisualId(incomingModel.id);
    saveKlausPreferences(next); setPreferences(next);
    if (next.muted || next.hidden) { void audio.current?.suspend(); }
    else if (!next.muted && (patch.muted === false || patch.hidden === false)) {
      // WebAudio is only created from this explicit user gesture, never autoplayed.
      try { audio.current ??= new AudioContext(); void audio.current.resume(); } catch { /* Silent fallback. */ }
    }
  };
  const reducedMotion = !effectsEnabled || systemReduced || preferences.still;
  return <aside className={`klaus-companion${preferences.hidden ? ' is-hidden' : ''}`} aria-label="Klaus, tu compañero de práctica"
    data-klaus-panel="" data-klaus-state={preferences.hidden ? 'hidden' : model.reaction} data-klaus-event={model.id}
    data-klaus-muted={preferences.muted ? 'true' : 'false'} data-klaus-reduced={reducedMotion ? 'true' : 'false'}
    onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') event.stopPropagation(); }}>
    {!preferences.hidden && <>
      <div className="klaus-portrait"><KlausFigure key={model.id} reaction={model.reaction} reducedMotion={reducedMotion} /></div>
      <div className="klaus-copy">
        <span className="klaus-wordmark">KLAUS <span>// DEIN LERNBUDDY</span></span>
        <div className="klaus-caption"><strong>{REACTION_LABELS[model.reaction]}</strong>
          {model.streak > 0 && <span className="klaus-streak-badge" data-klaus-streak={model.streak} aria-label={`Racha actual: ${model.streak} aciertos seguidos`}>×{model.streak}</span>}
        </div>
        <p className="klaus-comment" data-klaus-comment="" aria-live={model.announce ? 'polite' : 'off'} aria-atomic="true">{model.comment}</p>
      </div>
    </>}
    <details className="klaus-preferences" data-klaus-preferences="" onKeyDown={(event) => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); event.stopPropagation(); } }}>
      <summary aria-label="Ajustes de Klaus">{preferences.hidden ? 'Mostrar a Klaus · ajustes' : 'Ajustes de Klaus'}<span aria-hidden="true"> ⋯</span></summary>
      <div className="klaus-controls" aria-label="Preferencias de Klaus">
      {!preferences.hidden && <>
        <button type="button" data-klaus-control="mute" role="switch" aria-checked={!preferences.muted} aria-label="Sonido de Klaus" title="Solo efectos de Klaus; el sonido del juego se controla por separado" onClick={() => update({ muted: !preferences.muted })}>{preferences.muted ? 'Sonido: no' : 'Sonido: sí'}</button>
        <button type="button" data-klaus-control="motion" aria-pressed={preferences.still || systemReduced} disabled={systemReduced} title={systemReduced ? 'Se respeta la preferencia de movimiento reducido de tu sistema' : 'Reducir el movimiento de Klaus'} onClick={() => update({ still: !preferences.still })}>{reducedMotion ? 'Movimiento: mínimo' : 'Reducir movimiento'}</button>
      </>}
      <button type="button" data-klaus-control="hide" aria-pressed={preferences.hidden} onClick={() => update({ hidden: !preferences.hidden })}>{preferences.hidden ? 'Mostrar a Klaus' : 'Ocultar a Klaus'}</button>
      </div>
    </details>
  </aside>;
}
