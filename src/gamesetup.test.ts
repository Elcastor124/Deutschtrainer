import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameSetup, setupTarget } from './views/GameSetup.tsx';
import { teacherHello } from './views/Teacher.tsx';
import { topicsFromQuery } from './views/Practice.tsx';

function render(mode: 'blackcard' | 'jenga', search = '') {
  vi.stubGlobal('location', { pathname: mode === 'jenga' ? '/jenga' : '/jugar', search });
  return renderToStaticMarkup(createElement(GameSetup, { mode }));
}
afterEach(() => vi.unstubAllGlobals());

describe('GameSetup (/jugar, /jenga)', () => {
  it('/jugar: crear sala BlackCard con temas y entrar como alumno con código', () => {
    const html = render('blackcard');
    expect(html).toContain('Crear sala');
    expect(html).toContain('Entrar en la sala');
    expect(html).toContain('aria-label="Código de sala"');
    expect(html).toContain('Dativ');
    expect(html).toContain('aria-pressed="false"');
  });
  it('?temas= preselecciona temas (enlaces del curso) e ignora los desconocidos', () => {
    const html = render('blackcard', '?temas=dativ,akkusativ,xx');
    expect((html.match(/aria-pressed="true"/g) ?? []).length).toBe(2);
  });
  it('/jenga: crea la sala directamente en el Wort-Jenga', () => {
    const html = render('jenga', '?temas=perfekt');
    expect(html).toContain('Wort-Jenga');
    expect(html).toContain('Crear sala');
    expect((html.match(/aria-pressed="true"/g) ?? []).length).toBe(1);
  });
  it('?sala=CODE rellena el código del alumno', () => {
    expect(render('blackcard', '?sala=abcd')).toContain('value="ABCD"');
  });
  it('la URL de creación lleva temas y juego, y el profesor los envía al crear la sala', () => {
    expect(setupTarget('blackcard', [])).toBe('/t/new');
    expect(setupTarget('blackcard', ['dativ', 'akkusativ'])).toBe('/t/new?temas=dativ,akkusativ');
    expect(setupTarget('jenga', ['perfekt'])).toBe('/t/new?juego=jenga&temas=perfekt');
    expect(teacherHello('new', '?juego=jenga&temas=perfekt,nope')).toEqual({ t: 'hello', role: 'teacher', create: true, topics: ['perfekt'], start: 'jenga' });
    expect(teacherHello('new', '')).toEqual({ t: 'hello', role: 'teacher', create: true, topics: [], start: 'blackcard' });
    expect(teacherHello('ABCD', '', 'tok')).toEqual({ t: 'hello', role: 'teacher', room: 'ABCD', token: 'tok' });
  });
  it('práctica: ?temas= también preselecciona', () => {
    expect(topicsFromQuery('?tema=1&temas=dativ,praep')).toEqual(['dativ', 'praep']);
    expect(topicsFromQuery('?tema=1')).toEqual([]);
  });
});
