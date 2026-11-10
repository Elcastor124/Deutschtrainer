// Klaus AI · proveedor DETERMINISTA para desarrollo, pruebas y modo sin claves. NO es IA: detecta un puñado de errores
// típicos A1–A2 con patrones verificados (los mismos pares correcto/incorrecto de server/tutor.ts) y responde con guiones.
// Toda salida lleva source:'mock' hasta la interfaz: nunca se presenta como inteligencia real.
import { REDET_SCENARIOS, freeTopicById, scenarioById } from '../../shared/klaus-content.ts';
import { RULES } from '../tutor.ts';
import type { LlmProvider, LlmRequest, LlmResult } from './providers.ts';

interface Pattern { re: RegExp; fix: (m: RegExpExecArray) => string; category: string; kind: 'error' | 'unnatural'; severity: 'high' | 'medium' | 'low'; explanation: string; hint: string; ruleId?: string }
const PATTERNS: Pattern[] = [
  { re: /\b[Ii]ch habe (\d{1,2}) Jahre(?! alt)\b/, fix: (m) => `Ich bin ${m[1]} Jahre alt`, category: 'grammar', kind: 'error', severity: 'high', ruleId: 'vs-gen',
    explanation: 'En alemán la edad se dice con «sein» (Ich bin … Jahre alt), no con «haben».', hint: '¿Qué verbo se usa para decir la edad en alemán?' },
  { re: /\bweil ich bin\b/, fix: () => 'weil ich … bin', category: 'word_order', kind: 'error', severity: 'high', ruleId: 'neben',
    explanation: 'Tras «weil» el verbo conjugado va al final de la oración subordinada: «weil ich krank bin».', hint: 'Tras «weil», ¿dónde va el verbo conjugado?' },
  { re: /\b([Ii]ch) kann (\w+) (\w+e)\b(?=[ .!?,]|$)/, fix: (m) => `${m[1]} kann ${m[2]} ${m[3]}n`, category: 'grammar', kind: 'error', severity: 'medium', ruleId: 'modal',
    explanation: 'Con un verbo modal, el otro verbo va en infinitivo (terminado en -en) al final.', hint: 'El segundo verbo, ¿conjugado o en infinitivo?' },
  { re: /\bich gehe zu Schule\b/i, fix: () => 'ich gehe zur Schule', category: 'grammar', kind: 'error', severity: 'medium',
    explanation: '«zu» + «der» se contrae en «zur» (zu + der Schule → zur Schule).', hint: '«zu» con un sustantivo femenino, ¿cómo se contrae?' },
  { re: /\bIch bin (?:nach|zu) (?:Berlin|Hause) gefahren habe\b/, fix: () => 'Ich bin nach Berlin gefahren', category: 'grammar', kind: 'error', severity: 'high', ruleId: 'perf-aux',
    explanation: 'En Perfekt solo hay un auxiliar: con verbos de movimiento es «sein».', hint: '¿Cuántos auxiliares lleva el Perfekt?' },
  { re: /\b(Ich|Er|Sie) (?:wohnt|wohnst)\b/, fix: (m) => `${m[1]} ${m[1] === 'Ich' ? 'wohne' : 'wohnt'}`, category: 'grammar', kind: 'error', severity: 'medium', ruleId: 'praes-end',
    explanation: 'La terminación del verbo depende del sujeto: ich → -e, er/sie → -t.', hint: 'Mira el sujeto: ¿qué terminación le toca?' },
  { re: /\bich möchte ein (?:Cola|Wasser|Suppe)\b/i, fix: (m) => m[0].replace(/ ein /, ' eine ').replace(/Wasser/, 'ein Wasser'), category: 'grammar', kind: 'error', severity: 'low',
    explanation: 'Fíjate en el género del sustantivo: «die Cola», «das Wasser», «die Suppe».', hint: '¿Qué género tiene la bebida o el plato?' },
];

const rulesIndex = (id: string) => RULES.find((r) => r.id === id)?.rule ?? null;
export function mockDetect(text: string) {
  const out: { original: string; suggestion: string; category: string; kind: string; severity: string; explanation: string; hint: string; ruleId?: string }[] = [];
  for (const p of PATTERNS) { const m = p.re.exec(text); if (m && p.fix(m) !== m[0]) out.push({ original: m[0], suggestion: p.fix(m), category: p.category, kind: p.kind, severity: p.severity, explanation: p.explanation, hint: p.hint, ruleId: p.ruleId }); }
  return out;
}

export class MockLlm implements LlmProvider {
  readonly name = 'mock'; readonly model = 'determinista'; readonly real = false;
  async complete(req: LlmRequest): Promise<LlmResult> {
    const input = req.input as Record<string, unknown>;
    let json: unknown;
    switch (req.task) {
      case 'writing_review': {
        const text = String(input.text ?? '');
        json = { corrections: mockDetect(text), summary: mockDetect(text).length ? 'He encontrado algunos puntos a revisar (revisión automática básica, sin IA).' : 'No he detectado errores con las comprobaciones básicas. Esta revisión no usa IA real: no garantiza que el texto sea perfecto.' };
        break;
      }
      case 'redet_turn': {
        const sc = scenarioById(String(input.scenarioId)) ?? REDET_SCENARIOS[0], n = Number(input.turn) || 0, text = String(input.text ?? '');
        const script = freeTopicById(input.topic)?.script ?? sc.script;
        json = { reply: script[Math.min(n, script.length - 1)], corrections: mockDetect(text).map(({ hint: _h, ruleId: _r, ...c }) => c), expressions: sc.phrases.slice(0, 2) };
        break;
      }
      case 'redet_summary': {
        const sc = scenarioById(String(input.scenarioId)) ?? REDET_SCENARIOS[0];
        json = { topics: [sc.title], suggestions: ['Repite el diálogo en voz alta.', 'Practica las expresiones nuevas en una frase propia.'] };
        break;
      }
      case 'klasse_answer': {
        const q = String(input.question ?? '').toLowerCase(), topic = String(input.ruleId ?? '');
        const r = RULES.find((x) => x.id === topic) ?? (/(einen|akkusativ|den |wen)/.test(q) ? RULES.find((x) => x.id === 'akk-obj') : undefined);
        json = r ? { action: 'explain', activityId: null, text: `${r.rule} (Respuesta preparada del banco del profesor; con la IA real activada podría adaptarla a tu pregunta.)`, example: { de: r.example.ok.replace(/\s*\(.*\)$/, ''), es: 'Ejemplo correcto.' } }
          : { action: 'out_of_scope', activityId: null, text: 'No tengo una explicación verificada para esa pregunta y no quiero inventarla. Con la IA real configurada podría responderla; mientras tanto, apúntala y pregúntasela al profesor.' };
        break;
      }
      default: json = {};
    }
    return { json, usage: { inputTokens: 0, outputTokens: 0 }, model: this.model, latencyMs: 0 };
  }
}
export { rulesIndex };
