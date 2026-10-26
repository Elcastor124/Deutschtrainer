import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BrandSymbol } from '../src/brand/Logo.tsx';

describe('sketch-derived Deutschtrainer identity', () => {
  it('draws a D notebook and a T pencil inside an architectural A, not the old Punkt-D', () => {
    const html = renderToStaticMarkup(createElement(BrandSymbol, { animated: true, title: 'Deutschtrainer' }));
    expect(html).toContain('data-brand-symbol="dt-pencil-book"');
    for (const part of ['a-peak', 'd-notebook', 't-pencil', 'pencil-tip', 'notebook-lines']) {
      expect(html).toContain(`data-brand-part="${part}"`);
    }
    expect(html).toContain('pathLength="1"');
    expect(html).not.toContain('dt-sym-dot');
    expect(html).toContain('aria-label="Deutschtrainer"');
  });
});
