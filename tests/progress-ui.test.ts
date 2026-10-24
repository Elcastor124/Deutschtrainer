import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WeeklyPoints, WeeklyPointsView, type WeeklyState } from '../src/components/WeeklyPoints.tsx';
import type { MyProgress } from '../src/progress-client.ts';

const weeks = ['2026-W36', '2026-W37', '2026-W38', '2026-W39', '2026-W40', '2026-W41', '2026-W42', '2026-W43'];
const me: MyProgress = {
  known: true, name: 'Ana', code: 'ANA123', week: '2026-W43', weekPoints: 137, rank: 2, players: 3, streak: 4,
  history: weeks.map((week, i) => ({ week, points: i * 10 })),
  topics: [{ topic: 'Dativ', attempts: 4, correct: 1, accuracy: 0.25 }],
  recommended: ['Dativ', 'Wo/Wohin'],
};
const ready = (patch: Partial<MyProgress> = {}): WeeklyState => ({
  status: 'ready', me: { ...me, ...patch },
  board: { week: '2026-W43', entries: [{ rank: 1, name: '<b>Ben</b>', points: 150 }, { rank: 2, name: 'Ana', points: 137 }, { rank: 3, name: 'Cleo', points: 20 }] },
});
const render = (state: WeeklyState, compact = false) => renderToStaticMarkup(createElement(WeeklyPointsView, { state, compact }));

describe('WeeklyPoints widget', () => {
  it('shows points, streak, 8 bars, an escaped podium and recommended practice links', () => {
    const html = render(ready());
    expect(html).toContain('data-points="137"');
    expect(html).toContain('4 días');
    expect(html.match(/class="wp-bar[ "]/g)).toHaveLength(8);
    expect(html).toContain('&lt;b&gt;Ben&lt;/b&gt;');
    expect(html).not.toContain('<b>Ben');
    expect(html).toContain('Recomendado para ti');
    expect(html).toContain('href="/practica?temas=Dativ"');
    expect(html).toContain('href="/practica?temas=Wo%2FWohin"');
    expect(html).toContain('Wochenpunkte');
    expect(html).not.toContain('ANA123'); // the widget never shows profile codes
  });
  it('compact mode keeps points and streak but drops chart, podium and recommendations', () => {
    const html = render(ready(), true);
    expect(html).toContain('data-points="137"');
    expect(html).not.toContain('wp-bar');
    expect(html).not.toContain('wp-podium');
    expect(html).not.toContain('Recomendado para ti');
  });
  it('has friendly empty, loading and offline states', () => {
    expect(render(ready({ known: false, weekPoints: 0, streak: 0, rank: null, recommended: [], history: weeks.map((week) => ({ week, points: 0 })) }))).toContain('Empieza a practicar para sumar puntos');
    expect(render({ status: 'loading' })).toContain('aria-busy="true"');
    const off = render({ status: 'offline' });
    expect(off).toContain('Sin conexión con el servidor');
    expect(off).not.toContain('data-points');
  });
  it('the stateful wrapper renders a loading shell on the server', () => {
    expect(renderToStaticMarkup(createElement(WeeklyPoints, {}))).toContain('aria-busy="true"');
  });
  it('CSS uses brand variables with fallbacks, respects reduced motion and avoids overflow', () => {
    const css = readFileSync(new URL('../src/components/weekly-points.css', import.meta.url), 'utf8');
    for (const v of ['var(--signal, #FF3832)', 'var(--gold, #E9B949)', 'var(--dot,', 'var(--sans,']) expect(css).toContain(v);
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css).toMatch(/min-width:\s*0/);
    expect(css).toMatch(/overflow-wrap:\s*anywhere/);
  });
});
