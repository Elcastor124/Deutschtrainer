import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import KlausShowcase from '../src/klaus/KlausShowcase.tsx';

describe('approval preview integration', () => {
  it('mounts the labelled character lab in the existing app', () => {
    const source = readFileSync('src/App.tsx', 'utf8');
    expect(source).toContain("'./klaus/KlausShowcase.tsx'");
    expect(source).toContain('/preview/klaus');
    const html = renderToStaticMarkup(createElement(KlausShowcase));
    expect(html).toContain('No cambia tu práctica');
    expect(html.match(/data-klaus-demo=/g)).toHaveLength(9);
  });
  it('provides a visible replay control on the landing page', () => {
    const source = readFileSync('src/views/Landing.tsx', 'utf8');
    expect(source).toContain('IntroReplayButton');
    expect(source).toContain('<IntroReplayButton');
  });
});
