import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PracticeProgress } from '../src/brand/PracticeProgress.tsx';
import { practiceMomentum, PracticeFeelEvents } from '../src/brand/practice-feel.ts';
import { correct, setup } from './helpers.ts';
import type { Player } from '../server/room.ts';

describe('practice momentum uses public server progress', () => {
  it('renders an accessible determinate bar and no fake rewards', () => {
    const { room } = setup('practice');
    const player = room.join('Momentum', 'momentum-test') as Player;
    room.startPractice(player, [], false, {}, 10);
    const html = renderToStaticMarkup(createElement(PracticeProgress, { view: room.view({ pid: player.id }) }));
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="0"');
    expect(html).toContain('aria-valuemax="10"');
    expect(html).toContain('0 completadas de 10');
    expect(html).toContain('0 aciertos');
    expect(html).not.toMatch(/XP|recompensa/);
  });
  it('starts at zero completed rather than inventing progress for the current question', () => {
    const { room } = setup('practice');
    const player = room.join('Momentum', 'momentum-test') as Player;
    room.startPractice(player, [], false, {}, 10);
    expect(practiceMomentum(room.view({ pid: player.id }))).toEqual({ done: 0, correct: 0, total: 10, percent: 0 });
  });
  it('does not queue feedback while effects are off, and resumes only on the next genuine result', () => {
    const { room } = setup('practice');
    const player = room.join('Momentum', 'momentum-test') as Player;
    room.startPractice(player, [], false, {}, 10);
    const events = new PracticeFeelEvents();
    const view = () => room.view({ pid: player.id });
    events.observe(view());
    const answer = () => {
      expect(room.answer(player.id, room.question!.id, correct(room.question!, room.s.q!.inst)).ok).toBe(true);
      if (room.s.phase === 'review') room.judgeAll(true);
    };
    answer();
    expect(events.observe(view(), false)).toBeNull();
    expect(events.observe(view(), true)).toBeNull();
    expect(practiceMomentum(view())).toEqual({ done: 1, correct: 1, total: 10, percent: 10 });
    room.practiceNext();
    events.observe(view());
    answer();
    expect(events.observe(view())).toMatchObject({ kind: 'correct', streak: 2 });
    expect(events.observe(structuredClone(view()))).toBeNull();
    expect(new PracticeFeelEvents().observe(view())).toBeNull();
  });
});
