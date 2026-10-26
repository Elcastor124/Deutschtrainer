import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { KlausFigure } from '../src/klaus/KlausFigure.tsx';

describe('canonical Klaus vector port', () => {
  const render = (reaction: Parameters<typeof KlausFigure>[0]['reaction'] = 'idle', reducedMotion = false) =>
    renderToStaticMarkup(createElement(KlausFigure, { reaction, reducedMotion }));
  it('preserves the supplied signature paths, proportions, central dot and open caret eyes', () => {
    const html = render();
    for (const geometry of [
      '20,35 31,8 42,35', '58,35 69,8 80,35', 'M45.5 35H54.5',
      'M15 41Q4 55 15 70', 'M85 41Q96 55 85 70',
      'M32.5 50.5L36.5 43L40.5 50.5', 'M59.5 50.5L63.5 43L67.5 50.5',
      'M20 84L31 91L20 98', 'M80 84L69 91L80 98', 'M44 85L47 100L50 90L53 100L56 85',
    ]) expect(html).toContain(geometry);
    expect(html).toContain('cx="50" cy="62.5"');
    expect(html).toContain('scale(1.2 1)');
    expect(html).toContain('klaus-eye-open');
    expect(html).toContain('klaus-eye-shut');
    expect(html).not.toContain('<text'); // no font-dependent imitation of the face
  });
  it('waves a closed contoured paw with four toe beans and a central pad, not a stump', () => {
    const html = render('waving');
    expect(html).toContain('data-klaus-paw=""');
    expect((html.match(/data-klaus-toe=""/g) ?? []).length).toBe(4);
    expect(html).toContain('data-klaus-pad=""');
    expect(html).toContain('M-3.3 1C-3.5 -8 -3 -18 -2.4 -28');
  });
  it('uses gentle professor / fire / royal reactions without hiding the signature W', () => {
    expect(render('thinking')).toContain('data-klaus-skin="professor"');
    expect(render('streak5')).toContain('data-klaus-skin="fire"');
    const royal = render('streak10');
    expect(royal).toContain('data-klaus-skin="royal"');
    expect(royal).toContain('data-klaus-crown=""');
    expect(royal).toContain('M44 85L47 100L50 90L53 100L56 85');
  });
  it('renders reduced-motion poses without animated bursts while keeping the state legible', () => {
    const html = render('streak10', true);
    expect(html).toContain('data-klaus-motion="reduced"');
    expect(html).not.toContain('data-klaus-burst');
    expect(html).toContain('data-klaus-crown');
    expect(html).toContain('aria-hidden="true"');
  });
});
