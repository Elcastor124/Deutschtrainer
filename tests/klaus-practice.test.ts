import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { Practice } from '../src/views/Practice.tsx';

it('includes the original waving Klaus in the real practice setup without replacing the form', () => {
  const html = renderToStaticMarkup(createElement(Practice, {}));
  expect(html).toContain('data-klaus-state="waving"');
  // La pata y las 52 skins las dibuja ahora el motor Canvas (el SVG con la pata de cuatro almohadillas queda de respaldo, probado en klaus-figure.test.ts).
  expect(html).toContain('data-klaus-engine="canvas"');
  expect(html).toContain('Empezar práctica');
  expect(html).toContain('Tu nombre');
});
