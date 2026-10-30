import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.tsx';

function renderRoute(pathname: string, search = '') {
  vi.stubGlobal('location', { pathname, search });
  return renderToStaticMarkup(createElement(App));
}
afterEach(() => vi.unstubAllGlobals());

describe('Student learning hub', () => {
  it('makes the Dativ and Akkusativ review game discoverable from the homepage and topic', () => {
    for (const path of ['/', '/tema/1']) {
      const html = renderRoute(path);
      expect(html).toContain('href="/boxeo"');
      expect(html).toContain('Repaso de Dativ y Akkusativ');
      expect(html).toContain('dos jugadores');
    }
  });

  it('opens the brand landing at the root with the course, practice, games and navigation', () => {
    const html = renderRoute('/');
    // Assert the actual headline text, not that animated word spans share one HTML text node.
    const headline = /<h1[^>]*id="hero-title"[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1].replace(/<[^>]*>/g, '');
    expect(headline).toContain('Aprende alemán');
    expect(html).toContain('aria-label="Deutschtrainer"');
    for (const href of ['/curso', '/practica', '/road-to-b1', '/jugar', '/jenga', '/boxeo', '/tema/1', '/profesor']) expect(html).toContain(`href="${href}"`);
    expect(html).toContain('Nebensätze');
    expect(html).toContain('Wort-Jenga');
    expect(html).toContain('Tu primer paso');
  });

  it('shows the ordered course with the fixed class flow and a teacher placeholder without secrets', () => {
    const html = renderRoute('/curso');
    expect(html).toContain('Tu curso');
    expect(html.indexOf('Brücke A1')).toBeLessThan(html.indexOf('Auf der Bank'));
    expect(html.indexOf('Auf der Bank')).toBeLessThan(html.indexOf('Mission Stadt'));
    expect(html).toContain('href="/presentaciones/bruecke-a1.html"');
    expect(html).toContain('href="/practica?temas=praesens,alltag,vocab,satzbau"');
    expect(html).toContain('Marcar hecho');
    expect(html).toContain('Siguiente');
    const teacher = renderRoute('/profesor');
    // /profesor (= /teacher) es Teacher OS: se carga aparte y su HTML inicial no lleva ningún dato (todo exige sesión de profesor).
    expect(teacher).not.toContain('Próximamente: modo profesor protegido');
    expect(teacher).toContain('tos-skel');
    expect(teacher).not.toMatch(/acc_|dtk_|dtt_/);
    expect(teacher).not.toMatch(/type="password"/);
  });

  it('shows Tema 1 as a study path with resources, complete quiz practice and live workshops', () => {
    const html = renderRoute('/tema/1');
    expect(html).toContain('Ruta de estudio');
    expect(html).toContain('Presentaciones');
    expect(html).toContain('href="/practica?tema=1"');
    expect(html).toContain('Schreibwerkstatt');
    expect(html).toContain('Wort-Jenga');
    expect(html).toContain('requieren una sala');
  });

  it('keeps room invitations at the root and the game lobby available', () => {
    for (const [path, search] of [['/', '?sala=ABCDE'], ['/jugar', '']]) {
      const html = renderRoute(path, search);
      expect(html).toContain('Crear sala');
      expect(html).toContain('Entrar en la sala');
      if (search) expect(html).toContain('value="ABCDE"');
    }
  });

  it('opens independent writing and scene rehearsal with source prompts and self-review', () => {
    const html = renderRoute('/tema/1/taller');
    expect(html).toContain('Taller personal');
    expect(html).toContain('Reescritura');
    expect(html).toContain('Escritura libre');
    expect(html).toContain('Palabras dadas');
    expect(html).toContain('Ensayo de escenas');
    expect(html).toContain('autoevaluación');
    expect(html).toContain('Ein verrückter Samstag');
    expect(html).toContain('textarea');
    expect(html).toContain('Wort-Jenga');
  });

  it('retains the resume action and existing quiz profile data', () => {
    const saved = new Map([['bc:practice', JSON.stringify({ room: 'ABCD', token: 'resume-token' })], ['bc:name', 'Ana']]);
    vi.stubGlobal('localStorage', { getItem: (key: string) => saved.get(key) ?? null });
    const html = renderRoute('/practica', '?tema=1');
    expect(html).toContain('práctica a medias');
    expect(html).toContain('Continuar');
    expect(html).toContain('value="Ana"');
  });

  it('offers the full quiz bank by default, retains all filters and names Tema 1', () => {
    const html = renderRoute('/practica', '?tema=1');
    expect(html).toContain('Tema 1');
    expect(html).toContain('Todo el banco');
    expect(html).toContain('Akkusativ');
    expect(html).toContain('Imperativ');
    expect(html).not.toContain('aria-pressed="true"');
    expect(html).not.toContain('type="checkbox" checked');
    expect(html).toContain('conexión con el servidor');
  });
});
