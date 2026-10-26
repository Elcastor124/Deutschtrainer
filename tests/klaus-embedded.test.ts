import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { KlausPanel } from '../src/klaus/KlausCompanion.tsx';
it('keeps the three preferences inside one initially closed native disclosure', () => {
  const html = renderToStaticMarkup(createElement(KlausPanel, { model: {reaction:'thinking',comment:'Con calma.',id:'question:1',streak:0,announce:false} }));
  expect(html).toMatch(/<details[^>]*data-klaus-preferences=""[^>]*><summary[^>]*>.*?Ajustes de Klaus.*?<\/summary>/);
  expect(html).not.toMatch(/<details[^>]*\sopen/);
  expect(html).toMatch(/<details[\s\S]*data-klaus-control="mute"[\s\S]*data-klaus-control="motion"[\s\S]*data-klaus-control="hide"[\s\S]*<\/details>/);
});
