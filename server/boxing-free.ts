// Reglas del BOXEO LIBRE (sin profesor): sparring del sistema, plazos del servidor y avance automático.
// Puro y sin red: se prueba con reloj y azar inyectados. El motor de combate sigue siendo el de boxing.ts.
import { BOXING_MOVES, type BoxingMove } from '../shared/boxing.ts';

export const FREE_BOXING = {
  /** Plazos de cada fase: si alguien no actúa, el servidor decide por él (mismo efecto que «revelar» del profesor). */
  questionMs: 40_000, actionMs: 20_000, resultMs: 12_000,
  soloExchanges: 8, privateExchanges: 10,
  /** Probabilidad de que el sparring acierte la pregunta. Fija, baja a propósito: lo importante es que el alumno practique. */
  botAccuracy: 0.6,
  /** Una sala terminada se cierra a los 10 min; una sin actividad, a las 2 h. */
  finishedTtlMs: 10 * 60_000, idleTtlMs: 2 * 3_600_000,
} as const;

/**
 * REGLAS DEL SPARRING (públicas, sin trampas: no ve la respuesta del alumno ni su movimiento).
 *  Pregunta: acierta con probabilidad `botAccuracy`; si falla, elige una opción incorrecta al azar.
 *  Movimiento (solo si acertó), por orden:
 *   1. vida < 35 y energía ≥ 1 → Defensa
 *   2. energía ≥ 3 → Crochet (50 %) o Directo
 *   3. energía = 2 → Directo
 *   4. energía = 1 → Jab (70 %) o Esquiva
 *   5. energía = 0 → Defensa (recupera energía)
 */
export function botAnswer(correct: number, options: number, rand: () => number, accuracy: number = FREE_BOXING.botAccuracy): number {
  if (rand() < accuracy || options < 2) return correct;
  const wrong = Array.from({ length: options }, (_, i) => i).filter((i) => i !== correct);
  return wrong[Math.floor(rand() * wrong.length)];
}
export function botMove(hp: number, stamina: number, rand: () => number): BoxingMove {
  const cost = (m: BoxingMove) => BOXING_MOVES.find((x) => x.id === m)!.cost;
  let pick: BoxingMove;
  if (hp < 35 && stamina >= 1) pick = 'guard';
  else if (stamina >= 3) pick = rand() < 0.5 ? 'hook' : 'cross';
  else if (stamina === 2) pick = 'cross';
  else if (stamina === 1) pick = rand() < 0.7 ? 'jab' : 'dodge';
  else pick = 'guard';
  return stamina >= cost(pick) ? pick : 'guard';
}

/** Nombre mostrado de un invitado: recortado y sin marcado. */
export const cleanName = (v: unknown, fallback: string) => {
  const s = typeof v === 'string' ? v.replace(/[<>&"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16) : '';
  return s || fallback;
};
