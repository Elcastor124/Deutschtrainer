import { describe, expect, it } from 'vitest';
import { readKlausPreferences, saveKlausPreferences, KLAUS_SETTINGS_KEY } from '../src/klaus/preferences.ts';

const memory = () => {
  const map = new Map<string, string>();
  return { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key, value); } };
};
describe('Klaus preferences', () => {
  it('defaults to visible and silent, with system motion respected by the view', () => {
    expect(readKlausPreferences(memory())).toEqual({ hidden: false, muted: true, still: false });
  });
  it('persists hide, sound and reduced-motion choices across mounts', () => {
    const storage = memory();
    saveKlausPreferences({ hidden: true, muted: false, still: true }, storage);
    expect(readKlausPreferences(storage)).toEqual({ hidden: true, muted: false, still: true });
  });
  it('rejects malformed data and tolerates unavailable browser storage', () => {
    const storage = memory();
    storage.setItem(KLAUS_SETTINGS_KEY, '{invalid');
    expect(readKlausPreferences(storage).muted).toBe(true);
    storage.setItem(KLAUS_SETTINGS_KEY, JSON.stringify({ hidden: 'false', muted: 0, still: 'yes' }));
    expect(readKlausPreferences(storage)).toEqual({ hidden: false, muted: true, still: false });
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(() => saveKlausPreferences({ hidden: true, muted: true, still: true }, blocked)).not.toThrow();
    expect(readKlausPreferences(blocked).muted).toBe(true);
  });
});
