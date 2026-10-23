import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BoxingArena } from '../src/views/Boxing.tsx';
import type { BoxingView } from '../shared/boxing.ts';

const view: BoxingView = { code: 'TEST', role: 'player', me: 'a', phase: 'question', exchange: 1, maxExchanges: 8, paused: false,
  fighters: [{ id: 'a', name: '<script>Ana</script>', hp: 100, stamina: 1, correct: 0, wrong: 0, damage: 0, connected: true, answered: false, lockedMove: false }, { id: 'b', name: 'Ben', hp: 100, stamina: 3, correct: 0, wrong: 0, damage: 0, connected: true, answered: false, lockedMove: false }],
  question: { id: 'q1', prompt: 'Ich ___ in Berlin.', options: ['wohne', 'wohnt'], topic: 'Verben' },
  result: { exchange: 0, answer: 'SPOILER', explanation: 'SECRET_RULE', fighters: [] } };
const render = (patch: Partial<BoxingView> = {}) => renderToStaticMarkup(createElement(BoxingArena, { view: { ...view, ...patch }, busy: false, sound: false, onAction: () => {} }));
describe('boxing classroom presentation', () => {
  it('escapes names, offers answers without exposing stale solutions or opponent choices', () => {
    const html = render();
    expect(html).toContain('Ich ___ in Berlin.');
    expect(html).toContain('&lt;script&gt;Ana&lt;/script&gt;');
    expect(html).not.toContain('SPOILER');
    expect(html).not.toContain('SECRET_RULE');
    expect(html).not.toContain('<script>Ana');
    expect(html).toContain('data-answer="0"');
  });
  it('locks answers after submission and keeps the teacher options read-only', () => {
    expect(render({ ownAnswer: 0 })).toMatch(/data-answer="1"[^>]*disabled/);
    const html = render({ role: 'teacher', me: undefined });
    expect(html).not.toContain('data-answer=');
    expect(html).toContain('Cerrar sin responder');
  });
  it('unlocks only affordable moves for correct players in the action phase', () => {
    const html = render({ phase: 'action', ownCorrect: true, ownAnswer: 0 });
    expect(html).toMatch(/data-move-choice="jab"(?![^>]*disabled)/);
    expect(html).toMatch(/data-move-choice="hook"[^>]*disabled/);
    expect(render({ phase: 'action', ownCorrect: false })).not.toContain('data-move-choice=');
  });
  it('reveals the solution and a score ranking only after resolution', () => {
    const html = render({ phase: 'result' });
    expect(html).toContain('SPOILER');
    expect(html).toContain('SECRET_RULE');
    expect(html).toContain('Clasificación');
  });
});
