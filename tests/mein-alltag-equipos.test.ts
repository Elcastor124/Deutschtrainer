import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
const html = readFileSync('public/presentaciones/mein-alltag.html', 'utf8');
describe('Mein Alltag · ampliación', () => {
  it('ofrece marcador de equipos visible y atajo P', () => {
    expect(html).toContain('id="teamsDialog"');
    expect(html).toContain('id="teamOpen"');
    expect(html).toContain('toggleTeamDialog');
  });
  it('incluye preguntas adicionales repartidas en tres bloques', () => {
    for (const id of ['q6', 'q7', 'q8']) expect(html).toContain(`id="${id}"`);
  });
});
