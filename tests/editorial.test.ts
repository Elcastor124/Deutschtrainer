import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import * as landing from '../src/views/Landing.tsx';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Routing is owned by the app; keep these lifecycle tests independent of nav composition.
vi.mock('../src/components/LearningNav.tsx', () => ({ followLearningLink: () => {} }));

/** A controllable DOM boundary: exercise the real observer/RAF lifecycle without a browser library. */
function entranceDOM() {
  const frames = new Map<number, FrameRequestCallback>();
  let seq = 0;
  let intro = true;
  let locked = true;
  let notify = () => {};
  const disconnected = vi.fn();
  const visibility = new Set<() => void>();
  const doc = {
    hidden: false,
    documentElement: { classList: { contains: () => locked } },
    querySelector: () => intro ? {} : null,
    addEventListener: (_: string, callback: () => void) => visibility.add(callback),
    removeEventListener: (_: string, callback: () => void) => visibility.delete(callback),
    defaultView: {
      MutationObserver: class {
        constructor(callback: () => void) { notify = callback; }
        observe() {}
        disconnect() { disconnected(); }
      },
      requestAnimationFrame: (callback: FrameRequestCallback) => { frames.set(++seq, callback); return seq; },
      cancelAnimationFrame: (id: number) => frames.delete(id),
    },
  };
  const root = { ownerDocument: doc, dataset: {} as Record<string, string> };
  const tick = () => { const batch = [...frames.values()]; frames.clear(); batch.forEach((f) => f(0)); };
  return {
    root: root as unknown as HTMLElement, frames, doc, disconnected, visibility, tick,
    intro: (present: boolean) => { intro = present; locked = present; notify(); },
    unlockedOverlay: () => { locked = false; notify(); },
  };
}

function entrance(root: HTMLElement, enabled = true) {
  expect(landing).toHaveProperty('watchEditorialEntrance');
  return (landing as unknown as { watchEditorialEntrance: (root: HTMLElement, enabled: boolean) => () => void }).watchEditorialEntrance(root, enabled);
}

describe('editorial entrance lifecycle', () => {
  it('does not consume its reveal under the intro, including its exit overlay', () => {
    const dom = entranceDOM();
    const stop = entrance(dom.root);
    dom.tick(); dom.tick();
    expect(dom.root.dataset.editorialEnter).not.toBe('play');
    dom.unlockedOverlay();
    dom.tick(); dom.tick();
    expect(dom.root.dataset.editorialEnter).not.toBe('play');
    dom.intro(false);
    dom.tick(); dom.tick();
    expect(dom.root.dataset.editorialEnter).toBe('play');
    expect(dom.disconnected).toHaveBeenCalled();
    stop();
  });
  it('does not schedule motion when effects are disabled', () => {
    const dom = entranceDOM();
    dom.intro(false);
    const stop = entrance(dom.root, false);
    dom.tick(); dom.tick();
    expect(dom.root.dataset.editorialEnter).toBe('static');
    expect(dom.frames.size).toBe(0);
    expect(dom.visibility.size).toBe(0);
    stop();
  });
  it('waits for a background document to become visible', () => {
    const dom = entranceDOM();
    dom.intro(false);
    dom.doc.hidden = true;
    const stop = entrance(dom.root);
    dom.tick(); dom.tick();
    expect(dom.root.dataset.editorialEnter).not.toBe('play');
    dom.doc.hidden = false;
    dom.visibility.forEach((notify) => notify());
    dom.tick(); dom.tick();
    expect(dom.root.dataset.editorialEnter).toBe('play');
    stop();
  });
  it('cancels queued frames and detaches observers on unmount', () => {
    const dom = entranceDOM();
    dom.intro(false);
    const stop = entrance(dom.root);
    dom.tick();
    stop();
    dom.tick(); dom.tick();
    expect(dom.root.dataset.editorialEnter).toBe('static');
    expect(dom.frames.size).toBe(0);
    expect(dom.visibility.size).toBe(0);
    expect(dom.disconnected).toHaveBeenCalled();
  });
  it('leaves content static if the browser cannot observe intro removal', () => {
    const dom = entranceDOM();
    Reflect.deleteProperty(dom.doc.defaultView, 'MutationObserver');
    const stop = entrance(dom.root);
    expect(dom.root.dataset.editorialEnter).toBe('static');
    expect(dom.frames.size).toBe(0);
    stop();
  });
});

describe('editorial tactile input', () => {
  it('provides a touch press signal without preventing the gesture, then clears it on cancel and unmount', () => {
    expect(landing).toHaveProperty('bindEditorialPress');
    const handlers = new Map<string, (event?: unknown) => void>();
    const windowHandlers = new Map<string, (event?: unknown) => void>();
    const docHandlers = new Map<string, (event?: unknown) => void>();
    const card = { dataset: {} as Record<string, string> };
    const boundary = (map: Map<string, (event?: unknown) => void>) => ({
      addEventListener: (name: string, callback: (event?: unknown) => void) => map.set(name, callback),
      removeEventListener: (name: string) => map.delete(name),
    });
    const root = { ...boundary(handlers), contains: () => true, ownerDocument: { ...boundary(docHandlers), defaultView: boundary(windowHandlers) } } as unknown as HTMLElement;
    const preventDefault = vi.fn();
    const press = () => handlers.get('pointerdown')?.({ button: 0, isPrimary: true, target: { closest: () => card }, preventDefault });
    const stop = (landing as unknown as { bindEditorialPress: (root: HTMLElement, enabled: boolean) => () => void }).bindEditorialPress(root, true);
    press();
    expect(card.dataset.editorialPressed).toBe('true');
    expect(preventDefault).not.toHaveBeenCalled();
    windowHandlers.get('pointercancel')?.();
    expect(card.dataset.editorialPressed).toBeUndefined();
    press();
    windowHandlers.get('pointerup')?.();
    expect(card.dataset.editorialPressed).toBeUndefined();
    press();
    stop();
    expect(card.dataset.editorialPressed).toBeUndefined();
    expect(handlers.size + windowHandlers.size + docHandlers.size).toBe(0);
  });
});

const source = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

describe('landing editorial type', () => {
  it('renders one real heading with ordered word masks, not duplicated or scrambled text', () => {
    const html = renderToStaticMarkup(createElement(landing.Landing));
    const hero = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? '';
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(hero.match(/data-editorial-word/g)).toHaveLength(8);
    expect(hero.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()).toBe('Aprende alemán paso a paso. Schritt für Schritt.');
    expect(hero).not.toMatch(/aria-hidden|aria-label|dt-line/);
    expect(html).toContain('dt-landing dt-editorial');
    expect(html).toContain('data-editorial-enter="static"');
    expect(html).toContain('data-intro-replay');
  });
  it('scopes the condensed hierarchy and motion opt-outs to the landing only', () => {
    const css = source('src/brand/editorial.css');
    expect(source('src/views/Landing.tsx')).toContain("import '../brand/editorial.css'");
    expect(css).toMatch(/--dt-editorial-headline:\s*'Barlow Condensed'/);
    expect(css).toMatch(/\.dt-editorial\s+\.dt-hero-title[\s\S]*?font-family:\s*var\(--dt-editorial-headline\)/);
    expect(css).toContain("html[data-dt-effects='off'] .dt-editorial");
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain(':focus-visible');
    expect(css).toContain(':active');
    expect(css).not.toMatch(/:root\s*\{|@import|https?:\/\//);
    expect(css).not.toMatch(/:is\([^)]*::(?:before|after)/);
  });
  it('keeps the right glove mirroring on a non-animated parent so hover cannot flatten the artwork', () => {
    const html = renderToStaticMarkup(createElement(landing.Landing));
    expect(html).toContain('<g transform="translate(120 0) scale(-1 1)"><g class="glove r">');
  });
  it('ships only the two requested headline weights locally while keeping the readable UI families', () => {
    const entry = source('src/main.tsx');
    const pkg = JSON.parse(source('package.json'));
    expect(pkg.devDependencies['@fontsource/barlow-condensed']).toBeTruthy();
    expect(entry).toContain("'@fontsource/barlow-condensed/latin-600.css'");
    expect(entry).toContain("'@fontsource/barlow-condensed/latin-700.css'");
    expect(entry).toContain("'@fontsource-variable/space-grotesk'");
    expect(entry).toContain("'@fontsource-variable/jetbrains-mono'");
    expect(entry).not.toMatch(/https?:\/\//);
  });
});
