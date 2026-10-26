import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function environment() {
  const values = new Map<string, string>();
  const storage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
  };
  const media = Object.assign(new EventTarget(), { matches: false });
  const win = Object.assign(new EventTarget(), { localStorage: storage, matchMedia: vi.fn(() => media) });
  const root = { dataset: {} as Record<string, string> };
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', { documentElement: root });
  return { values, storage, media, win, root };
}

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

describe('shared ambient effects preference', () => {
  it('is off without a browser and never throws on denied browser APIs', async () => {
    const effects = await import('../src/brand/effects.ts');
    expect(effects.readEffectsEnabled()).toBe(false);
    const { storage, win } = environment();
    storage.getItem.mockImplementation(() => { throw new Error('denied'); });
    win.matchMedia.mockImplementation(() => { throw new Error('unsupported'); });
    expect(effects.readEffectsEnabled()).toBe(true);
  });
  it('uses opt-out storage but OS reduced motion always wins, even over an explicit on', async () => {
    const { values, media } = environment();
    const effects = await import('../src/brand/effects.ts');
    expect(effects.readEffectsEnabled()).toBe(true);
    values.set('dt:effects', 'off');
    expect(effects.readEffectsEnabled()).toBe(false);
    values.set('dt:effects', 'on');
    media.matches = true;
    expect(effects.readEffectsEnabled()).toBe(false);
    media.matches = false;
    expect(effects.readEffectsEnabled()).toBe(true);
  });
  it('persists a toggle, synchronizes the root and notifies same-tab consumers', async () => {
    const { values, root, win } = environment();
    const effects = await import('../src/brand/effects.ts');
    const update = vi.fn();
    const event = vi.fn();
    win.addEventListener('dt:effects-change', event);
    const stop = effects.subscribeEffects(update);
    expect(root.dataset.dtEffects).toBe('on');
    effects.setEffectsEnabled(false);
    expect(values.get('dt:effects')).toBe('off');
    expect(root.dataset.dtEffects).toBe('off');
    expect(effects.readEffectsEnabled()).toBe(false);
    expect(event).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
    effects.setEffectsEnabled(true);
    expect(root.dataset.dtEffects).toBe('on');
    stop();
  });
  it('updates live for cross-tab storage writes/clear and OS changes, with full unsubscribe', async () => {
    const { values, media, win, root } = environment();
    const effects = await import('../src/brand/effects.ts');
    const update = vi.fn();
    const stop = effects.subscribeEffects(update);
    values.set('dt:effects', 'off');
    win.dispatchEvent(Object.assign(new Event('storage'), { key: 'dt:effects' }));
    expect(root.dataset.dtEffects).toBe('off');
    values.clear();
    win.dispatchEvent(Object.assign(new Event('storage'), { key: null }));
    expect(root.dataset.dtEffects).toBe('on');
    media.matches = true;
    media.dispatchEvent(new Event('change'));
    expect(root.dataset.dtEffects).toBe('off');
    expect(update).toHaveBeenCalledTimes(3);
    stop();
    media.matches = false;
    media.dispatchEvent(new Event('change'));
    win.dispatchEvent(new Event('dt:effects-change'));
    expect(update).toHaveBeenCalledTimes(3);
  });
  it('shares one media listener and leaves none after the final consumer unmounts', async () => {
    const { media } = environment();
    const add = vi.spyOn(media, 'addEventListener');
    const remove = vi.spyOn(media, 'removeEventListener');
    const effects = await import('../src/brand/effects.ts');
    const stopA = effects.subscribeEffects(() => {});
    const stopB = effects.subscribeEffects(() => {});
    expect(add).toHaveBeenCalledTimes(1);
    stopA();
    expect(remove).not.toHaveBeenCalled();
    stopB();
    expect(remove).toHaveBeenCalledTimes(1);
  });
  it('retains a safe in-tab pause if writing localStorage is blocked', async () => {
    const { storage, root } = environment();
    storage.setItem.mockImplementation(() => { throw new Error('quota'); });
    const effects = await import('../src/brand/effects.ts');
    expect(() => effects.setEffectsEnabled(false)).not.toThrow();
    expect(effects.readEffectsEnabled()).toBe(false);
    expect(root.dataset.dtEffects).toBe('off');
    effects.setEffectsEnabled(true);
    expect(effects.readEffectsEnabled()).toBe(true);
  });
});
