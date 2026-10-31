import type { Question } from '../../shared/types.ts';
import { a1GrammarQuestions } from './a1grammar.ts';
import { expertQuestions } from './expert.ts';
import { alltagQuestions } from './alltag.ts';
import { bossQuestions } from './boss.ts';
import { grammarQuestions } from './grammar.ts';
import { lesenQuestions } from './lesen.ts';
import { lesenMoreQuestions } from './lesen2.ts';
import { nebenQuestions } from './neben.ts';
import { satzbauQuestions } from './satzbau.ts';
import { vocabQuestions } from './vocabq.ts';
import { generatedQuestions } from './generated.ts';
import { vorstellenQuestions } from './vorstellen.ts';

let cache: Map<string, Question> | null = null;

/** Banco completo indexado por id. Lanza si hay ids duplicados o preguntas mal formadas. */
export function loadBank(): Map<string, Question> {
  if (cache) return cache;
  const all = [
    ...lesenQuestions(), ...lesenMoreQuestions(), ...vocabQuestions(), ...alltagQuestions(), ...grammarQuestions(),
    ...nebenQuestions(), ...satzbauQuestions(), ...bossQuestions(), ...a1GrammarQuestions(), ...expertQuestions(), ...generatedQuestions(), ...vorstellenQuestions(),
  ];
  const map = new Map<string, Question>();
  for (const q of all) {
    if (map.has(q.id)) throw new Error(`id duplicado: ${q.id} — ${q.prompt}`);
    if ((q.diff === 'hard' || q.diff === 'special') && !q.why) throw new Error(`difícil sin justificación: ${q.prompt}`);
    if (q.unlock && q.diff === 'easy') throw new Error(`unlock en pregunta fácil: ${q.prompt}`);
    map.set(q.id, q);
  }
  cache = map;
  return map;
}
