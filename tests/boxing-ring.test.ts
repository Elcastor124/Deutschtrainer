import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { BoxingRing, boxingPose, resolutionKey } from '../src/components/BoxingRing.tsx';
import type { BoxingResolution } from '../shared/boxing.ts';

const result: BoxingResolution = { exchange: 1, explanation: 'Regel', answer: 'Lösung', fighters: [{ id: 'a', move: 'jab', correct: true, damageDealt: 8, damageTaken: 0, blocked: false, dodged: false }] };
describe('articulated boxing ring', () => {
  it('extends the jab arm and bends the torso for a dodge, not randomly chosen moves', () => {
    const idle = boxingPose('idle', 0, 0);
    const jab = boxingPose('jab', 0.42, 0);
    const dodge = boxingPose('dodge', 0.42, 0);
    expect(jab.frontHand[0]).toBeGreaterThan(idle.frontHand[0] + 60);
    expect(Math.abs(dodge.lean)).toBeGreaterThan(15);
    expect(boxingPose('guard', 0.42, 0).frontHand[1]).toBeLessThan(idle.frontHand[1]);
  });
  it('has a stable exchange identity across cloned poll snapshots', () => {
    expect(resolutionKey(result)).toBe(resolutionKey(structuredClone(result)));
    expect(resolutionKey({ ...result, exchange: 2 })).not.toBe(resolutionKey(result));
  });
  it('renders vector ring geometry and accessible context without a token or a solution', () => {
    const html = renderToStaticMarkup(createElement(BoxingRing, { fighters: [], result, paused: false, sound: false }));
    expect(html).toContain('<svg');
    expect(html).toContain('Ring de boxeo');
    expect(html).not.toContain('Lösung');
    expect(html).not.toContain('Regel');
    expect(html).not.toContain('<img');
  });
});
