// Skin de Klaus de la cuenta conectada. Cada alumno ve solo la suya (se guarda en su cuenta, en el servidor).
import { useEffect, useState } from 'react';
import { KLAUS_DEFAULT, klausSkin, type KlausSkinDef } from '../../shared/klaus-skins.ts';
import { playRequest } from '../play-client.ts';
import { store, studentSession } from '../util.ts';

export interface KlausCollection { owned: string[]; equipped: string; boxes: number; skin?: string | null }
const KEY = 'dt:klaus-skin';
const EVT = 'dt:klaus-skin';

function set(id: string) { store.set(KEY, id); dispatchEvent(new Event(EVT)); }
export const currentSkinId = () => (studentSession() ? store.get(KEY) ?? KLAUS_DEFAULT : KLAUS_DEFAULT);

export async function loadCollection(): Promise<KlausCollection | null> {
  if (!studentSession()) { set(KLAUS_DEFAULT); return null; }
  try { const c = await playRequest<KlausCollection>('/api/account/klaus'); set(c.equipped); return c; } catch { return null; }
}
export async function openLootbox(): Promise<KlausCollection> { return playRequest<KlausCollection>('/api/account/klaus/open', {}); }
export async function equipSkin(skin: string): Promise<KlausCollection> { const c = await playRequest<KlausCollection>('/api/account/klaus/equip', { skin }); set(c.equipped); return c; }

/** Skin equipada; se actualiza al entrar/salir de la cuenta o al cambiarla. */
export function useKlausSkin(): KlausSkinDef {
  const [id, setId] = useState(currentSkinId);
  useEffect(() => {
    const on = () => setId(currentSkinId());
    const acc = () => { void loadCollection().then(on); };
    addEventListener(EVT, on); addEventListener('dt:account', acc);
    acc();
    return () => { removeEventListener(EVT, on); removeEventListener('dt:account', acc); };
  }, []);
  return klausSkin(id);
}
