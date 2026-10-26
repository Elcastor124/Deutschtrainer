import { describe, expect, it } from 'vitest';
import { KlausComments, REACTION_LABELS } from '../src/klaus/comments.ts';
import type { KlausReaction } from '../src/klaus/events.ts';

describe('supportive local Klaus comments', () => {
  it('rotates deterministically without immediate duplicates for repeated successes or errors', () => {
    const a = new KlausComments();
    const b = new KlausComments();
    const values: string[] = [];
    for (let n = 0; n < 24; n++) {
      const kind = n < 12 ? 'correct' : 'support';
      const comment = a.next(kind);
      expect(comment).toBe(b.next(kind));
      expect(comment).not.toBe(values.at(-1));
      values.push(comment);
    }
    expect(new Set(values.slice(0, 12)).size).toBeGreaterThanOrEqual(6);
    expect(new Set(values.slice(12)).size).toBeGreaterThanOrEqual(6);
  });
  it('covers all poses, with no invented rewards, ridicule or answer content', () => {
    const comments = new KlausComments();
    for (const kind of ['waving', 'idle', 'thinking', 'correct', 'support', 'streak3', 'streak5', 'streak10', 'complete'] as KlausReaction[]) {
      expect(REACTION_LABELS[kind]).toBeTruthy();
      for (let n = 0; n < 10; n++) {
        const text = comments.next(kind);
        expect(text.length).toBeGreaterThan(15);
        expect(text.length).toBeLessThan(155);
        expect(text).not.toMatch(/tonto|idiota|fracaso|desbloque|monedas|\+\d|solución:/i);
      }
    }
  });
});
