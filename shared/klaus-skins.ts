// Skins de Klaus (catálogo compartido servidor/cliente). Paletas tomadas de klaus_vector.py (renderer de escritorio).
export type KlausRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
export interface KlausSkinDef { id: string; label: string; line: string; accent: string; secondary: string; glow: boolean; rarity: KlausRarity; emoji: string }

export const KLAUS_SKINS: KlausSkinDef[] = [
  { id: 'default', label: 'ORIGINAL', line: '#F4F4F4', accent: '#F2C65D', secondary: '#777777', glow: false, rarity: 'common', emoji: '' },
  { id: 'neon', label: 'NEON', line: '#F7F7FF', accent: '#FF2DAA', secondary: '#31D7FF', glow: true, rarity: 'epic', emoji: '💡' },
  { id: 'professor', label: 'PROFESSOR', line: '#F4F4F4', accent: '#B8B8B8', secondary: '#FFFFFF', glow: false, rarity: 'rare', emoji: '🎓' },
  { id: 'nightlife', label: 'NIGHT', line: '#F7F3FF', accent: '#D946EF', secondary: '#22D3EE', glow: true, rarity: 'epic', emoji: '🪩' },
  { id: 'winter', label: 'WINTER', line: '#F6FBFF', accent: '#7FB8FF', secondary: '#CFE6FF', glow: false, rarity: 'rare', emoji: '❄️' },
  { id: 'cyber', label: 'CYBER', line: '#E9FFE9', accent: '#6CFF6C', secondary: '#19A974', glow: true, rarity: 'epic', emoji: '🕶️' },
  { id: 'royal', label: 'ROYAL', line: '#FFF3C4', accent: '#FFD54A', secondary: '#177A4A', glow: true, rarity: 'legendary', emoji: '👑' },
  { id: 'fire', label: 'FEUER', line: '#FFF3E8', accent: '#FF643D', secondary: '#FFAA27', glow: true, rarity: 'epic', emoji: '🔥' },
  { id: 'analog', label: 'ANALOG', line: '#E8C85A', accent: '#E8C85A', secondary: '#B9B1A0', glow: false, rarity: 'rare', emoji: '⏰' },
  { id: 'metro', label: 'METRO 3_AM', line: '#F1EFE9', accent: '#8B5A3C', secondary: '#4A403A', glow: false, rarity: 'rare', emoji: '🚇' },
  { id: 'crt', label: 'CRT', line: '#4D9A5F', accent: '#397A4A', secondary: '#285237', glow: false, rarity: 'rare', emoji: '📺' },
  { id: 'berliner', label: 'OCTERFEST', line: '#F4F1E8', accent: '#D7A93A', secondary: '#315D3A', glow: false, rarity: 'rare', emoji: '🍺' },
  { id: 'glyph', label: 'GLYPH', line: '#F4F4F4', accent: '#FFFFFF', secondary: '#777777', glow: false, rarity: 'rare', emoji: '⠿' },
  { id: 'pilot', label: 'PILOT', line: '#F4F4F4', accent: '#5D96DA', secondary: '#254D7C', glow: false, rarity: 'rare', emoji: '✈️' },
  { id: 'kernel', label: 'KERNEL', line: '#A8FFB0', accent: '#5AD66F', secondary: '#214D2A', glow: true, rarity: 'epic', emoji: '💾' },
  { id: 'skater', label: 'SKATER', line: '#F4F4F4', accent: '#8E55B8', secondary: '#5B356E', glow: false, rarity: 'rare', emoji: '🛹' },
  { id: 'vinyl', label: 'VINYL', line: '#F4F4F4', accent: '#C99C48', secondary: '#5F5041', glow: false, rarity: 'rare', emoji: '💿' },
  { id: 'alpen', label: 'ALPEN', line: '#F4F4F4', accent: '#B94D45', secondary: '#6E8DA0', glow: false, rarity: 'rare', emoji: '🏔️' },
  { id: 'void', label: 'VOID', line: '#F5F0FA', accent: '#9C28D7', secondary: '#551069', glow: true, rarity: 'mythic', emoji: '🌀' },
  { id: 'monolith', label: 'MONOLITH', line: '#F6F0E5', accent: '#FFE20A', secondary: '#79513F', glow: true, rarity: 'mythic', emoji: '🗿' },
  { id: 'ghost', label: 'GHOST', line: '#EDEAF8', accent: '#9D6BFF', secondary: '#5F4A85', glow: true, rarity: 'epic', emoji: '👻' },
  { id: 'glitch', label: 'GLITCH', line: '#FFFFFF', accent: '#FF3FA4', secondary: '#2DD7FF', glow: true, rarity: 'epic', emoji: '⚡' },
  { id: 'maestro', label: 'MAESTRO', line: '#F4F1E8', accent: '#D7B55A', secondary: '#8B7A4D', glow: true, rarity: 'epic', emoji: '🎼' },
  { id: 'mechanic', label: 'MECHANIC', line: '#F2F2F2', accent: '#FF8A2A', secondary: '#6E7377', glow: true, rarity: 'epic', emoji: '🔧' },
  { id: 'noir', label: 'NOIR', line: '#ECEBE8', accent: '#C9B88A', secondary: '#46484B', glow: true, rarity: 'epic', emoji: '🎩' },
  { id: 'null', label: 'NULL', line: '#F4F4F4', accent: '#FF334F', secondary: '#44474A', glow: true, rarity: 'epic', emoji: '∅' },
  { id: 'rockstar', label: 'ROCKSTAR', line: '#F6F2ED', accent: '#FF2D55', secondary: '#8A5CFF', glow: true, rarity: 'epic', emoji: '🎸' },
  { id: 'ubahn_ghost', label: 'U-BAHN GHOST', line: '#E8F1F7', accent: '#91A8BC', secondary: '#566B7C', glow: true, rarity: 'epic', emoji: '🚉' },
  { id: 'astronaut', label: 'ASTRONAUT', line: '#F7FBFF', accent: '#6DA8FF', secondary: '#9D7CFF', glow: true, rarity: 'legendary', emoji: '🧑‍🚀' },
  { id: 'chrome', label: 'CHROME', line: '#F7F7F7', accent: '#4285F4', secondary: '#EA4335', glow: true, rarity: 'legendary', emoji: '🌐' },
  { id: 'eclipse', label: 'ECLIPSE', line: '#FAF7ED', accent: '#F28C28', secondary: '#73C7FF', glow: true, rarity: 'legendary', emoji: '🌘' },
  { id: 'emperor', label: 'EMPEROR', line: '#F6E7BE', accent: '#C79A3B', secondary: '#6B2B86', glow: true, rarity: 'legendary', emoji: '🏛️' },
  { id: 'graffiti', label: 'GRAFFITI', line: '#F4F4F4', accent: '#FF9F0A', secondary: '#FF9F0A', glow: false, rarity: 'common', emoji: '🎨' },
  { id: 'courier', label: 'COURIER', line: '#F4F4F4', accent: '#FFD60A', secondary: '#0A84FF', glow: false, rarity: 'common', emoji: '📦' },
  { id: 'night_rider', label: 'NIGHT RIDER', line: '#F4F4F4', accent: '#FF375F', secondary: '#64D2FF', glow: false, rarity: 'common', emoji: '🏍️' },
  { id: 'datastream', label: 'DATASTREAM', line: '#F4F4F4', accent: '#BF5AF2', secondary: '#BF5AF2', glow: false, rarity: 'common', emoji: '📡' },
  { id: 'redline', label: 'REDLINE', line: '#F4F4F4', accent: '#FFD60A', secondary: '#30D158', glow: false, rarity: 'common', emoji: '🟥' },
  { id: 'circuit', label: 'CIRCUIT', line: '#F4F4F4', accent: '#64D2FF', secondary: '#FFD60A', glow: false, rarity: 'common', emoji: '🔌' },
  { id: 'bavarian', label: 'BAVARIAN', line: '#F4F4F4', accent: '#34C759', secondary: '#FF9F0A', glow: false, rarity: 'common', emoji: '🥨' },
  { id: 'bahn', label: 'BAHN', line: '#F4F4F4', accent: '#0A84FF', secondary: '#FF375F', glow: false, rarity: 'common', emoji: '🚆' },
  { id: 'fussball', label: 'FUSSBALL', line: '#F4F4F4', accent: '#34C759', secondary: '#34C759', glow: false, rarity: 'common', emoji: '⚽' },
  { id: 'autobahn', label: 'AUTOBAHN', line: '#F4F4F4', accent: '#FF375F', secondary: '#5E5CE6', glow: false, rarity: 'common', emoji: '🏎️' },
  { id: 'doctor', label: 'DOCTOR', line: '#F4F4F4', accent: '#30D158', secondary: '#0A84FF', glow: false, rarity: 'common', emoji: '🩺' },
  { id: 'engineer', label: 'ENGINEER', line: '#F4F4F4', accent: '#64D2FF', secondary: '#FF375F', glow: false, rarity: 'common', emoji: '📐' },
  { id: 'chef', label: 'CHEF', line: '#F4F4F4', accent: '#FFD60A', secondary: '#5E5CE6', glow: false, rarity: 'common', emoji: '👨‍🍳' },
  { id: 'detective', label: 'DETECTIVE', line: '#F4F4F4', accent: '#FF9F0A', secondary: '#FF3B30', glow: false, rarity: 'common', emoji: '🔎' },
  { id: 'jazz', label: 'JAZZ', line: '#F4F4F4', accent: '#BF5AF2', secondary: '#FF375F', glow: false, rarity: 'common', emoji: '🎷' },
  { id: 'techno', label: 'TECHNO', line: '#F4F4F4', accent: '#BF5AF2', secondary: '#FF375F', glow: false, rarity: 'common', emoji: '🎧' },
  { id: 'samurai', label: 'SAMURAI', line: '#F4F4F4', accent: '#FF3B30', secondary: '#FF3B30', glow: false, rarity: 'legendary', emoji: '⚔️' },
  { id: 'agent', label: 'AGENT', line: '#F4F4F4', accent: '#5E5CE6', secondary: '#30D158', glow: false, rarity: 'common', emoji: '🕵️' },
  { id: 'prototype', label: 'PROTOTYPE', line: '#F4F4F4', accent: '#FFD60A', secondary: '#30D158', glow: false, rarity: 'legendary', emoji: '🧪' },
  { id: 'fernsehturm', label: 'FERNSEHTURM', line: '#F4F4F4', accent: '#34C759', secondary: '#FF9F0A', glow: false, rarity: 'legendary', emoji: '🗼' },
];
export const KLAUS_DEFAULT = 'default';
export const RARITY_LABEL: Record<KlausRarity, string> = { common: 'Común', rare: 'Rara', epic: 'Épica', legendary: 'Legendaria', mythic: 'Mítica' };
/** Peso de cada rareza en la lootbox. */
export const RARITY_WEIGHT: Record<KlausRarity, number> = { common: 50, rare: 28, epic: 15, legendary: 6, mythic: 1 };
export const klausSkin = (id: string | null | undefined): KlausSkinDef => KLAUS_SKINS.find((s) => s.id === id) ?? KLAUS_SKINS[0];

/** Elige una skin que el alumno aún no tiene (rnd ∈ [0,1)). null si ya las tiene todas. */
export function rollSkin(owned: readonly string[], rnd: number): KlausSkinDef | null {
  const pool = KLAUS_SKINS.filter((s) => s.id !== KLAUS_DEFAULT && !owned.includes(s.id));
  if (!pool.length) return null;
  const total = pool.reduce((m, s) => m + RARITY_WEIGHT[s.rarity], 0);
  let x = rnd * total;
  for (const s of pool) { x -= RARITY_WEIGHT[s.rarity]; if (x < 0) return s; }
  return pool[pool.length - 1];
}
