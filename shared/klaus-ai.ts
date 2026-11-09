// Klaus AI · contratos compartidos servidor/cliente y VALIDACIÓN de lo que devuelva un modelo.
// Regla de oro: la salida de un LLM es DATO NO CONFIABLE. Nada se muestra ni se guarda sin pasar por estos parsers
// (esquema estricto, enumeraciones cerradas, límites de longitud, localización real del fragmento en el texto del alumno).
export const AI_LEVELS = ['A1', 'A2'] as const;
export type AiLevel = (typeof AI_LEVELS)[number];
export type KlausPlan = 'free' | 'plus';
export type KlausFeature = 'text' | 'voiceSeconds' | 'ttsChars' | 'klasseSessions' | 'klasseAsks';

export const CORRECTION_CATEGORIES = ['grammar', 'spelling', 'vocabulary', 'word_order', 'register', 'naturalness'] as const;
export type CorrectionCategory = (typeof CORRECTION_CATEGORIES)[number];
/** error = incorrecto · unnatural = aceptable pero poco natural · style = alternativa opcional (NO es un fallo). */
export const CORRECTION_KINDS = ['error', 'unnatural', 'style'] as const;
export type CorrectionKind = (typeof CORRECTION_KINDS)[number];
export const SEVERITIES = ['high', 'medium', 'low'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const CATEGORY_LABEL: Record<CorrectionCategory, string> = {
  grammar: 'Gramática', spelling: 'Ortografía', vocabulary: 'Vocabulario', word_order: 'Orden de palabras', register: 'Registro', naturalness: 'Naturalidad',
};
export const KIND_LABEL: Record<CorrectionKind, string> = { error: 'Error', unnatural: 'Poco natural', style: 'Opcional' };

export const AI_LIMITS = {
  writingChars: 4000, titleChars: 80, correctionsMax: 25, fragmentChars: 200, explanationChars: 420, summaryChars: 360,
  replyChars: 600, expressionsMax: 4, askChars: 400, answerChars: 700, transcriptChars: 800,
  draftsMax: 20, reviewsPerDraftMax: 12,
} as const;

export interface WritingCorrection {
  id: string; start: number; end: number; original: string; suggestion: string;
  category: CorrectionCategory; kind: CorrectionKind; severity: Severity;
  /** Explicación en español. */ explanation: string;
  /** Regla gramatical relacionada (texto verificado del banco del profesor), si procede. */ rule: string | null;
  /** Pista para el modo guiado: orienta sin dar la solución. */ hint: string;
}
export interface WritingReview { corrections: WritingCorrection[]; summary: string; looksCorrect: boolean; source: 'mock' | 'ai'; dropped: number }

/** Quita caracteres de control y recorta. El render en React ya escapa; esto evita basura y desbordes. */
export const clean = (v: unknown, max: number): string => (typeof v === 'string' ? v : '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
const oneOf = <T extends string>(list: readonly T[], v: unknown): T | null => (typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : null);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Localiza `fragment` en `text` sin solaparse con rangos ya aceptados. -1 si no existe (el modelo no sabe contar posiciones: las calculamos nosotros). */
export function locate(text: string, fragment: string, taken: [number, number][]): number {
  let from = 0;
  for (;;) {
    const i = text.indexOf(fragment, from);
    if (i < 0) return -1;
    if (!taken.some(([a, b]) => i < b && i + fragment.length > a)) return i;
    from = i + 1;
  }
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** Valida una revisión de escritura devuelta por un proveedor. Descarta (y cuenta) lo inválido; nunca lanza. */
export function parseWritingReview(raw: unknown, text: string, source: 'mock' | 'ai', rules: (id: string) => string | null = () => null): Parsed<WritingReview> {
  if (!isObj(raw) || !Array.isArray(raw.corrections)) return { ok: false, error: 'La respuesta del modelo no tiene el formato esperado.' };
  const taken: [number, number][] = [];
  const out: WritingCorrection[] = [];
  let dropped = 0;
  for (const c of raw.corrections.slice(0, AI_LIMITS.correctionsMax * 2)) {
    if (!isObj(c)) { dropped++; continue; }
    const original = typeof c.original === 'string' ? c.original : '';
    const suggestion = clean(c.suggestion, AI_LIMITS.fragmentChars);
    const category = oneOf(CORRECTION_CATEGORIES, c.category), kind = oneOf(CORRECTION_KINDS, c.kind), severity = oneOf(SEVERITIES, c.severity);
    const explanation = clean(c.explanation, AI_LIMITS.explanationChars);
    if (!original || original.length > AI_LIMITS.fragmentChars || !suggestion || suggestion === original || !category || !kind || !severity || !explanation) { dropped++; continue; }
    const start = locate(text, original, taken);
    if (start < 0) { dropped++; continue; } // el fragmento no está en el texto del alumno: se descarta (no se «inventa» una corrección)
    taken.push([start, start + original.length]);
    const ruleId = typeof c.ruleId === 'string' ? c.ruleId : '';
    out.push({
      id: '', start, end: start + original.length, original, suggestion, category, kind, severity, explanation,
      rule: (ruleId && rules(ruleId)) || null, hint: clean(c.hint, 200) || 'Fíjate en este fragmento: ¿qué cambiarías?',
    });
    if (out.length >= AI_LIMITS.correctionsMax) break;
  }
  out.sort((a, b) => a.start - b.start);
  out.forEach((c, i) => { c.id = `c${i + 1}`; });
  // «Parece correcto» lo decidimos nosotros: solo si no hay ningún error real (las alternativas de estilo no cuentan).
  const looksCorrect = !out.some((c) => c.kind === 'error');
  return { ok: true, value: { corrections: out, summary: clean(raw.summary, AI_LIMITS.summaryChars) || (looksCorrect ? 'No veo errores en este texto.' : 'Hay cosas que mejorar.'), looksCorrect, source, dropped } };
}

export interface RedetCorrection { original: string; suggestion: string; category: CorrectionCategory; kind: CorrectionKind; explanation: string }
export interface RedetExpression { de: string; es: string }
export interface RedetTurnResult { reply: string; corrections: RedetCorrection[]; expressions: RedetExpression[] }

export function parseRedetTurn(raw: unknown, studentText: string): Parsed<RedetTurnResult> {
  if (!isObj(raw)) return { ok: false, error: 'La respuesta del modelo no tiene el formato esperado.' };
  const reply = clean(raw.reply, AI_LIMITS.replyChars);
  if (!reply) return { ok: false, error: 'El modelo no devolvió respuesta.' };
  const corrections: RedetCorrection[] = [];
  for (const c of Array.isArray(raw.corrections) ? raw.corrections.slice(0, 6) : []) {
    if (!isObj(c)) continue;
    const original = clean(c.original, AI_LIMITS.fragmentChars), suggestion = clean(c.suggestion, AI_LIMITS.fragmentChars);
    const category = oneOf(CORRECTION_CATEGORIES, c.category), kind = oneOf(CORRECTION_KINDS, c.kind), explanation = clean(c.explanation, AI_LIMITS.explanationChars);
    // Solo se admite una corrección si el fragmento está de verdad en lo que dijo el alumno (nada de errores inventados).
    if (!original || !suggestion || original === suggestion || !category || !kind || !explanation || !studentText.includes(original)) continue;
    corrections.push({ original, suggestion, category, kind, explanation });
  }
  const expressions: RedetExpression[] = [];
  for (const e of Array.isArray(raw.expressions) ? raw.expressions.slice(0, AI_LIMITS.expressionsMax) : []) {
    if (!isObj(e)) continue;
    const de = clean(e.de, 80), es = clean(e.es, 80);
    if (de && es) expressions.push({ de, es });
  }
  return { ok: true, value: { reply, corrections, expressions } };
}

/** Acciones compactas que puede pedir Klaus en una clase. La interfaz las interpreta con componentes existentes: nunca HTML/JS. */
export const KLASSE_ACTIONS = ['explain', 'example', 'repeat_rule', 'slower', 'extra_exercise', 'continue', 'out_of_scope'] as const;
export type KlasseAction = (typeof KLASSE_ACTIONS)[number];
export interface KlasseAnswer { action: KlasseAction; activityId: string | null; text: string; example: { de: string; es: string } | null }

export function parseKlasseAnswer(raw: unknown, activityIds: readonly string[]): Parsed<KlasseAnswer> {
  if (!isObj(raw)) return { ok: false, error: 'La respuesta del modelo no tiene el formato esperado.' };
  const action = oneOf(KLASSE_ACTIONS, raw.action);
  const text = clean(raw.text, AI_LIMITS.answerChars);
  if (!action || !text) return { ok: false, error: 'Acción o texto no válidos.' };
  const activityId = typeof raw.activityId === 'string' && activityIds.includes(raw.activityId) ? raw.activityId : null; // un id inventado se ignora
  let example: KlasseAnswer['example'] = null;
  if (isObj(raw.example)) { const de = clean(raw.example.de, 140), es = clean(raw.example.es, 140); if (de && es) example = { de, es }; }
  return { ok: true, value: { action, activityId, text, example } };
}
