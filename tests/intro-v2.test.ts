import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as intro from '../src/brand/Intro.tsx';
import { INTRO_MS, shouldShowIntro } from '../src/brand/Intro.tsx';

afterEach(() => vi.unstubAllGlobals());
function browser() {
  vi.stubGlobal('window', {});
  vi.stubGlobal('sessionStorage', { getItem: () => null });
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
}

describe('cinematic intro eligibility', () => {
  it('exports a visible accessible replay button for the landing page', () => {
    expect(intro).toHaveProperty('IntroReplayButton');
    const Button = (intro as unknown as { IntroReplayButton: () => ReturnType<typeof createElement> }).IntroReplayButton;
    const html = renderToStaticMarkup(createElement(Button));
    expect(html).toContain('Repetir intro');
    expect(html).toContain('data-intro-replay');
    expect(html).toContain('type="button"');
  });
  it('allows a deliberate five-to-seven second visual story rather than a loading spinner', () => {
    expect(INTRO_MS).toBeGreaterThanOrEqual(5000);
    expect(INTRO_MS).toBeLessThanOrEqual(7000);
  });
  it('does not allow forced URLs to override reduced-motion preferences', () => {
    browser();
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    expect(shouldShowIntro('/', '?intro=1')).toBe(false);
    expect(shouldShowIntro('/', '?intro=still')).toBe(false);
  });
  it('never covers an invitation, classroom, or assessment even when a replay URL is forced', () => {
    browser();
    expect(shouldShowIntro('/', '?sala=TEST&intro=1')).toBe(false);
    expect(shouldShowIntro('/road-to-b1', '?intro=1')).toBe(false);
    expect(shouldShowIntro('/jugar', '?intro=still')).toBe(false);
    expect(shouldShowIntro('/practica', '?intro=1')).toBe(false);
    expect(shouldShowIntro('/', '?intro=1')).toBe(true);
  });
});
