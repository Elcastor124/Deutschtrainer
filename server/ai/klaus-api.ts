// Klaus AI · API HTTP (/api/klaus/*). Un único handler para los tres modos; comparten identidad, cuotas, proveedores y métricas.
//   GET  /status                  estado de proveedores y cuotas del alumno (sin claves ni secretos)
//   Schreibt:  GET /writing/tasks · /writing/drafts · POST /writing/draft · /writing/draft/delete · /writing/review · /writing/review/resolve
//   Redet:     GET /redet/scenarios · /redet/sessions · POST /redet/start · /redet/turn · /redet/end · /redet/tts
//   Klasse:    GET /klasse/lessons · /klasse/session · /klasse/audio · POST /klasse/start · /klasse/answer · /klasse/next · /klasse/ask
//   Profesor:  GET /usage  (cookie de Teacher OS)
// SEGURIDAD: solo cuentas de alumno verificadas (nunca invitados); cada recurso se busca DENTRO de la cuenta (aislamiento entre usuarios);
// permisos y cuota se validan aquí, antes de cualquier llamada de pago; todo cuerpo JSON se acota; el texto del alumno nunca se registra.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { AI_LIMITS, clean, parseKlasseAnswer, parseRedetTurn, parseWritingReview, type AiLevel, type KlausFeature, type WritingReview } from '../../shared/klaus-ai.ts';
import { REDET_SCENARIOS, WRITING_TASKS, scenarioById, taskById } from '../../shared/klaus-content.ts';
import { isExercise, type AnswerPayload, type KlasseView } from '../../shared/lesson.ts';
import { sameOriginJson } from '../cookies.ts';
import { identify } from '../play-api.ts';
import type { AccountStore, Account } from '../accounts.ts';
import type { Guard } from '../security.ts';
import { RULES } from '../tutor.ts';
import { AiUsage, type Ticket } from './usage.ts';
import { ProviderError, levelOrDefault, type Providers } from './providers.ts';
import { KlausStore, newId, type KlasseProgress, type RedetSummary } from './klaus-store.ts';
import { AUDIO_DIR, LESSONS, afterCheckpoint, audioAvailable, basePlan, findActivity, grade, lessonById, publicActivity, recommendation } from './lessons.ts';
import { SCHEMAS, SYSTEM, fill, levelNote, wrap } from './prompts.ts';

class ApiError extends Error { status: number; code?: string; constructor(status: number, message: string, code?: string) { super(message); this.status = status; this.code = code; } }
const fail = (status: number, message: string, code?: string): never => { throw new ApiError(status, message, code); };
function json(res: ServerResponse, status: number, body: unknown) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(body)); }
async function readBody(req: IncomingMessage, max: number): Promise<Buffer> {
  const chunks: Buffer[] = []; let n = 0;
  for await (const c of req) { n += (c as Buffer).length; if (n > max) fail(413, 'La petición es demasiado grande.'); chunks.push(Buffer.from(c)); }
  return Buffer.concat(chunks);
}
async function jsonBody(req: IncomingMessage, max = 16_384): Promise<Record<string, unknown>> {
  const raw = (await readBody(req, max)).toString('utf8');
  try { const v: unknown = JSON.parse(raw || '{}'); if (!v || typeof v !== 'object' || Array.isArray(v)) return fail(400, 'Se esperaba un objeto JSON.'); return v as Record<string, unknown>; }
  catch (e) { if (e instanceof ApiError) throw e; return fail(400, 'JSON no válido.'); }
}

export interface KlausAiDeps { accounts: AccountStore; guard: Guard; providers: Providers; usage: AiUsage; store: KlausStore; teacherOk?: (req: IncomingMessage) => boolean; now?: () => number }

export function createKlausAi({ accounts, guard, providers, usage, store, teacherOk, now = Date.now }: KlausAiDeps) {
  const need = (req: IncomingMessage): Account => {
    const who = identify(accounts, req);
    if (who.kind !== 'account') fail(401, 'Inicia sesión para usar Klaus.');
    return (who as { account: Account }).account;
  };
  const csrf = (req: IncomingMessage) => { if (!sameOriginJson(req)) fail(400, 'Petición no válida.'); };
  const rid = (b: Record<string, unknown>) => (typeof b.requestId === 'string' && /^[\w-]{8,64}$/.test(b.requestId) ? b.requestId : null);
  const level = (b: Record<string, unknown>) => levelOrDefault(b.level);
  const planInfo = (a: Account) => { const plan = usage.planOf(a.id, a.alias); return { plan, quota: usage.remaining(a.id, plan) }; };
  const ruleText = (id: string) => RULES.find((r) => r.id === id)?.rule ?? null;

  /** Ejecuta una operación con cuota: reserva → proveedor → registro → confirma/devuelve. Cancela si el cliente cierra la conexión. */
  async function metered<T>(req: IncomingMessage, a: Account, o: { feature: KlausFeature; amount: number; requestId: string | null; op: string; real: boolean; session?: string | null }, run: (signal: AbortSignal, t: Ticket) => Promise<{ value: T; rec: Parameters<AiUsage['record']>[0] extends infer R ? Partial<R> : never }>): Promise<T> {
    const adm = usage.admit({ accountId: a.id, alias: a.alias, feature: o.feature, amount: o.amount, requestId: o.requestId, real: o.real });
    if (!adm.ok) return fail(adm.status, adm.error, adm.code);
    const ticket = adm.ticket as Ticket;
    if (adm.cached !== undefined) { usage.record({ op: o.op, accountId: a.id, feature: o.feature, session: o.session, provider: 'cache', model: 'cache', real: false, cached: true }); return adm.cached as T; }
    const ctl = new AbortController(); const onClose = () => ctl.abort(); res_onClose(req, onClose);
    try {
      const { value, rec } = await run(ctl.signal, ticket);
      usage.commit(ticket, value);
      usage.record({ op: o.op, accountId: a.id, feature: o.feature, session: o.session, provider: 'x', model: 'x', real: false, ...rec } as never);
      return value;
    } catch (e) {
      usage.release(ticket);
      const pe = e instanceof ProviderError ? e : null;
      usage.record({ op: o.op, accountId: a.id, feature: o.feature, session: o.session, provider: 'x', model: 'x', real: o.real, aiCall: true, ok: false, error: pe?.kind ?? 'internal', costEur: 0 } as never);
      if (pe) return fail(pe.status === 499 ? 499 : pe.status, pe.kind === 'bad_output' ? 'Klaus no ha podido darte una respuesta válida. No se ha descontado nada de tu cuota; inténtalo de nuevo.' : pe.message, pe.kind);
      throw e;
    } finally { req.removeListener('close', onClose); }
  }
  function res_onClose(req: IncomingMessage, fn: () => void) { req.once('close', () => { if (!req.complete) fn(); }); }

  /** Llama al LLM y mide el coste. Devuelve el JSON sin validar. */
  async function ask(a: Account, task: Parameters<Providers['llm']['complete']>[0]['task'], system: string, user: string, input: unknown, schemaName: string, schema: Record<string, unknown>, maxTokens: number, signal: AbortSignal) {
    const llm = providers.llm;
    const r = await llm.complete({ task, system, user, input, schemaName, schema, maxTokens, signal });
    const costEur = usage.costOf({ inputTokens: r.usage.inputTokens, outputTokens: r.usage.outputTokens }, 'llm', llm.real);
    return { r, rec: { provider: llm.name, model: r.model, real: llm.real, aiCall: llm.real, usage: r.usage, latencyMs: r.latencyMs, costEur } };
  }

  // ───────────── Schreibt ─────────────
  async function review(req: IncomingMessage, a: Account) {
    csrf(req); const b = await jsonBody(req, 12_000);
    const text = typeof b.text === 'string' ? b.text.replace(/\r\n/g, '\n') : '';
    if (!text.trim()) fail(400, 'Escribe algo antes de pedir la revisión.');
    if (text.length > AI_LIMITS.writingChars) fail(400, `El texto es demasiado largo (máximo ${AI_LIMITS.writingChars} caracteres).`);
    const lvl = level(b), draftId = typeof b.draftId === 'string' ? b.draftId : null;
    if (draftId && !store.draft(a.id, draftId)) fail(404, 'Borrador no encontrado.');
    const out = await metered<{ review: WritingReview; reviewId: string | null }>(req, a, { feature: 'text', amount: 1, requestId: rid(b), op: 'writing_review', real: providers.llm.real }, async (signal) => {
      const { r, rec } = await ask(a, 'writing_review', fill(SYSTEM.writing, { level: levelNote(lvl) }), wrap('texto_alumno', text), { text, level: lvl }, 'revision_escritura', SCHEMAS.writing as never, 1800, signal);
      const parsed = parseWritingReview(r.json, text, providers.llm.real ? 'ai' : 'mock', ruleText);
      if (!parsed.ok) throw new ProviderError('bad_output', parsed.error);
      const saved = draftId ? store.addReview(a.id, draftId, text, parsed.value) : null;
      return { value: { review: parsed.value, reviewId: saved?.id ?? null }, rec };
    });
    return out;
  }

  // ───────────── Redet ─────────────
  async function redetTurn(req: IncomingMessage, a: Account) {
    csrf(req); const b = await jsonBody(req, 4_000);
    const s = store.redet(a.id, String(b.sessionId ?? ''));
    if (!s) return fail(404, 'Conversación no encontrada.');
    if (s.endedAt) return fail(409, 'Esta conversación ya terminó.');
    const text = clean(b.text, AI_LIMITS.transcriptChars);
    if (!text) return fail(400, 'No se ha recibido nada que transcribir.');
    if (s.turns.filter((t) => t.role === 'student').length >= 40) return fail(429, 'La conversación es muy larga. Termínala para ver el resumen.');
    const sc = scenarioById(s.scenarioId)!;
    return metered(req, a, { feature: 'text', amount: 1, requestId: rid(b), op: 'redet_turn', real: providers.llm.real, session: s.id }, async (signal) => {
      // Contexto COMPACTO: solo los últimos 6 turnos, no todo el historial.
      const recent = s.turns.slice(-6).map((t) => `${t.role === 'klaus' ? 'Klaus' : 'Alumno'}: ${t.text}`).join('\n');
      const { r, rec } = await ask(a, 'redet_turn', fill(SYSTEM.redet, { level: levelNote(s.level), role: sc.role }), `${wrap('contexto', recent)}\n${wrap('texto_alumno', text)}`,
        { scenarioId: sc.id, turn: s.turns.filter((t) => t.role === 'student').length, text }, 'turno_conversacion', SCHEMAS.redet as never, 700, signal);
      const parsed = parseRedetTurn(r.json, text);
      if (!parsed.ok) throw new ProviderError('bad_output', parsed.error);
      s.turns.push({ role: 'student', text, at: now() }, { role: 'klaus', text: parsed.value.reply, at: now() });
      s.corrections.push(...parsed.value.corrections);
      for (const e of parsed.value.expressions) if (!s.expressions.some((x) => x.de === e.de)) s.expressions.push(e);
      s.corrections = s.corrections.slice(-30); s.expressions = s.expressions.slice(-20); store.save();
      return { value: { reply: parsed.value.reply, corrections: parsed.value.corrections, expressions: parsed.value.expressions, source: providers.llm.real ? 'ai' : 'mock' }, rec };
    });
  }
  async function redetEnd(req: IncomingMessage, a: Account) {
    csrf(req); const b = await jsonBody(req, 1000);
    const s = store.redet(a.id, String(b.sessionId ?? '')); if (!s) return fail(404, 'Conversación no encontrada.');
    if (s.summary) return { summary: s.summary };
    const sc = scenarioById(s.scenarioId)!;
    // El resumen reutiliza lo ya registrado: solo pide al modelo temas y sugerencias (no gasta cuota del alumno; sí cuenta en métricas).
    let topics = [sc.title], suggestions = ['Repite el diálogo en voz alta.', 'Usa las expresiones nuevas en una frase propia.'];
    if (providers.llm.real && s.turns.length > 2) {
      try {
        const { r, rec } = await ask(a, 'redet_summary', SYSTEM.redetSummary, wrap('contexto', s.turns.map((t) => `${t.role}: ${t.text}`).join('\n').slice(0, 3000)), { scenarioId: sc.id }, 'resumen_conversacion', SCHEMAS.redetSummary as never, 500, AbortSignal.timeout(25_000));
        const o = r.json as { topics?: unknown; suggestions?: unknown };
        const arr = (v: unknown, n: number, m: number) => (Array.isArray(v) ? v.map((x) => clean(x, m)).filter(Boolean).slice(0, n) : []);
        if (arr(o.topics, 5, 80).length) topics = arr(o.topics, 5, 80); if (arr(o.suggestions, 4, 140).length) suggestions = arr(o.suggestions, 4, 140);
        usage.record({ op: 'redet_summary', accountId: a.id, feature: 'text', session: s.id, ...rec } as never);
      } catch { /* si falla el resumen con IA, queda el resumen local: la sesión no se pierde */ }
    }
    const summary: RedetSummary = { topics, expressions: s.expressions, mistakes: s.corrections.filter((c) => c.kind === 'error').slice(0, 8), suggestions, source: providers.llm.real ? 'ai' : 'mock' };
    s.summary = summary; s.endedAt = now(); store.save();
    usage.record({ op: 'redet_end', accountId: a.id, session: s.id, provider: 'local', model: 'local', real: false });
    return { summary };
  }
  async function redetTranscribe(req: IncomingMessage, a: Account, url: URL) {
    csrf2(req);
    const mime = String(req.headers['content-type'] ?? '').split(';')[0].trim();
    if (!['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'text/plain'].includes(mime)) return fail(415, 'Formato de audio no admitido.');
    const seconds = Math.max(1, Math.min(60, Number(url.searchParams.get('seconds')) || 10));
    const audio = await readBody(req, 1_500_000);
    if (!audio.length) return fail(400, 'No se ha recibido audio.');
    return metered(req, a, { feature: 'voiceSeconds', amount: seconds, requestId: url.searchParams.get('rid'), op: 'stt', real: providers.stt.real }, async (signal) => {
      const r = await providers.stt.transcribe({ audio, mime, seconds, language: 'de', prompt: 'Conversación de un estudiante de alemán A1-A2.', signal });
      // El audio solo existe en memoria durante esta petición: nunca se escribe en disco.
      return { value: { text: clean(r.text, AI_LIMITS.transcriptChars), source: providers.stt.real ? 'stt' : 'mock', note: 'Transcripción automática: no evalúa tu pronunciación.' }, rec: { provider: providers.stt.name, model: r.model, real: providers.stt.real, aiCall: providers.stt.real, audioSeconds: seconds, latencyMs: r.latencyMs, costEur: usage.costOf({ audioSeconds: seconds }, 'stt', providers.stt.real) } };
    });
  }
  const csrf2 = (req: IncomingMessage) => { const origin = req.headers.origin; if (origin) { try { if (new URL(origin).host !== req.headers.host) fail(400, 'Petición no válida.'); } catch (e) { if (e instanceof ApiError) throw e; fail(400, 'Petición no válida.'); } } };
  async function tts(req: IncomingMessage, a: Account, res: ServerResponse) {
    csrf(req); const b = await jsonBody(req, 3000);
    const text = clean(b.text, 600); if (!text) return fail(400, 'No hay texto que leer.');
    const out = await metered<{ audio: string; mime: string }>(req, a, { feature: 'ttsChars', amount: text.length, requestId: rid(b), op: 'tts', real: providers.tts.real }, async (signal) => {
      const r = await providers.tts.synthesize({ text, voice: providers.config.tts.voice, signal });
      return { value: { audio: r.audio.toString('base64'), mime: r.mime }, rec: { provider: providers.tts.name, model: r.model, real: true, aiCall: true, ttsChars: r.chars, latencyMs: r.latencyMs, costEur: usage.costOf({ ttsChars: r.chars }, 'tts', true) } };
    });
    json(res, 200, out);
  }

  // ───────────── Klasse ─────────────
  function viewOf(a: Account, p: KlasseProgress): KlasseView {
    const lesson = lessonById(p.lessonId)!, id = p.plan[p.step] ?? null, act = id ? findActivity(lesson, id) : null;
    const plan = planInfo(a).plan, asksLeft = Math.max(0, usage.limits[plan].klasseAsks - p.asks);
    const st = { answers: p.answers };
    return {
      sessionId: p.sessionId, lessonId: lesson.id, title: lesson.title, level: lesson.level, objectives: lesson.objectives, step: p.step, total: p.plan.length,
      activity: act && !p.finished ? publicActivity(act, lesson, p.sessionId) : null, finished: p.finished, verified: lesson.verified,
      answered: Object.fromEntries(Object.entries(p.answers).map(([k, v]) => [k, { ok: v.ok, tries: v.tries }])), asks: p.asks, asksLeft,
      summary: p.finished ? (({ correct, total, passed, recommendation: rec }) => ({ correct, total, passed, recommendation: rec }))(recommendation(lesson, st)) : null,
    };
  }
  const mine = (a: Account, id: unknown): KlasseProgress => store.klasse(a.id, String(id ?? '')) ?? fail(404, 'Clase no encontrada.');
  function advance(p: KlasseProgress) {
    const lesson = lessonById(p.lessonId)!, cur = findActivity(lesson, p.plan[p.step] ?? '');
    if (cur?.kind === 'checkpoint') afterCheckpoint(lesson, { plan: p.plan, step: p.step, answers: p.answers, remedialAdded: p.remedialAdded }), (p.remedialAdded = p.plan.some((x) => lesson.remedial.some((r) => r.id === x)));
    p.step++; p.updatedAt = now();
    if (p.step >= p.plan.length) { p.finished = true; p.step = p.plan.length - 1; }
    usage.record({ op: 'klasse_step', accountId: '', provider: 'local', model: 'local', real: false } as never);
  }
  async function klasseStart(req: IncomingMessage, a: Account) {
    csrf(req); const b = await jsonBody(req, 1000);
    const lesson = lessonById(String(b.lessonId ?? '')); if (!lesson) return fail(404, 'Lección no encontrada.');
    // Reanudar: si hay una clase sin terminar de esta lección, se continúa (no consume otra sesión).
    const open = store.klasseList(a.id).find((s) => s.lessonId === lesson.id && !s.finished);
    if (open) return { view: viewOf(a, open), resumed: true };
    const adm = usage.admit({ accountId: a.id, alias: a.alias, feature: 'klasseSessions', amount: 1, requestId: null, real: false });
    if (!adm.ok) return fail(adm.status, adm.error, adm.code);
    usage.commit(adm.ticket!);
    const p: KlasseProgress = { lessonId: lesson.id, level: lesson.level, startedAt: now(), updatedAt: now(), step: 0, plan: basePlan(lesson), remedialAdded: false, answers: {}, asks: 0, finished: false, digest: '', sessionId: newId('kl') };
    store.addKlasse(a.id, p);
    usage.record({ op: 'klasse_start', accountId: a.id, feature: 'klasseSessions', session: p.sessionId, provider: 'local', model: 'local', real: false });
    return { view: viewOf(a, p), resumed: false };
  }
  async function klasseAnswer(req: IncomingMessage, a: Account) {
    csrf(req); const b = await jsonBody(req, 2000);
    const p = mine(a, b.sessionId); if (p.finished) return fail(409, 'La clase ya terminó.');
    const lesson = lessonById(p.lessonId)!, act = findActivity(lesson, p.plan[p.step] ?? '');
    if (!act || !isExercise(act)) return fail(409, 'Este paso no es un ejercicio.');
    const prev = p.answers[act.id]; if (prev && (prev.ok || prev.tries >= lesson.progression.maxTries)) return fail(409, 'Ya respondiste este ejercicio.');
    const payload = b.answer as AnswerPayload;
    const r = grade(act, payload, prev?.tries ?? 0, lesson.progression.maxTries, p.sessionId);
    if (!r) return fail(400, 'Respuesta no válida.');
    p.answers[act.id] = { choice: JSON.stringify(payload).slice(0, 120), ok: r.ok, tries: r.tries }; p.updatedAt = now(); store.save();
    usage.record({ op: 'klasse_grade', accountId: a.id, session: p.sessionId, provider: 'local', model: 'local', real: false, aiCall: false });
    return { result: r, view: viewOf(a, p) };
  }
  async function klasseNext(req: IncomingMessage, a: Account) {
    csrf(req); const b = await jsonBody(req, 1000);
    const p = mine(a, b.sessionId); if (p.finished) return { view: viewOf(a, p) };
    const lesson = lessonById(p.lessonId)!, act = findActivity(lesson, p.plan[p.step] ?? '');
    // Un ejercicio no se salta sin resolverlo (acierto o intentos agotados); la teoría sí avanza.
    if (act && isExercise(act)) { const r = p.answers[act.id]; if (!r || (!r.ok && r.tries < lesson.progression.maxTries)) return fail(409, 'Responde el ejercicio para continuar.'); }
    advance(p); store.save();
    return { view: viewOf(a, p) };
  }
  async function klasseAsk(req: IncomingMessage, a: Account) {
    csrf(req); const b = await jsonBody(req, 3000);
    const p = mine(a, b.sessionId); const lesson = lessonById(p.lessonId)!;
    const q = clean(b.question, AI_LIMITS.askChars); if (!q) return fail(400, 'Escribe tu pregunta.');
    const act = findActivity(lesson, p.plan[p.step] ?? '');
    return metered(req, a, { feature: 'klasseAsks', amount: 1, requestId: rid(b), op: 'klasse_ask', real: providers.llm.real, session: p.sessionId }, async (signal) => {
      // Contexto COMPACTO: id de lección, objetivo, teoría de referencia, actividad actual, último error y la pregunta. Nunca el historial.
      const ruleId = act && 'ruleId' in act ? act.ruleId : undefined, rule = ruleId ? ruleText(ruleId) : null;
      const last = Object.entries(p.answers).at(-1);
      const ctx = [`lección: ${lesson.id} · ${lesson.title}`, `objetivo: ${lesson.objectives[0]}`, rule ? `teoría verificada: ${rule}` : '', act ? `actividad actual: ${act.id} (${act.kind}) «${act.title}»` : '', last ? `último resultado: ${last[0]} ${last[1].ok ? 'correcto' : 'incorrecto'}` : '', p.digest ? `resumen: ${p.digest}` : '', `actividades válidas: ${p.plan.join(', ')}`].filter(Boolean).join('\n');
      const { r, rec } = await ask(a, 'klasse_answer', SYSTEM.klasse, `${wrap('contexto', ctx)}\n${wrap('pregunta_alumno', q)}`, { question: q, ruleId }, 'respuesta_clase', SCHEMAS.klasse as never, 600, signal);
      const parsed = parseKlasseAnswer(r.json, p.plan);
      if (!parsed.ok) throw new ProviderError('bad_output', parsed.error);
      p.asks++; p.digest = `${p.digest} P:${q.slice(0, 40)}`.trim().slice(-240); p.updatedAt = now(); store.save();
      return { value: { answer: parsed.value, source: providers.llm.real ? 'ai' : 'mock', asksLeft: Math.max(0, usage.limits[planInfo(a).plan].klasseAsks - p.asks) }, rec };
    });
  }

  // ───────────── Rutas ─────────────
  async function dispatch(req: IncomingMessage, res: ServerResponse, url: URL) {
    const path = url.pathname.slice('/api/klaus'.length), get = req.method === 'GET', post = req.method === 'POST';
    if (path === '/usage' && get) { if (!teacherOk?.(req)) fail(401, 'Solo el profesor puede ver el consumo.'); return json(res, 200, usage.summary()); }
    const a = need(req);
    if (path === '/status' && get) {
      const c = providers.config;
      return json(res, 200, { ...planInfo(a), providers: { llm: { provider: providers.llm.name, model: providers.llm.model, real: providers.llm.real, note: c.llm.reason ?? null }, stt: { provider: providers.stt.name, real: providers.stt.real, note: c.stt.reason ?? null }, tts: { provider: providers.tts.name, real: providers.tts.real, note: c.tts.reason ?? null } }, limits: AI_LIMITS });
    }
    if (path === '/writing/tasks' && get) return json(res, 200, { tasks: WRITING_TASKS });
    if (path === '/writing/drafts' && get) return json(res, 200, { drafts: store.drafts(a.id).map((d) => ({ ...d, reviews: d.reviews.map((r) => ({ id: r.id, at: r.at, review: r.review, resolved: r.resolved, textSnapshot: r.textSnapshot })) })) });
    if (path === '/writing/draft' && post) {
      csrf(req); const b = await jsonBody(req, 8000), text = typeof b.text === 'string' ? b.text.slice(0, AI_LIMITS.writingChars) : '';
      const taskId = typeof b.taskId === 'string' && taskById(b.taskId) ? b.taskId : null;
      const d = store.saveDraft(a.id, { id: typeof b.id === 'string' ? b.id : undefined, title: clean(b.title, AI_LIMITS.titleChars) || 'Sin título', text, level: level(b), taskId });
      if ('error' in d) fail(409, d.error);
      return json(res, 200, { draft: d });
    }
    if (path === '/writing/draft/delete' && post) { csrf(req); const b = await jsonBody(req, 500); return json(res, store.deleteDraft(a.id, String(b.id ?? '')) ? 200 : 404, { ok: true }); }
    if (path === '/writing/review' && post) return json(res, 200, await review(req, a));
    if (path === '/writing/review/resolve' && post) {
      csrf(req); const b = await jsonBody(req, 600), d = store.draft(a.id, String(b.draftId ?? '')), r = d?.reviews.find((x) => x.id === b.reviewId);
      if (!d || !r) return fail(404, 'Revisión no encontrada.');
      const cid = String(b.correctionId ?? ''); if (r.review.corrections.some((c) => c.id === cid) && !r.resolved.includes(cid)) { r.resolved.push(cid); store.save(); }
      return json(res, 200, { resolved: r.resolved });
    }
    if (path === '/redet/scenarios' && get) return json(res, 200, { scenarios: REDET_SCENARIOS.map(({ role: _r, script: _s, ...s }) => s) });
    if (path === '/redet/sessions' && get) return json(res, 200, { sessions: store.redetList(a.id).map((s) => ({ id: s.id, scenarioId: s.scenarioId, level: s.level, startedAt: s.startedAt, endedAt: s.endedAt, turns: s.turns.length, summary: s.summary })) });
    if (path === '/redet/session' && get) { const s = store.redet(a.id, url.searchParams.get('id') ?? ''); return s ? json(res, 200, { session: s }) : fail(404, 'Conversación no encontrada.'); }
    if (path === '/redet/start' && post) {
      csrf(req); const b = await jsonBody(req, 500), sc = scenarioById(String(b.scenarioId ?? '')), lvl = level(b);
      if (!sc) return fail(404, 'Escenario no encontrado.'); if (!sc.levels.includes(lvl)) return fail(400, `Este escenario es para ${sc.levels.join('/')}.`);
      const open = store.redetList(a.id).filter((s) => !s.endedAt).length; if (open >= 3) return fail(429, 'Tienes varias conversaciones abiertas. Termina alguna.');
      const s = store.startRedet(a.id, sc.id, lvl, sc.opening); usage.record({ op: 'redet_start', accountId: a.id, session: s.id, provider: 'local', model: 'local', real: false });
      return json(res, 200, { session: s, scenario: { id: sc.id, title: sc.title, intro: sc.intro, phrases: sc.phrases } });
    }
    if (path === '/redet/turn' && post) return json(res, 200, await redetTurn(req, a));
    if (path === '/redet/end' && post) return json(res, 200, await redetEnd(req, a));
    if (path === '/redet/stt' && post) return json(res, 200, await redetTranscribe(req, a, url));
    if (path === '/redet/tts' && post) return void await tts(req, a, res);
    if (path === '/klasse/lessons' && get) return json(res, 200, { lessons: LESSONS.map((l) => ({ id: l.id, unit: l.unit, level: l.level, title: l.title, objectives: l.objectives, verified: l.verified, steps: basePlan(l).length })), sessions: store.klasseList(a.id).map((s) => ({ sessionId: s.sessionId, lessonId: s.lessonId, finished: s.finished, step: s.step, total: s.plan.length, updatedAt: s.updatedAt })) });
    if (path === '/klasse/session' && get) return json(res, 200, { view: viewOf(a, mine(a, url.searchParams.get('id'))) });
    if (path === '/klasse/audio' && get) {
      const lesson = lessonById(url.searchParams.get('lesson') ?? ''), act = lesson ? findActivity(lesson, url.searchParams.get('activity') ?? '') : null;
      if (!lesson || !act || act.kind !== 'listening' || !audioAvailable(act.audio)) return fail(404, 'Audio no disponible.');
      // Solo se sirve audio de actividades de la sesión del alumno (no es un servidor de archivos).
      if (!store.klasseList(a.id).some((s) => s.lessonId === lesson.id)) return fail(403, 'Inicia la clase para escuchar este audio.');
      const file = join(AUDIO_DIR, `${act.audio}.mp3`); res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': statSync(file).size, 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' });
      return void createReadStream(file).pipe(res);
    }
    if (path === '/klasse/start' && post) return json(res, 200, await klasseStart(req, a));
    if (path === '/klasse/answer' && post) return json(res, 200, await klasseAnswer(req, a));
    if (path === '/klasse/next' && post) return json(res, 200, await klasseNext(req, a));
    if (path === '/klasse/ask' && post) return json(res, 200, await klasseAsk(req, a));
    fail(404, 'No encontrado.');
  }

  const handler = function klausAiHandler(req: IncomingMessage, res: ServerResponse): boolean {
    const url = new URL(req.url || '/', 'http://klaus.local');
    if (!url.pathname.startsWith('/api/klaus/')) return false;
    void dispatch(req, res, url).catch((e: unknown) => {
      if (!(e instanceof ApiError)) console.error('[klaus-ai]', (e as Error)?.name); // nunca se registra el mensaje: podría contener texto del alumno
      if (res.headersSent) return void res.end();
      json(res, e instanceof ApiError ? e.status : 500, { error: e instanceof ApiError ? e.message : 'No se pudo completar la petición.', ...(e instanceof ApiError && e.code ? { code: e.code } : {}) });
    });
    return true;
  };
  return Object.assign(handler, { sweep: () => store.sweep(), forget: (id: string) => { store.forget(id); usage.forget(id); }, flush: () => { store.flush(); usage.flush(); } });
}
void existsSync; void newIdUnused();
function newIdUnused() { return newId('x'); }
export type { AiLevel };
