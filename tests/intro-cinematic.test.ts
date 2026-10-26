import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Intro, INTRO_CUES, INTRO_EXIT_MS, INTRO_MS, shouldShowIntro } from '../src/brand/Intro.tsx';
import { DT_MARK } from '../src/brand/logo-mark.ts';

// Server rendering has no browser preference snapshot; geometry remains testable.
vi.mock('../src/brand/effects.ts', async (original) => ({
  ...await original<typeof import('../src/brand/effects.ts')>(),
  useEffectsEnabled: () => true,
}));

afterEach(() => vi.unstubAllGlobals());

function browser(effects: 'on' | 'off' = 'on') {
  const localStorage = { getItem: (key: string) => key === 'dt:effects' ? effects : null };
  const matchMedia = () => ({ matches: false });
  vi.stubGlobal('window', { localStorage, matchMedia });
  vi.stubGlobal('sessionStorage', { getItem: () => null });
  vi.stubGlobal('localStorage', localStorage);
  vi.stubGlobal('matchMedia', matchMedia);
}

describe('intro cinematic effects contract', () => {
  it('never lets a forced or held intro override the global effects-off preference', () => {
    browser('off');
    expect(shouldShowIntro('/', '?intro=1')).toBe(false);
    expect(shouldShowIntro('/', '?intro=still')).toBe(false);
    expect(shouldShowIntro('/curso', '?intro=1')).toBe(false);
  });
});

describe('intro cinematic composition', () => {
  it('retains the exact nominal story cues and 6200ms including the final 460ms handoff', () => {
    expect(INTRO_MS).toBe(6200);
    expect(INTRO_EXIT_MS).toBe(460);
    expect(INTRO_CUES).toEqual([
      { at: 0, name: 'draft' },
      { at: 800, name: 'letters' },
      { at: 2000, name: 'notebook' },
      { at: 3200, name: 'signature' },
      { at: 4600, name: 'hold' },
    ]);
  });
  it('converges fine red/gold energy from all four edges into the emblem, without replacing its canonical paths', () => {
    browser();
    const html = renderToStaticMarkup(createElement(Intro, { path: '/', search: '?intro=still' }));
    expect(html).toContain('data-intro-convergence');
    for (const edge of ['left', 'right', 'top', 'bottom']) {
      expect(html).toContain(`data-intro-edge="${edge}"`);
    }
    expect(html.match(/data-intro-beam="(?:red|gold)"/g)?.length).toBeGreaterThanOrEqual(8);
    expect(html).toContain('data-brand-symbol="dt-pencil-book"');
    for (const part of ['d-notebook', 'a-peak', 't-stem', 't-pencil', 'notebook-lines']) {
      expect(html).toContain(`data-brand-part="${part}"`);
    }
    for (const path of [DT_MARK.notebook, DT_MARK.peak, DT_MARK.spine, DT_MARK.pencil, ...DT_MARK.lines]) {
      expect(html).toContain(`d="${path}"`);
    }
  });
});
