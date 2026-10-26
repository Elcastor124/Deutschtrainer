import { describe, expect, it } from 'vitest';
import { KlausEvents, restingReaction } from '../src/klaus/events.ts';
import { correct, setup, wrong } from './helpers.ts';
import type { Player } from '../server/room.ts';

function practice() {
  const { room } = setup('practice');
  const player = room.join('Klaus test', 'klaus-test') as Player;
  room.startPractice(player, [], false, {}, 15);
  const view = () => room.view({ pid: player.id });
  const answer = (good = true) => {
    const q = room.question!;
    expect(room.answer(player.id, q.id, (good ? correct : wrong)(q, room.s.q!.inst)).ok).toBe(true);
    if (room.s.phase === 'review') room.judgeAll(good);
    return view();
  };
  return { room, player, view, answer };
}

describe('Klaus observes authoritative practice results', () => {
  it('reacts to a real correct answer once, not cloned network snapshots', () => {
    const p = practice();
    const events = new KlausEvents();
    expect(events.observe(p.view())).toBeNull();
    const result = p.answer();
    expect(events.observe(result)).toMatchObject({ kind: 'correct', streak: 1 });
    expect(events.observe(structuredClone(result))).toBeNull();
  });
  it('selects distinct 3, 5 and 10 streak celebrations from real server streaks', () => {
    const p = practice();
    const events = new KlausEvents();
    events.observe(p.view());
    const kinds: string[] = [];
    for (let n = 1; n <= 10; n++) {
      kinds.push(events.observe(p.answer())!.kind);
      p.room.practiceNext();
      events.observe(p.view());
    }
    expect(kinds).toEqual(['correct', 'correct', 'streak3', 'correct', 'streak5', 'correct', 'correct', 'correct', 'correct', 'streak10']);
  });
  it('supports mistakes and celebrates the same bank question when its deliberate review is answered', () => {
    const p = practice();
    const events = new KlausEvents();
    events.observe(p.view());
    const first = p.answer(false);
    const qid = first.q!.id;
    expect(events.observe(first)).toMatchObject({ kind: 'support', streak: 0 });
    let reviewed = false;
    for (let n = 0; n < 20; n++) {
      p.room.practiceNext();
      const v = p.view();
      events.observe(v);
      if (v.phase === 'final') break;
      const result = p.answer();
      const event = events.observe(result);
      if (v.q?.id === qid) { expect(event?.kind).not.toBe('support'); expect(event).not.toBeNull(); reviewed = true; break; }
    }
    expect(reviewed).toBe(true);
  });
  it('emits session-end once and does not replay it after reloading', () => {
    const p = practice();
    const events = new KlausEvents();
    events.observe(p.view());
    for (let n = 0; n < 15; n++) {
      events.observe(p.answer());
      p.room.practiceNext();
      if (p.view().phase !== 'final') events.observe(p.view());
    }
    expect(events.observe(p.view())).toMatchObject({ kind: 'complete' });
    expect(events.observe(structuredClone(p.view()))).toBeNull();
    expect(new KlausEvents().observe(p.view())).toBeNull();
  });
  it('never replays restored results or a stale reveal after reconnecting on the next question', () => {
    const p = practice();
    const reveal = p.answer();
    const reload = new KlausEvents();
    expect(reload.observe(reveal)).toBeNull();
    expect(reload.observe(structuredClone(reveal))).toBeNull();
    p.room.practiceNext();
    const reconnect = new KlausEvents();
    reconnect.observe(p.view());
    expect(reconnect.observe(reveal)).toBeNull();
    expect(reconnect.observe(p.answer())).toMatchObject({ kind: 'correct' });
  });
  it('returns thinking while answering or awaiting server/review, then idle after a reveal', () => {
    const p = practice();
    expect(restingReaction(null)).toBe('waving');
    expect(restingReaction(p.view())).toBe('thinking');
    expect(restingReaction({ ...p.view(), phase: 'review' })).toBe('thinking');
    expect(restingReaction(p.answer())).toBe('idle');
  });
});
