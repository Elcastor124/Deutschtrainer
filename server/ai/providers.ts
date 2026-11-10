// Klaus AI · proveedores (LLM, STT, TTS) detrás de interfaces. Cambiar de proveedor = otra clase, sin tocar funcionalidades.
// SEGURIDAD Y GASTO:
//  · Las claves solo se leen aquí (process.env del servidor) y jamás viajan al cliente ni a los logs.
//  · Un adaptador REAL solo se activa si: KLAUS_<X>_PROVIDER lo pide + hay clave + KLAUS_ALLOW_PAID=1 + están definidos sus precios.
//    Si falta algo, se usa el modo determinista y /api/klaus/status explica por qué (no se simula que la IA real funciona).
//  · Sin reintentos automáticos en el servidor (un reintento = gasto duplicado). El cliente reintenta con el mismo requestId (idempotente).
import type { AiLevel } from '../../shared/klaus-ai.ts';

export type LlmTask = 'writing_review' | 'writing_task' | 'redet_turn' | 'redet_summary' | 'klasse_answer';
export interface LlmRequest {
  task: LlmTask;
  /** Instrucciones fijas del sistema (nunca contienen datos del alumno). */ system: string;
  /** Mensaje de usuario con delimitadores: el texto del alumno va como DATO. */ user: string;
  /** Entrada estructurada: la usa el proveedor determinista; los reales usan `user`. */ input: unknown;
  schemaName: string; schema: Record<string, unknown>; maxTokens: number; signal?: AbortSignal;
}
export interface Usage { inputTokens: number; outputTokens: number }
/** fallback: la respuesta la dio el modo determinista porque la IA gratuita no estaba disponible (no es IA, coste 0). */
export interface LlmResult { json: unknown; usage: Usage; model: string; latencyMs: number; fallback?: boolean }
export interface LlmProvider { readonly name: string; readonly model: string; readonly real: boolean; complete(req: LlmRequest): Promise<LlmResult> }

export interface SttRequest { audio: Buffer; mime: string; seconds: number; language: 'de'; prompt?: string; signal?: AbortSignal }
export interface SttResult { text: string; seconds: number; model: string; latencyMs: number }
export interface SttProvider { readonly name: string; readonly model: string; readonly real: boolean; transcribe(req: SttRequest): Promise<SttResult> }

export interface TtsRequest { text: string; voice: string; signal?: AbortSignal }
export interface TtsResult { audio: Buffer; mime: string; chars: number; model: string; latencyMs: number }
export interface TtsProvider { readonly name: string; readonly model: string; readonly voice: string; readonly real: boolean; synthesize(req: TtsRequest): Promise<TtsResult> }

export class ProviderError extends Error {
  kind: 'not_configured' | 'rate_limited' | 'auth' | 'bad_request' | 'unavailable' | 'timeout' | 'cancelled' | 'bad_output';
  status: number;
  constructor(kind: ProviderError['kind'], message: string, status = 502) { super(message); this.kind = kind; this.status = status; }
}

// ───────────── Configuración ─────────────
export interface Prices { llmInPerM: number | null; llmOutPerM: number | null; sttPerMinute: number | null; ttsPer1kChars: number | null }
export interface KlausAiConfig {
  llm: { provider: 'mock' | 'anthropic' | 'openrouter-free'; model: string; key?: string; keys?: string[]; models?: string[]; reason?: string };
  stt: { provider: 'mock' | 'openai'; model: string; key?: string; reason?: string };
  tts: { provider: 'mock' | 'openai'; model: string; voice: string; key?: string; reason?: string };
  allowPaid: boolean; prices: Prices; eurPerUsd: number; budgetEur: number; dailyBudgetEur: number;
}
const num = (v: string | undefined): number | null => { const n = Number(v); return v !== undefined && v !== '' && Number.isFinite(n) && n >= 0 ? n : null; };

export function loadAiConfig(env: NodeJS.ProcessEnv = process.env): KlausAiConfig {
  const allowPaid = env.KLAUS_ALLOW_PAID === '1';
  const prices: Prices = {
    llmInPerM: num(env.KLAUS_LLM_PRICE_IN_PER_M), llmOutPerM: num(env.KLAUS_LLM_PRICE_OUT_PER_M),
    // gpt-4o-mini-transcribe: 0,003 USD/min (tabla oficial de precios de OpenAI, consultada en esta sesión). Sobrescribible.
    sttPerMinute: num(env.KLAUS_STT_PRICE_PER_MIN) ?? 0.003,
    // El TTS de OpenAI factura por tokens de audio: no hay precio por carácter publicado → debe indicarlo quien lo active.
    ttsPer1kChars: num(env.KLAUS_TTS_PRICE_PER_1K_CHARS),
  };
  const pick = <P extends string>(want: string | undefined, real: P, key: string | undefined, priceOk: boolean, label: string): { provider: 'mock' | P; key?: string; reason?: string } => {
    if (!want || want === 'mock') return { provider: 'mock', reason: 'modo determinista (sin IA real)' };
    if (want !== real) return { provider: 'mock', reason: `${label}: proveedor «${want}» desconocido` };
    if (!allowPaid) return { provider: 'mock', reason: `${label}: falta KLAUS_ALLOW_PAID=1 (no se gasta sin autorización)` };
    if (!key) return { provider: 'mock', reason: `${label}: falta la clave API en el servidor` };
    if (!priceOk) return { provider: 'mock', reason: `${label}: faltan los precios configurados para medir el coste` };
    return { provider: real, key };
  };
  // OpenRouter SOLO GRATUITO: no necesita KLAUS_ALLOW_PAID porque nunca puede cobrar (ver OpenRouterFreeLlm). Se activa con
  // KLAUS_LLM_PROVIDER=openrouter-free + OPENROUTER_API_KEY (y opcionalmente OPENROUTER_API_KEY_2 como reserva).
  const orKeys = [env.OPENROUTER_API_KEY, env.OPENROUTER_API_KEY_2].filter((k): k is string => !!k && k.startsWith('sk-or-'));
  const orModels = (env.KLAUS_FREE_MODELS || FREE_MODELS.join(',')).split(',').map((m) => m.trim()).filter((m) => m.endsWith(':free'));
  const llm = env.KLAUS_LLM_PROVIDER === 'openrouter-free'
    ? orKeys.length && orModels.length ? { provider: 'openrouter-free' as const, keys: orKeys, models: orModels } : { provider: 'mock' as const, reason: 'LLM gratuito: falta OPENROUTER_API_KEY o modelos :free' }
    : pick(env.KLAUS_LLM_PROVIDER, 'anthropic', env.ANTHROPIC_API_KEY, prices.llmInPerM !== null && prices.llmOutPerM !== null, 'LLM');
  const stt = pick(env.KLAUS_STT_PROVIDER, 'openai', env.OPENAI_API_KEY, true, 'STT');
  const tts = pick(env.KLAUS_TTS_PROVIDER, 'openai', env.OPENAI_API_KEY, prices.ttsPer1kChars !== null, 'TTS');
  return {
    llm: { ...llm, model: llm.provider === 'openrouter-free' ? orModels[0] : env.KLAUS_LLM_MODEL || 'claude-haiku-5-5' },
    stt: { ...stt, model: env.KLAUS_STT_MODEL || 'gpt-4o-mini-transcribe' },
    tts: { ...tts, model: env.KLAUS_TTS_MODEL || 'gpt-4o-mini-tts', voice: env.KLAUS_TTS_VOICE || 'marin' },
    allowPaid, prices, eurPerUsd: num(env.KLAUS_EUR_PER_USD) ?? 0.9,
    budgetEur: num(env.KLAUS_BUDGET_EUR) ?? 10, dailyBudgetEur: num(env.KLAUS_DAILY_BUDGET_EUR) ?? 1,
  };
}

// ───────────── Adaptadores reales ─────────────
type FetchLike = typeof fetch;
const TIMEOUT_MS = 25_000;
function signalFor(external?: AbortSignal): AbortSignal { const t = AbortSignal.timeout(TIMEOUT_MS); return external ? AbortSignal.any([t, external]) : t; }
function mapStatus(status: number): ProviderError {
  if (status === 401 || status === 403) return new ProviderError('auth', 'El proveedor rechazó las credenciales del servidor.', 502);
  if (status === 429) return new ProviderError('rate_limited', 'El proveedor está limitando las peticiones. Inténtalo en un momento.', 503);
  if (status >= 400 && status < 500) return new ProviderError('bad_request', 'El proveedor rechazó la petición.', 502);
  return new ProviderError('unavailable', 'El proveedor no está disponible ahora mismo.', 503);
}
function mapFetchError(e: unknown, external?: AbortSignal): ProviderError {
  if (external?.aborted) return new ProviderError('cancelled', 'Petición cancelada.', 499);
  const name = (e as { name?: string })?.name;
  if (name === 'TimeoutError') return new ProviderError('timeout', 'El proveedor tardó demasiado.', 504);
  if (name === 'AbortError') return new ProviderError('cancelled', 'Petición cancelada.', 499);
  return new ProviderError('unavailable', 'No se pudo contactar con el proveedor.', 503); // el mensaje original podría incluir datos de la petición: no se propaga
}

/** Anthropic Messages API (`POST /v1/messages`, cabeceras x-api-key y anthropic-version). Salida estructurada = tool_use forzado. */
export class AnthropicLlm implements LlmProvider {
  readonly name = 'anthropic'; readonly real = true; readonly model: string;
  #key: string; #fetch: FetchLike; #base: string;
  constructor(o: { key: string; model: string; fetch?: FetchLike; baseUrl?: string }) { this.#key = o.key; this.model = o.model; this.#fetch = o.fetch ?? fetch; this.#base = o.baseUrl ?? 'https://api.anthropic.com'; }
  async complete(req: LlmRequest): Promise<LlmResult> {
    const t0 = Date.now();
    let res: Response;
    try {
      res = await this.#fetch(`${this.#base}/v1/messages`, {
        method: 'POST', signal: signalFor(req.signal),
        headers: { 'x-api-key': this.#key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: this.model, max_tokens: req.maxTokens, system: req.system, messages: [{ role: 'user', content: req.user }],
          tools: [{ name: req.schemaName, description: 'Devuelve el resultado en el formato indicado.', input_schema: req.schema }],
          tool_choice: { type: 'tool', name: req.schemaName },
        }),
      });
    } catch (e) { throw mapFetchError(e, req.signal); }
    if (!res.ok) throw mapStatus(res.status);
    let body: { content?: { type: string; name?: string; input?: unknown }[]; usage?: { input_tokens?: number; output_tokens?: number }; stop_reason?: string };
    try { body = await res.json() as typeof body; } catch { throw new ProviderError('bad_output', 'Respuesta del proveedor ilegible.'); }
    const block = body.content?.find((b) => b.type === 'tool_use' && b.name === req.schemaName);
    if (!block || body.stop_reason === 'max_tokens') throw new ProviderError('bad_output', 'El modelo no devolvió un resultado utilizable.');
    return { json: block.input, usage: { inputTokens: body.usage?.input_tokens ?? 0, outputTokens: body.usage?.output_tokens ?? 0 }, model: this.model, latencyMs: Date.now() - t0 };
  }
}

/** Modelos gratuitos de OpenRouter probados con salida JSON por esquema (en orden de preferencia). Solo se admiten ids «:free». */
export const FREE_MODELS = ['dots-studio/dots-3-note-preview:free', 'nvidia/nemotron-3.5-super-vl:free', 'google/gemma-4-31b-it:free', 'google/gemma-4-26b-a4b-it:free', 'recursive/flint-v1.0:free'];

/**
 * OpenRouter, EXCLUSIVAMENTE gratis. Candados (cualquiera basta para no pagar):
 *  1) solo se envían modelos cuyo id termina en «:free» (se comprueba aquí, no solo en la config);
 *  2) cada petición lleva provider.max_price = 0 (OpenRouter rechaza cualquier proveedor que cobre);
 *  3) si la respuesta trae un coste > 0, se descarta y se apaga el adaptador (no se vuelve a llamar);
 *  4) las claves son de nivel gratuito (límite de crédito 0).
 * Si todos los modelos gratis están saturados (429) o fallan, responde el modo determinista (fallback) en vez de dar error:
 * el alumno nunca se queda sin respuesta y nunca se cobra.
 */
export class OpenRouterFreeLlm implements LlmProvider {
  readonly name = 'openrouter-free'; readonly real = true;
  #keys: string[]; #models: string[]; #fetch: FetchLike; #fallback: LlmProvider; #base: string; #off = false;
  /** Modelo → instante hasta el que se evita (tras 429/fallo), para no insistir sobre uno saturado. */
  #cool = new Map<string, number>(); #next = 0;
  /** Modelos que no permiten desactivar el razonamiento (aprendido tras un 400). */
  #mustReason = new Set<string>();
  constructor(o: { keys: string[]; models: string[]; fallback: LlmProvider; fetch?: FetchLike; baseUrl?: string }) {
    this.#keys = o.keys; this.#models = o.models.filter((m) => m.endsWith(':free')); this.#fallback = o.fallback; this.#fetch = o.fetch ?? fetch; this.#base = o.baseUrl ?? 'https://openrouter.ai/api/v1';
  }
  get model() { return this.#models[0] ?? 'none'; }
  get disabled() { return this.#off; }
  async complete(req: LlmRequest): Promise<LlmResult> {
    const t0 = Date.now(), now = Date.now();
    const order = this.#models.filter((m) => (this.#cool.get(m) ?? 0) <= now);
    const queue = this.#off ? [] : order.slice(0, 3);
    for (let i = 0; i < queue.length; i++) {
      const model = queue[i];
      if (Date.now() - t0 > 40_000) break; // el alumno no espera más: responde el modo determinista
      if (!model.endsWith(':free')) continue;
      const key = this.#keys[this.#next++ % this.#keys.length];
      let res: Response;
      try {
        res = await this.#fetch(`${this.#base}/chat/completions`, {
          method: 'POST', signal: signalFor(req.signal),
          headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', 'x-title': 'Deutschtrainer' },
          body: JSON.stringify({
            // Muchos modelos gratis «piensan» antes de responder: sin razonamiento (o mínimo si es obligatorio) y margen de tokens.
            model, max_tokens: Math.max(req.maxTokens * 3, 1500), reasoning: this.#mustReason.has(model) ? { effort: 'low', exclude: true } : { enabled: false }, provider: { max_price: { prompt: 0, completion: 0, request: 0 }, allow_fallbacks: false },
            messages: [{ role: 'system', content: `${req.system}\nDevuelve SOLO un objeto JSON válido que cumpla el esquema «${req.schemaName}». Sin texto fuera del JSON.` }, { role: 'user', content: req.user }],
            response_format: { type: 'json_schema', json_schema: { name: req.schemaName, strict: true, schema: req.schema } },
          }),
        });
      } catch (e) { if (req.signal?.aborted) throw mapFetchError(e, req.signal); this.#cool.set(model, Date.now() + 60_000); continue; }
      if (res.status === 400 && !this.#mustReason.has(model)) { this.#mustReason.add(model); i--; continue; } // mismo modelo, con razonamiento mínimo
      if (!res.ok) { this.#cool.set(model, Date.now() + (res.status === 429 ? 90_000 : 300_000)); if (res.status === 401 || res.status === 402) this.#keys = this.#keys.filter((k) => k !== key); if (!this.#keys.length) this.#off = true; continue; }
      let body: { choices?: { message?: { content?: string | null } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number } };
      try { body = await res.json() as typeof body; } catch { this.#cool.set(model, Date.now() + 60_000); continue; }
      if ((body.usage?.cost ?? 0) > 0) { this.#off = true; console.error('[klaus-ai] OpenRouter devolvió un coste > 0: IA desactivada (solo se permite gratis).'); break; }
      const json = parseJsonLoose(body.choices?.[0]?.message?.content);
      if (json === undefined) { this.#cool.set(model, Date.now() + 30_000); continue; }
      return { json, usage: { inputTokens: body.usage?.prompt_tokens ?? 0, outputTokens: body.usage?.completion_tokens ?? 0 }, model, latencyMs: Date.now() - t0 };
    }
    const r = await this.#fallback.complete(req);
    return { ...r, fallback: true, latencyMs: Date.now() - t0 };
  }
}
/** Acepta JSON puro o envuelto en ```json … ```. */
export function parseJsonLoose(s: unknown): unknown {
  if (typeof s !== 'string') return undefined;
  const t = s.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(t); } catch { const m = t.match(/\{[\s\S]*\}/); if (m) { try { return JSON.parse(m[0]); } catch { /* nada */ } } return undefined; }
}

/** OpenAI `POST /v1/audio/transcriptions` (multipart). STT solo transcribe: NO evalúa pronunciación. */
export class OpenAiStt implements SttProvider {
  readonly name = 'openai'; readonly real = true; readonly model: string;
  #key: string; #fetch: FetchLike; #base: string;
  constructor(o: { key: string; model: string; fetch?: FetchLike; baseUrl?: string }) { this.#key = o.key; this.model = o.model; this.#fetch = o.fetch ?? fetch; this.#base = o.baseUrl ?? 'https://api.openai.com'; }
  async transcribe(req: SttRequest): Promise<SttResult> {
    const t0 = Date.now();
    const form = new FormData();
    form.set('model', this.model); form.set('language', req.language); form.set('response_format', 'json');
    if (req.prompt) form.set('prompt', req.prompt.slice(0, 400));
    form.set('file', new Blob([new Uint8Array(req.audio)], { type: req.mime }), `turno.${req.mime.includes('mp4') ? 'm4a' : req.mime.includes('ogg') ? 'ogg' : 'webm'}`);
    let res: Response;
    try { res = await this.#fetch(`${this.#base}/v1/audio/transcriptions`, { method: 'POST', headers: { Authorization: `Bearer ${this.#key}` }, body: form, signal: signalFor(req.signal) }); }
    catch (e) { throw mapFetchError(e, req.signal); }
    if (!res.ok) throw mapStatus(res.status);
    const body = await res.json().catch(() => null) as { text?: unknown } | null;
    if (!body || typeof body.text !== 'string') throw new ProviderError('bad_output', 'Transcripción ilegible.');
    return { text: body.text, seconds: req.seconds, model: this.model, latencyMs: Date.now() - t0 };
  }
}

/** OpenAI `POST /v1/audio/speech`. AVISO (docs oficiales, consultadas en esta sesión): tts-1, tts-1-hd y gpt-4o-mini-tts se retiran el 2027-01-06. */
export class OpenAiTts implements TtsProvider {
  readonly name = 'openai'; readonly real = true; readonly model: string; readonly voice: string;
  #key: string; #fetch: FetchLike; #base: string;
  constructor(o: { key: string; model: string; voice: string; fetch?: FetchLike; baseUrl?: string }) { this.#key = o.key; this.model = o.model; this.voice = o.voice; this.#fetch = o.fetch ?? fetch; this.#base = o.baseUrl ?? 'https://api.openai.com'; }
  async synthesize(req: TtsRequest): Promise<TtsResult> {
    const t0 = Date.now();
    let res: Response;
    try {
      res = await this.#fetch(`${this.#base}/v1/audio/speech`, {
        method: 'POST', signal: signalFor(req.signal), headers: { Authorization: `Bearer ${this.#key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model: this.model, voice: req.voice || this.voice, input: req.text.slice(0, 4096), response_format: 'mp3' }),
      });
    } catch (e) { throw mapFetchError(e, req.signal); }
    if (!res.ok) throw mapStatus(res.status);
    const audio = Buffer.from(await res.arrayBuffer());
    if (audio.length < 100) throw new ProviderError('bad_output', 'El proveedor devolvió audio vacío.');
    return { audio, mime: 'audio/mpeg', chars: req.text.length, model: this.model, latencyMs: Date.now() - t0 };
  }
}

// ───────────── Modo determinista (pruebas y desarrollo sin claves) ─────────────
/** STT de pruebas: NO transcribe voz. Trata los bytes como texto UTF-8 (solo `text/plain`). La UI avisa de que no hay transcripción real. */
export class MockStt implements SttProvider {
  readonly name = 'mock'; readonly model = 'mock-stt'; readonly real = false;
  async transcribe(req: SttRequest): Promise<SttResult> {
    if (req.mime !== 'text/plain') throw new ProviderError('not_configured', 'La transcripción de voz no está configurada en este servidor.', 501);
    return { text: req.audio.toString('utf8').slice(0, 800), seconds: req.seconds, model: this.model, latencyMs: 0 };
  }
}
export class MockTts implements TtsProvider {
  readonly name = 'mock'; readonly model = 'mock-tts'; readonly voice = 'none'; readonly real = false;
  async synthesize(): Promise<TtsResult> { throw new ProviderError('not_configured', 'La síntesis de voz del servidor no está configurada (el navegador puede leer el texto).', 501); }
}

export interface Providers { llm: LlmProvider; stt: SttProvider; tts: TtsProvider; config: KlausAiConfig }
export function buildProviders(config: KlausAiConfig, mockLlm: LlmProvider, fetchImpl?: FetchLike): Providers {
  const llm = config.llm.provider === 'openrouter-free' && config.llm.keys?.length ? new OpenRouterFreeLlm({ keys: config.llm.keys, models: config.llm.models ?? [], fallback: mockLlm, fetch: fetchImpl })
    : config.llm.provider === 'anthropic' && config.llm.key ? new AnthropicLlm({ key: config.llm.key, model: config.llm.model, fetch: fetchImpl }) : mockLlm;
  const stt = config.stt.provider === 'openai' && config.stt.key ? new OpenAiStt({ key: config.stt.key, model: config.stt.model, fetch: fetchImpl }) : new MockStt();
  const tts = config.tts.provider === 'openai' && config.tts.key ? new OpenAiTts({ key: config.tts.key, model: config.tts.model, voice: config.tts.voice, fetch: fetchImpl }) : new MockTts();
  return { llm, stt, tts, config };
}

export const levelOrDefault = (v: unknown): AiLevel => (v === 'A2' ? 'A2' : 'A1');
