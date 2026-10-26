import type { RoomView } from '../../shared/types.ts';

export type KlausReaction = 'waving' | 'idle' | 'thinking' | 'correct' | 'support' | 'streak3' | 'streak5' | 'streak10' | 'complete';
export interface KlausEvent { id: string; kind: KlausReaction; streak: number }

/** Non-event poses do not infer correctness or read any answer content. */
export function restingReaction(view: RoomView | null): KlausReaction {
  if (!view) return 'waving';
  return view.phase === 'question' || view.phase === 'review' ? 'thinking' : 'idle';
}

/** Result identity uses the question occurrence, not just its bank ID: deliberate reviews repeat IDs. */
export class KlausEvents {
  private session = '';
  private seen = new Set<string>();
  private done = -1;

  observe(view: RoomView | null): KlausEvent | null {
    if (!view?.me || view.mode !== 'practice') return null;
    const session = `${view.code}:${view.me.id}:${view.startedAt ?? ''}`;
    const done = view.practice?.done ?? 0;
    const id = `${session}:${view.qNo}:${done}`;
    const initial = session !== this.session;
    if (initial) { this.session = session; this.seen.clear(); this.done = done; }
    const streak = view.players.find((p) => p.id === view.me!.id)?.streak ?? 0;
    if (view.phase === 'final') {
      const finalId = `${session}:final`;
      if (this.seen.has(finalId)) return null;
      this.seen.add(finalId);
      return initial ? null : { id: finalId, kind: 'complete', streak };
    }
    if (view.phase !== 'reveal' || !view.reveal || view.reveal.skipped || view.reveal.qid !== view.q?.id) return null;
    const result = view.reveal.results[view.me.id];
    if (!result || result.status === 'none' || this.seen.has(id) || done <= this.done) return null;
    this.seen.add(id);
    this.done = done;
    if (initial) return null; // A restored reveal is a baseline, never a new celebration.
    const milestone: KlausReaction = streak === 3 ? 'streak3' : streak === 5 ? 'streak5' : streak === 10 ? 'streak10' : 'correct';
    return { id, kind: result.status === 'correct' ? milestone : 'support', streak };
  }
}
