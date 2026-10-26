export interface KlausPreferences { hidden: boolean; muted: boolean; still: boolean }
export const KLAUS_SETTINGS_KEY = 'bc:klaus:settings:v1';
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
function browserStorage(): StoragePort | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}
export function readKlausPreferences(storage = browserStorage()): KlausPreferences {
  try {
    const value = JSON.parse(storage?.getItem(KLAUS_SETTINGS_KEY) ?? 'null');
    return { hidden: value?.hidden === true, muted: value?.muted !== false, still: value?.still === true };
  } catch { return { hidden: false, muted: true, still: false }; }
}
export function saveKlausPreferences(value: KlausPreferences, storage = browserStorage()): void {
  try { storage?.setItem(KLAUS_SETTINGS_KEY, JSON.stringify(value)); } catch { /* Preferences still work for this mount. */ }
}
