import { describe,it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..');
describe('Enlace del final de Akkusativ al boxeo',()=>{
 it('mantiene la lección y añade acceso al combate antes de la despedida',()=>{
  const html=readFileSync(resolve(root,'public/presentaciones/akkusativ.html'),'utf8');
  expect(html).toContain('BOXEN ARENA');expect(html).toContain('openBoxing()');
  expect(html.indexOf('BOXEN ARENA')).toBeLessThan(html.indexOf('Ein Satz zum Schluss'));
  expect(html).toContain('Akkusativ-Blitz');
 });
});
