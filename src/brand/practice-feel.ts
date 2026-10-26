import type { RoomView } from '../../shared/types.ts';
import { KlausEvents } from '../klaus/events.ts';

export interface PracticeFeedback { id: string; kind: 'correct' | 'support' | 'milestone' | 'complete'; streak: number }

/** Use the same occurrence-aware authoritative observer as Klaus, not a parallel grading path. */
export class PracticeFeelEvents {
  private events = new KlausEvents();
  observe(view: RoomView | null, enabled = true): PracticeFeedback | null {
    const event = this.events.observe(view); // Disabled effects consume events too; re-enabling never replays one.
    if (!event || !enabled) return null;
    const kind = event.kind.startsWith('streak') ? 'milestone' : event.kind;
    if (kind !== 'correct' && kind !== 'support' && kind !== 'milestone' && kind !== 'complete') return null;
    return { id: event.id, kind, streak: event.streak };
  }
}

export interface PracticeMomentum { done: number; correct: number; total: number; percent: number }

/** Read-only presentation of public progress. Never predicts grades or awards points. */
export function practiceMomentum(view: RoomView): PracticeMomentum | null {
  if (view.mode !== 'practice' || !view.practice) return null;
  const total = Math.max(1, view.practice.size ?? view.qTotal);
  const done = Math.max(0, Math.min(total, view.practice.done));
  const correct = Math.max(0, Math.min(done, view.practice.correct));
  return { done, correct, total, percent: done / total * 100 };
}
