import { describe, expect, it } from 'vitest';
import { ambientAllowed, ambientBufferSize, ambientCanRun } from '../src/brand/ambient-policy.ts';

describe('ambient route policy', () => {
  it('only admits the actual homepage without a sala invitation', () => {
    expect(ambientAllowed('/', '')).toBe(true);
    expect(ambientAllowed('/', '?intro=still')).toBe(true);
    for (const path of ['/curso', '/practica', '/jugar', '/jenga', '/boxeo', '/road-to-b1', '/tema/1', '/preview/klaus', '//']) {
      expect(ambientAllowed(path, '')).toBe(false);
    }
    for (const search of ['?sala=CLASS', '?sala=', '?intro=1&sala=ROOM', '?%73ala=ROOM']) {
      expect(ambientAllowed('/', search)).toBe(false);
    }
  });
  it('requires every runtime guard before drawing', () => {
    const ready = { eligible: true, effects: true, visible: true, inViewport: true, contextLost: false };
    expect(ambientCanRun(ready)).toBe(true);
    for (const flag of ['eligible', 'effects', 'visible', 'inViewport'] as const) {
      expect(ambientCanRun({ ...ready, [flag]: false })).toBe(false);
    }
    expect(ambientCanRun({ ...ready, contextLost: true })).toBe(false);
  });
  it('keeps the ambient backbuffer small on retina and ultrawide screens', () => {
    const phone = ambientBufferSize(390, 844, 4);
    expect(phone.width).toBeLessThan(390);
    expect(phone.height).toBeLessThan(844);
    for (const [width, height, dpr] of [[3840, 2160, 4], [1920, 1080, 2], [8000, 6000, 8], [0, 0, 0], [NaN, Infinity, NaN]]) {
      const size = ambientBufferSize(width, height, dpr);
      expect(Number.isFinite(size.width * size.height)).toBe(true);
      expect(size.width).toBeGreaterThanOrEqual(1);
      expect(size.height).toBeGreaterThanOrEqual(1);
      expect(size.width).toBeLessThanOrEqual(960);
      expect(size.height).toBeLessThanOrEqual(640);
      expect(size.width * size.height).toBeLessThanOrEqual(460800);
    }
    expect(ambientBufferSize(1920, 1080, 8)).toEqual(ambientBufferSize(1920, 1080, 1.25));
  });
});
