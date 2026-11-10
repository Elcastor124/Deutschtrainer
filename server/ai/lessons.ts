// Klasse mit Klaus · contenido ALMACENADO y orquestador DETERMINISTA. Nada aquí llama a un modelo:
// teoría, ejercicios, corrección, feedback, siguiente paso y progreso se resuelven con reglas y datos reutilizables.
// La teoría verificada se toma de las reglas del profesor (server/tutor.ts → RULES): una sola fuente de verdad.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { RULES } from '../tutor.ts';
import type { Activity, AnswerPayload, AnswerResult, ExerciseActivity, Lesson, PublicActivity } from '../../shared/lesson.ts';
import { isExercise } from '../../shared/lesson.ts';
import { LESSONS_A1 } from './lesson-bank-a1.ts';
import { LESSONS_A2 } from './lesson-bank-a2.ts';

export const AUDIO_DIR = join(import.meta.dirname, '..', 'klaus-audio');
const rule = (id: string) => RULES.find((r) => r.id === id)!;

const AKK_01: Lesson = {
  id: 'akk-01', unit: 'A1 · Akkusativ', level: 'A1', title: 'Akkusativ desde cero', verified: true,
  objectives: ['Reconocer el complemento directo (¿wen oder was?)', 'Saber que solo cambia el masculino: der → den, ein → einen', 'Usar el acusativo con für, ohne, gegen, durch y um'],
  ruleRefs: ['akk-obj', 'akk-prep'], progression: { maxTries: 2 }, completion: { minRatio: 0.6 },
  activities: [
    { kind: 'theory', id: 'akk-t1', title: '¿Qué es el Akkusativ?', ruleId: 'akk-obj',
      text: 'El Akkusativ es el caso del complemento directo: lo que alguien compra, tiene, ve o busca. Para encontrarlo, pregunta «Wen oder was?» (¿a quién o qué?).',
      example: { de: 'Ich kaufe einen Tisch.', es: 'Compro una mesa.' },
      speech: [{ text: 'El Akkusativ es el caso del complemento directo: lo que alguien compra, tiene, ve o busca.', lang: 'es' }, { text: 'Ich kaufe einen Tisch.', lang: 'de' }, { text: 'Para encontrarlo, pregunta: wen oder was?', lang: 'es' }] },
    { kind: 'grammar-table', id: 'akk-g1', title: 'Los artículos en Nominativ y Akkusativ',
      columns: ['', 'der (m.)', 'die (f.)', 'das (n.)', 'die (pl.)'],
      rows: [{ id: 'nom', label: 'Nominativ', cells: ['der', 'die', 'das', 'die'] }, { id: 'akk', label: 'Akkusativ', cells: ['den', 'die', 'das', 'die'] },
        { id: 'enom', label: 'Nom. (ein)', cells: ['ein', 'eine', 'ein', '—'] }, { id: 'eakk', label: 'Akk. (ein)', cells: ['einen', 'eine', 'ein', '—'] }],
      steps: [{ focus: 'nom:0', note: 'En Nominativ, el masculino es «der».' }, { focus: 'akk:0', note: 'En Akkusativ cambia a «den».' }, { focus: 'eakk:0', note: 'Con «ein» pasa lo mismo: ein → einen.' }, { focus: 'akk:1', note: 'Femenino, neutro y plural no cambian.' }],
      speech: [{ text: 'En alemán, el artículo masculino cambia de der a den cuando usamos el Akkusativ.', lang: 'es', focus: 'nom:0' }, { text: 'der', lang: 'de', focus: 'nom:0' }, { text: 'den', lang: 'de', focus: 'akk:0' }, { text: 'Con ein pasa igual: ein, einen.', lang: 'es', focus: 'eakk:0' }, { text: 'Femenino, neutro y plural se quedan igual.', lang: 'es', focus: 'akk:1' }] },
    { kind: 'theory', id: 'akk-t2', title: 'Solo cambia el masculino', ruleId: 'akk-obj', text: `${rule('akk-obj').rule}`, example: { de: 'Ich sehe den Hund, die Katze und das Auto.', es: 'Veo al perro, al gato y el coche.' } },
    { kind: 'comparison', id: 'akk-c1', title: 'Nominativ frente a Akkusativ',
      left: { title: 'Nominativ · quien hace la acción', items: [{ de: 'Der Hund schläft.', es: 'El perro duerme.', mark: 'Der Hund' }, { de: 'Der Lehrer kommt.', es: 'El profesor viene.', mark: 'Der Lehrer' }] },
      right: { title: 'Akkusativ · lo que recibe la acción', items: [{ de: 'Ich sehe den Hund.', es: 'Veo al perro.', mark: 'den Hund' }, { de: 'Ich kenne den Lehrer.', es: 'Conozco al profesor.', mark: 'den Lehrer' }] } },
    { kind: 'multiple-choice', id: 'akk-e1', title: 'Ejercicio 1', prompt: 'Ich kaufe ___ Tisch.', options: ['ein', 'einen', 'einem'], answer: 1, ruleId: 'akk-obj',
      hint: 'Tisch es masculino (der Tisch) y es lo que se compra: el complemento directo.', explain: 'Correcto: der Tisch es masculino y aquí es complemento directo, así que ein → einen.' },
    { kind: 'fill-blank', id: 'akk-e2', title: 'Ejercicio 2', prompt: 'Er hat ___ Bruder.', answers: ['einen'], ruleId: 'akk-obj',
      hint: 'Piensa en el género: der Bruder. ¿Qué pasa con «ein» en masculino y Akkusativ?', explain: 'Er hat einen Bruder: der Bruder es masculino y es lo que «tiene» (complemento directo).' },
    { kind: 'multiple-choice', id: 'akk-e3', title: 'Ejercicio 3', prompt: 'Ich sehe ___ Katze.', options: ['der', 'die', 'den'], answer: 1, ruleId: 'akk-obj',
      hint: 'Die Katze es femenino. ¿Cambia el femenino en Akkusativ?', explain: 'Ich sehe die Katze: el femenino no cambia en Akkusativ (die → die).' },
    { kind: 'fill-blank', id: 'akk-e4', title: 'Ejercicio 4', prompt: 'Wo ist der Hund? Ich suche ___ Hund.', answers: ['den'], ruleId: 'akk-obj',
      hint: 'Buscas al perro: es el complemento directo y «Hund» es masculino.', explain: 'Ich suche den Hund: masculino + complemento directo → der → den.' },
    { kind: 'sentence-builder', id: 'akk-e5', title: 'Ejercicio 5', prompt: 'Ordena la frase: «Compro un libro».', words: ['Buch', 'Ich', 'ein', 'kaufe'], solutions: [['Ich', 'kaufe', 'ein', 'Buch']], ruleId: 'akk-obj',
      hint: 'Sujeto primero, el verbo en 2.ª posición. «Buch» es neutro: ¿cambia con Akkusativ?', explain: 'Ich kaufe ein Buch: das Buch es neutro y no cambia (ein → ein).' },
    { kind: 'matching', id: 'akk-e6', title: 'Ejercicio 6', prompt: 'Une cada palabra con su forma en Akkusativ.',
      pairs: [{ left: 'der Hund', right: 'den Hund' }, { left: 'die Katze', right: 'die Katze' }, { left: 'das Auto', right: 'das Auto' }, { left: 'der Apfel', right: 'den Apfel' }], ruleId: 'akk-obj',
      hint: 'Solo el masculino (der) cambia. Los demás se quedan igual.', explain: 'Cambian der Hund → den Hund y der Apfel → den Apfel; die Katze y das Auto no cambian.' },
    { kind: 'multiple-choice', id: 'akk-e7', title: 'Ejercicio 7', prompt: 'Das Geschenk ist für ___ Vater.', options: ['dem', 'den', 'der'], answer: 1, ruleId: 'akk-prep',
      hint: 'Mira la preposición «für»: siempre pide el mismo caso.', explain: `Correcto. ${rule('akk-prep').rule}` },
    { kind: 'listening', id: 'akk-l1', title: 'Escucha', prompt: 'Escucha la frase y elige la que oyes.', audio: 'akk-l1', options: ['Ich kaufe ein Tisch und eine Lampe.', 'Ich kaufe einen Tisch und eine Lampe.'], answer: 1, ruleId: 'akk-obj',
      hint: 'Fíjate en el final de «ein»: ¿suena «ein» o «einen»?', explain: 'Se oye «einen Tisch»: Tisch es masculino y complemento directo.' },
    { kind: 'dialogue', id: 'akk-d1', title: 'Diálogo guiado: en la frutería',
      lines: [{ who: 'Verkäuferin', de: 'Was möchten Sie?', es: '¿Qué desea?' }, { who: 'Kunde', de: 'Ich möchte einen Apfel und eine Banane.', es: 'Quiero una manzana y un plátano.', mark: 'einen Apfel' }, { who: 'Verkäuferin', de: 'Sonst noch etwas?', es: '¿Algo más?' }, { who: 'Kunde', de: 'Nein, danke. Das ist alles.', es: 'No, gracias. Eso es todo.' }] },
    { kind: 'checkpoint', id: 'akk-k1', title: 'Comprobación', text: 'Veamos cómo vas con los ejercicios de esta lección.', pass: 0.6 },
  ],
  remedial: [
    { kind: 'multiple-choice', id: 'akk-r1', title: 'Refuerzo 1', prompt: 'Wir haben ___ Lehrer.', options: ['ein', 'einen'], answer: 1, ruleId: 'akk-obj',
      hint: 'Der Lehrer es masculino y es lo que «tenemos».', explain: 'Wir haben einen Lehrer: masculino + complemento directo → einen.' },
    { kind: 'fill-blank', id: 'akk-r2', title: 'Refuerzo 2', prompt: 'Ich esse ___ Apfel.', answers: ['einen'], ruleId: 'akk-obj',
      hint: 'Der Apfel es masculino; lo que comes es el complemento directo.', explain: 'Ich esse einen Apfel: der Apfel es masculino, ein → einen.' },
  ],
};
/** Orden del curso: primero A1 y luego A2; dentro de cada nivel, el orden del banco. */
const A1_ORDER = ['vor-01', 'praes-01', 'satz-01', 'akk-01', 'poss-01', 'modal-01', 'trenn-01', 'imp-01'];
const byOrder = (a: Lesson, b: Lesson) => (A1_ORDER.indexOf(a.id) + 1 || 99) - (A1_ORDER.indexOf(b.id) + 1 || 99);
export const LESSONS: Lesson[] = [...[AKK_01, ...LESSONS_A1].sort(byOrder), ...LESSONS_A2];
export const lessonById = (id: string) => LESSONS.find((l) => l.id === id) ?? null;
export const audioAvailable = (key: string, dir = AUDIO_DIR) => /^[a-z0-9-]{1,40}$/.test(key) && existsSync(join(dir, `${key}.mp3`));

/** Actividades que el alumno realmente verá: omite las de escucha si el audio generado no existe (no se finge). */
export function basePlan(lesson: Lesson, audioDir = AUDIO_DIR): string[] {
  return lesson.activities.filter((a) => a.kind !== 'listening' || audioAvailable(a.audio, audioDir)).map((a) => a.id);
}
export const findActivity = (lesson: Lesson, id: string): Activity | null => lesson.activities.find((a) => a.id === id) ?? lesson.remedial.find((a) => a.id === id) ?? null;

// ───────────── Proyección pública ─────────────
const shuffleStable = (items: string[], seed: string): string[] => {
  let h = 2166136261; for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const out = [...items]; for (let i = out.length - 1; i > 0; i--) { h = Math.imul(h ^ i, 16777619) >>> 0; const j = h % (i + 1); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
};
export function publicActivity(a: Activity, lesson: Lesson, sessionId: string): PublicActivity {
  switch (a.kind) {
    case 'theory': return { kind: 'theory', id: a.id, title: a.title, text: a.text, example: a.example, verified: !!a.ruleId && lesson.verified, speech: a.speech };
    case 'grammar-table': return { kind: 'grammar-table', id: a.id, title: a.title, columns: a.columns, rows: a.rows, steps: a.steps, speech: a.speech };
    case 'comparison': return { kind: 'comparison', id: a.id, title: a.title, left: a.left, right: a.right, speech: a.speech };
    case 'dialogue': return { kind: 'dialogue', id: a.id, title: a.title, lines: a.lines, speech: a.speech };
    case 'multiple-choice': return { kind: 'multiple-choice', id: a.id, title: a.title, prompt: a.prompt, options: a.options };
    case 'fill-blank': return { kind: 'fill-blank', id: a.id, title: a.title, prompt: a.prompt };
    case 'sentence-builder': return { kind: 'sentence-builder', id: a.id, title: a.title, prompt: a.prompt, words: a.words };
    case 'matching': return { kind: 'matching', id: a.id, title: a.title, prompt: a.prompt, left: a.pairs.map((p) => p.left), right: shuffleStable(a.pairs.map((p) => p.right), `${sessionId}:${a.id}`) };
    case 'listening': return { kind: 'listening', id: a.id, title: a.title, prompt: a.prompt, options: a.options, audioUrl: `/api/klaus/klasse/audio?lesson=${lesson.id}&activity=${a.id}` };
    case 'checkpoint': return { kind: 'checkpoint', id: a.id, title: a.title, text: a.text };
  }
}

// ───────────── Corrección determinista (sin IA) ─────────────
const norm = (s: string) => s.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
export function revealOf(a: ExerciseActivity): string {
  switch (a.kind) {
    case 'multiple-choice': case 'listening': return a.options[a.answer];
    case 'fill-blank': return a.answers[0];
    case 'sentence-builder': return a.solutions[0].join(' ');
    case 'matching': return a.pairs.map((p) => `${p.left} → ${p.right}`).join(' · ');
  }
}
export function isCorrect(a: ExerciseActivity, p: AnswerPayload): boolean | null {
  switch (a.kind) {
    case 'multiple-choice': case 'listening': return 'choice' in p && Number.isInteger(p.choice) ? p.choice === a.answer : null;
    case 'fill-blank': return 'text' in p && typeof p.text === 'string' && p.text.length <= 60 ? a.answers.some((x) => norm(x) === norm(p.text)) : null;
    case 'sentence-builder': return 'order' in p && Array.isArray(p.order) && p.order.every((w) => typeof w === 'string') ? a.solutions.some((s) => s.length === p.order.length && s.every((w, i) => w === p.order[i])) : null;
    case 'matching': return null; // se corrige con gradeMatching (necesita la barajada propia de la sesión)
  }
}
export function gradeMatching(a: Extract<ExerciseActivity, { kind: 'matching' }>, sessionId: string, p: AnswerPayload): boolean | null {
  if (!('pairs' in p) || !Array.isArray(p.pairs) || p.pairs.length !== a.pairs.length || !p.pairs.every((n) => Number.isInteger(n) && n >= 0 && n < a.pairs.length)) return null;
  if (new Set(p.pairs).size !== a.pairs.length) return null;
  const right = shuffleStable(a.pairs.map((x) => x.right), `${sessionId}:${a.id}`);
  return a.pairs.every((pair, i) => right[p.pairs[i]] === pair.right);
}

/** Corrige un ejercicio y decide el feedback con plantillas predefinidas. `tries` = intentos YA gastados antes de este. */
export function grade(a: ExerciseActivity, payload: AnswerPayload, tries: number, maxTries: number, sessionId: string): AnswerResult | null {
  const ok = a.kind === 'matching' ? gradeMatching(a, sessionId, payload) : isCorrect(a, payload);
  if (ok === null) return null; // formato inválido: el servidor lo rechaza
  const used = tries + 1;
  if (ok) return { ok: true, tries: used, feedback: a.explain, hint: null, reveal: null, done: true };
  if (used >= maxTries) return { ok: false, tries: used, feedback: `No pasa nada. ${a.explain}`, hint: null, reveal: { answer: revealOf(a) }, done: true };
  return { ok: false, tries: used, feedback: 'Casi. Mira la pista e inténtalo otra vez.', hint: a.hint, reveal: null, done: false };
}

export interface PlanState { plan: string[]; step: number; answers: Record<string, { choice: string; ok: boolean; tries: number }>; remedialAdded: boolean }
/** Resultado de los ejercicios de la lección principal (no cuenta el refuerzo). */
export function score(lesson: Lesson, st: Pick<PlanState, 'answers'>): { correct: number; total: number } {
  const ids = lesson.activities.filter(isExercise).map((a) => a.id).filter((id) => st.answers[id]);
  return { correct: ids.filter((id) => st.answers[id].ok).length, total: ids.length };
}
/** Regla de progresión: al llegar al checkpoint, si no se alcanza el ratio mínimo se añade el refuerzo (una sola vez). */
export function afterCheckpoint(lesson: Lesson, st: PlanState): { added: string[] } {
  const s = score(lesson, st), cp = lesson.activities.find((a) => a.kind === 'checkpoint');
  const pass = cp && cp.kind === 'checkpoint' ? cp.pass : lesson.completion.minRatio;
  if (st.remedialAdded || !s.total || s.correct / s.total >= pass) return { added: [] };
  const ids = lesson.remedial.map((a) => a.id); st.plan.splice(st.step + 1, 0, ...ids); st.remedialAdded = true; return { added: ids };
}
export function recommendation(lesson: Lesson, st: Pick<PlanState, 'answers'>): { correct: number; total: number; passed: boolean; recommendation: string } {
  const s = score(lesson, st), passed = s.total > 0 && s.correct / s.total >= lesson.completion.minRatio;
  const extra = [...lesson.remedial].filter((a) => st.answers[a.id]);
  const extraOk = extra.length > 0 && extra.every((a) => st.answers[a.id].ok);
  return { ...s, passed: passed || extraOk, recommendation: passed ? 'Buen trabajo: puedes pasar a practicar este tema en «Practicar».' : extraOk ? 'Con el refuerzo lo has afianzado. Practica este tema para consolidarlo.' : 'Repite la lección con calma y pregúntale a Klaus lo que no tengas claro.' };
}
