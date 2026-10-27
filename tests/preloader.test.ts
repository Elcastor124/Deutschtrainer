import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DT_MARK } from '../src/brand/logo-mark.ts';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('boot preloader', () => {
  it('paints before any script and uses the canonical logo geometry', () => {
    expect(html).toMatch(/<html[^>]*class="dt-booting"/);
    expect(html.indexOf('data-preloader')).toBeLessThan(html.indexOf('src="/src/main.tsx"'));
    for (const d of [DT_MARK.notebook, DT_MARK.peak, DT_MARK.spine, DT_MARK.pageTurn, DT_MARK.pencil, DT_MARK.tip, ...DT_MARK.lines]) expect(html).toContain(`d="${d}"`);
  });
  it('is announced politely, never traps focus, and has a CSS failsafe', () => {
    expect(html).toContain('role="status"');
    expect(html).toContain('pointer-events: none');
    expect(html).toContain('dt-pre-failsafe');
    expect(html).toContain('prefers-reduced-motion');
  });
});
