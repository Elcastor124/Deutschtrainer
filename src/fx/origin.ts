// Dónde estaba la carta que el alumno acaba de usar: la animación del objeto sale de ahí.
import type { ItemId } from '../../shared/types.ts';

let last: { item: ItemId; rect: DOMRect; at: number } | null = null;

export function markOrigin(item: ItemId, el: Element | null) {
  if (el) last = { item, rect: el.getBoundingClientRect(), at: Date.now() };
}

/** Rectángulo de origen si es reciente (el servidor confirma en < 3 s). */
export function takeOrigin(item: ItemId): DOMRect | null {
  if (!last || last.item !== item || Date.now() - last.at > 3000) return null;
  const r = last.rect;
  last = null;
  return r;
}
