import { useEffect, useRef, useState } from 'react';
import type { RoomView } from '../../shared/types.ts';
import { PracticeFeelEvents, type PracticeFeedback } from './practice-feel.ts';
import { useEffectsEnabled } from './effects.ts';

/** Consume events even when paused. A restored reveal is never a new celebration. */
export function usePracticeFeedback(view: RoomView | null) {
  const enabled = useEffectsEnabled();
  const observer = useRef(new PracticeFeelEvents());
  const [active, setActive] = useState<{ event: PracticeFeedback; screen: string } | null>(null);
  const screen = `${view?.code ?? ''}:${view?.qNo ?? 0}:${view?.practice?.done ?? 0}:${view?.phase ?? ''}`;
  useEffect(() => {
    const event = observer.current.observe(view, enabled);
    if (!enabled) setActive(null);
    else if (event) setActive({ event, screen });
  }, [view, enabled, screen]);
  return enabled && active?.screen === screen ? active.event : null;
}
