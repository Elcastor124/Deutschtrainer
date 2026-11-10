// OpenRouter SOLO GRATIS: nunca envía modelos de pago, siempre pide max_price 0, se apaga si ve un coste y cae al modo
// determinista si los modelos gratis están saturados. Sin red: fetch simulado.
import { describe, expect, it } from 'vitest';
import { FREE_MODELS, OpenRouterFreeLlm, buildProviders, loadAiConfig, parseJsonLoose, type LlmProvider, type LlmRequest } from '../server/ai/providers.ts';
import { MockLlm } from '../server/ai/mock-llm.ts';

const req: LlmRequest = { task: 'redet_turn', system: 'sys', user: '<texto_alumno>Hallo</texto_alumno>', input: { scenarioId: 'libre', turn: 0, text: 'Hallo' }, schemaName: 's', schema: { type: 'object' }, maxTokens: 100 };
const fallback: LlmProvider = { name: 'mock', model: 'mock', real: false, complete: async () => ({ json: { reply: 'MOCK' }, usage: { inputTokens: 0, outputTokens: 0 }, model: 'mock', latencyMs: 0 }) };
const ok = (content: string, cost = 0) => new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 5, completion_tokens: 7, cost } }), { status: 200 });
function spy(responses: (Response | Error)[]) {
  const calls: { url: string; body: any; auth: string }[] = [];
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)), auth: String((init.headers as Record<string, string>).authorization) });
    const r = responses.shift() ?? new Response('{}', { status: 429 }); if (r instanceof Error) throw r; return r;
  }) as unknown as typeof fetch;
  return { f, calls };
}

describe('configuración', () => {
  it('solo se activa con openrouter-free + clave; no necesita KLAUS_ALLOW_PAID y descarta modelos que no son :free', () => {
    const c = loadAiConfig({ KLAUS_LLM_PROVIDER: 'openrouter-free', OPENROUTER_API_KEY: 'sk-or-v1-a', OPENROUTER_API_KEY_2: 'sk-or-v1-b', KLAUS_FREE_MODELS: 'openai/gpt-5,x/y:free' } as NodeJS.ProcessEnv);
    expect(c.llm).toMatchObject({ provider: 'openrouter-free', keys: ['sk-or-v1-a', 'sk-or-v1-b'], models: ['x/y:free'] });
    expect(loadAiConfig({ KLAUS_LLM_PROVIDER: 'openrouter-free' } as NodeJS.ProcessEnv).llm.provider).toBe('mock');
    expect(loadAiConfig({ OPENROUTER_API_KEY: 'sk-or-v1-a' } as NodeJS.ProcessEnv).llm.provider).toBe('mock');
    expect(FREE_MODELS.every((m) => m.endsWith(':free'))).toBe(true);
    // Voz sigue apagada: no hay STT/TTS gratis aquí.
    const p = buildProviders(c, new MockLlm());
    expect(p.llm.name).toBe('openrouter-free'); expect(p.stt.real).toBe(false); expect(p.tts.real).toBe(false);
  });
});

describe('peticiones', () => {
  it('cada petición: modelo :free, max_price 0, sin fallbacks de pago y JSON por esquema', async () => {
    const { f, calls } = spy([ok('{"reply":"Hallo!"}')]);
    const llm = new OpenRouterFreeLlm({ keys: ['sk-or-v1-a'], models: ['a/b:free', 'paid/model'], fallback, fetch: f });
    const r = await llm.complete(req);
    expect(r.json).toEqual({ reply: 'Hallo!' }); expect(r.fallback).toBeUndefined();
    expect(calls).toHaveLength(1);
    expect(calls[0].body.model).toBe('a/b:free');
    expect(calls[0].body.provider).toEqual({ max_price: { prompt: 0, completion: 0, request: 0 }, allow_fallbacks: false });
    expect(calls[0].body.response_format.type).toBe('json_schema');
    expect(calls[0].url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(calls[0].body.reasoning).toEqual({ enabled: false });
  });
  it('si el modelo exige razonamiento (400), reintenta el mismo modelo con razonamiento mínimo', async () => {
    const { f, calls } = spy([new Response('{}', { status: 400 }), ok('{"reply":"Gut"}')]);
    const r = await new OpenRouterFreeLlm({ keys: ['sk-or-v1-a'], models: ['a:free'], fallback, fetch: f }).complete(req);
    expect(r.json).toEqual({ reply: 'Gut' }); expect(calls.map((c) => c.body.model)).toEqual(['a:free', 'a:free']);
    expect(calls[1].body.reasoning).toEqual({ effort: 'low', exclude: true });
  });
  it('429 en un modelo → prueba el siguiente gratis con la otra clave', async () => {
    const { f, calls } = spy([new Response('{}', { status: 429 }), ok('```json\n{"reply":"Ja"}\n```')]);
    const llm = new OpenRouterFreeLlm({ keys: ['sk-or-v1-a', 'sk-or-v1-b'], models: ['a:free', 'b:free'], fallback, fetch: f });
    const r = await llm.complete(req);
    expect(r.json).toEqual({ reply: 'Ja' }); expect(calls.map((c) => c.body.model)).toEqual(['a:free', 'b:free']);
    expect(new Set(calls.map((c) => c.auth)).size).toBe(2);
  });
  it('todo saturado → responde el modo determinista (fallback), sin error', async () => {
    const { f } = spy([new Response('{}', { status: 429 }), new Response('{}', { status: 503 }), new Error('net')]);
    const r = await new OpenRouterFreeLlm({ keys: ['sk-or-v1-a'], models: ['a:free', 'b:free', 'c:free'], fallback, fetch: f }).complete(req);
    expect(r).toMatchObject({ json: { reply: 'MOCK' }, fallback: true });
  });
  it('si OpenRouter informa de un coste > 0, descarta la respuesta y no vuelve a llamar nunca', async () => {
    const { f, calls } = spy([ok('{"reply":"caro"}', 0.0001), ok('{"reply":"x"}')]);
    const llm = new OpenRouterFreeLlm({ keys: ['sk-or-v1-a'], models: ['a:free'], fallback, fetch: f });
    expect((await llm.complete(req)).fallback).toBe(true);
    expect(llm.disabled).toBe(true);
    await llm.complete(req); expect(calls).toHaveLength(1);
  });
  it('clave rechazada (401/402) → se retira esa clave; sin claves, se apaga', async () => {
    const { f } = spy([new Response('{}', { status: 402 })]);
    const llm = new OpenRouterFreeLlm({ keys: ['sk-or-v1-a'], models: ['a:free'], fallback, fetch: f });
    expect((await llm.complete(req)).fallback).toBe(true); expect(llm.disabled).toBe(true);
  });
  it('parseJsonLoose', () => {
    expect(parseJsonLoose('{"a":1}')).toEqual({ a: 1 }); expect(parseJsonLoose('texto {"a":2} fin')).toEqual({ a: 2 }); expect(parseJsonLoose('nada')).toBeUndefined(); expect(parseJsonLoose(null)).toBeUndefined();
  });
});
