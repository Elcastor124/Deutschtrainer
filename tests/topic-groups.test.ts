import { describe, expect, it } from 'vitest';
import { TOPICS } from '../shared/rules.ts';
import { TOPIC_GROUPS } from '../src/components/topic-groups.ts';

describe('categorías del selector de temas', () => {
  it('cada tema del banco está en exactamente una categoría', () => {
    const all = TOPIC_GROUPS.flatMap((g) => g.topics);
    expect([...all].sort()).toEqual(Object.keys(TOPICS).sort());
    expect(new Set(all).size).toBe(all.length);
  });
});
