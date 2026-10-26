import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { Practice } from '../src/views/Practice.tsx';

it('includes the original waving Klaus in the real practice setup without replacing the form', () => {
  const html = renderToStaticMarkup(createElement(Practice, {}));
  expect(html).toContain('data-klaus-state="waving"');
  expect(html).toContain('data-klaus-paw=""');
  expect(html).toContain('Empezar práctica');
  expect(html).toContain('Tu nombre');
});
