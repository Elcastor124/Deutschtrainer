import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EffectsToggle } from '../src/brand/EffectsToggle.tsx';

describe('ambient effects control', () => {
  it('provides a visible native compact switch with a stable accessible name', () => {
    const html = renderToStaticMarkup(createElement(EffectsToggle));
    expect(html).toContain('type="button"');
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-label="Efectos visuales"');
    expect(html).toContain('aria-checked="false"');
    expect(html).toMatch(/Efectos:.*no/);
    expect(html).toContain('data-effects-toggle');
    expect(html).toContain('disabled');
    expect(html).toContain('Movimiento reducido del sistema');
  });
});
