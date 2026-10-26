import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { KlausCompanion, KlausPanel } from '../src/klaus/KlausCompanion.tsx';
import KlausShowcase from '../src/klaus/KlausShowcase.tsx';

const model = { reaction: 'support' as const, comment: 'Kein Problem. Seguimos paso a paso.', id: 'real-result:4', streak: 0, announce: true };
describe('Klaus practice panel', () => {
  it('offers semantic, keyboard-native hide / mute / motion controls and a polite atomic comment', () => {
    const html = renderToStaticMarkup(createElement(KlausPanel, { model }));
    expect(html).toContain('aria-label="Klaus, tu compañero de práctica"');
    expect(html).toContain('data-klaus-control="hide"');
    expect(html).toContain('data-klaus-control="mute"');
    expect(html).toMatch(/role="switch"[^>]*aria-checked="false"/);
    expect(html).toContain('data-klaus-control="motion"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-atomic="true"');
    expect(html).toContain('type="button"');
    expect(html).toContain('data-klaus-state="support"');
    expect(html).not.toMatch(/autofocus|role="dialog"|tabindex="-1"|solución|puntos/i);
  });
  it('renders a welcome companion without a network session or fabricated score', () => {
    const html = renderToStaticMarkup(createElement(KlausCompanion, {}));
    expect(html).toContain('data-klaus-state="waving"');
    expect(html).toContain('Hallo');
    expect(html).not.toContain('data-klaus-streak');
  });
  it('exports an explicitly labelled non-gameplay preview with all nine reaction buttons', () => {
    const html = renderToStaticMarkup(createElement(KlausShowcase, {}));
    expect(html).toContain('Vista previa');
    for (const state of ['waving', 'idle', 'thinking', 'correct', 'support', 'streak3', 'streak5', 'streak10', 'complete']) {
      expect(html).toContain(`data-klaus-demo="${state}"`);
    }
    expect(html).toContain('No cambia tu práctica');
  });
});
