import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AmbientField } from '../src/brand/AmbientField.tsx';

describe('ambient field safe rendering', () => {
  it('leaves the homepage a purely decorative static layer until browser policy is known', () => {
    const html = renderToStaticMarkup(createElement(AmbientField, { path: '/', search: '' }));
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('data-ambient-status="still"');
    expect(html).toContain('data-ambient-frames="0"');
    expect(html).not.toContain('<canvas');
    expect(html).not.toContain('tabindex');
  });
  it('renders no ambient layer for a classroom invitation or any learning/game route', () => {
    for (const [path, search] of [['/', '?sala=ROOM'], ['/', '?sala='], ['/practica', ''], ['/jugar', ''], ['/curso', ''], ['/road-to-b1', '']]) {
      expect(renderToStaticMarkup(createElement(AmbientField, { path, search }))).toBe('');
    }
  });
});
