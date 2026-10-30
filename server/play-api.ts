// HTTP del MODO LIBRE para alumnos: cuentas, catálogo, progreso propio y ranking opcional.
//   POST /api/account/register | login | logout | settings | delete      GET /api/account/me | progress
//   GET  /api/play/catalog                                               GET /api/play/leaderboard
// Identidad del alumno: cabecera `X-Student-Session: dts_…`. NO sirve ninguna credencial de profesor aquí, ni al revés.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { GAMES, LEVELS, LEVEL_DIFFS, LEVEL_LABEL, BOXING_TOPICS, type ProgressSummary, type RankingEntry, type RankingView } from '../shared/play.ts';
import { TOPICS } from '../shared/rules.ts';
import type { Question } from '../shared/types.ts';
import { AccountStore, aliasKey, type Account } from './accounts.ts';
import { isoWeek, nextWeekStart, standings, weekRange, type ProgressLog } from './progress.ts';
import type { Guard } from './security.ts';
import { BOXING_BANK } from './boxing-bank.ts';

class ApiError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status; } }
const fail = (status: number, message: string): never => { throw new ApiError(status, message); };
function json(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(JSON.stringify(body));
}
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []; let n = 0;
  for await (const c of req) { n += (c as Buffer).length; if (n > 4096) fail(413, 'La petición es demasiado grande.'); chunks.push(Buffer.from(c)); }
  try {
    const v: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!v || typeof v !== 'object' || Array.isArray(v)) return fail(400, 'Se esperaba un objeto JSON.');
    return v as Record<string, unknown>;
  } catch (e) { if (e instanceof ApiError) throw e; return fail(400, 'JSON no válido.'); }
}

/** Quién hace la petición: cuenta de alumno, invitado (sin cabecera) o sesión inválida/caducada. */
export type Identity = { kind: 'account'; account: Account } | { kind: 'guest' } | { kind: 'invalid' };
export function identify(accounts: AccountStore, req: Pick<IncomingMessage, 'headers'>): Identity {
  const raw = req.headers['x-student-session'];
  const t = Array.isArray(raw) ? raw[0] : raw;
  if (!t) return { kind: 'guest' };
  const account = accounts.verify(t);
  return account ? { kind: 'account', account } : { kind: 'invalid' };
}

export interface PlayApiDeps { accounts: AccountStore; guard: Guard; log: () => ProgressLog; bank: Map<string, Question>; now?: () => number }

export function createPlayApi({ accounts, guard, log, bank, now = Date.now }: PlayApiDeps) {
  const pub = (a: Account) => ({ alias: a.alias, rankingOptIn: a.rankingOptIn });
  const need = (req: IncomingMessage): Account => {
    const who = identify(accounts, req);
    if (who.kind !== 'account') fail(401, 'Inicia sesión para continuar.');
    return (who as { account: Account }).account;
  };

  function prompt(qid: string): string {
    const q = bank.get(qid)?.prompt ?? BOXING_BANK.find((b) => b.id === qid)?.prompt ?? '';
    return q.length > 160 ? `${q.slice(0, 157)}…` : q;
  }

  /** Progreso educativo del alumno autenticado (solo suyo). */
  function summary(a: Account): ProgressSummary {
    const l = log();
    const week = isoWeek(l.now());
    const rankableIds = accounts.rankable();
    const table = standings(l, week, (p) => rankableIds.has(p));
    const mine = l.summary(a.id);
    const topics = l.topics(a.id);
    const rec = l.recommended(a.id);
    const errors = l.frequentErrors(a.id).map((e) => ({ ...e, prompt: prompt(e.qid), topic: e.topic }));
    const acts = l.recentActivities(a.id);
    const advice: string[] = [];
    for (const t of topics.filter((x) => rec.includes(x.topic))) advice.push(`Repasa «${(TOPICS as Record<string, { de: string }>)[t.topic]?.de ?? t.topic}»: ${Math.round(t.accuracy * 100)} % de acierto en ${t.attempts} intentos.`);
    if (errors.length) advice.push(`Vuelve sobre las preguntas que más fallas (${errors.length}): se repasan en la práctica con «repasar lo que he fallado».`);
    const last = acts.slice(0, 3);
    if (last.length === 3 && last.every((x) => x.level && x.level === last[0].level && x.total && x.correct / x.total >= 0.85) && last[0].level !== 'B1') advice.push(`Tus tres últimas actividades de ${last[0].level} tienen ≥ 85 % de acierto: prueba el nivel siguiente.`);
    if (!acts.length && !topics.length) advice.push('Completa tu primera actividad (8 preguntas o más) para ver aquí tu progreso.');
    return {
      week, weekPoints: mine.weekPoints, streak: mine.streak, rank: a.rankingOptIn && a.aliasStatus === 'approved' ? (table.find((r) => r.profile === a.id)?.rank ?? null) : null,
      rankingOptIn: a.rankingOptIn, history: mine.history, activities: acts as ProgressSummary['activities'], topics, frequentErrors: errors, accuracy: l.accuracyByWeek(a.id), recommended: rec, advice,
    };
  }

  function catalog() {
    const pool = (topic: string) => Object.fromEntries(LEVELS.map((lv) => [lv, [...bank.values()].filter((q) => q.topic === topic && (LEVEL_DIFFS[lv] as readonly string[]).includes(q.diff)).length]));
    return {
      games: GAMES,
      levels: LEVELS.map((id) => ({ id, label: LEVEL_LABEL[id], diffs: LEVEL_DIFFS[id] })),
      topics: (Object.keys(TOPICS) as (keyof typeof TOPICS)[]).map((id) => ({ id, de: TOPICS[id].de, es: TOPICS[id].es, pool: pool(id) })),
      boxingTopics: Object.entries(BOXING_TOPICS).map(([id, name]) => ({ id, name, pool: BOXING_BANK.filter((q) => q.topic === name).length })),
    };
  }

  async function dispatch(req: IncomingMessage, res: ServerResponse, url: URL) {
    const ip = guard.ip(req);
    const route = url.pathname;
    const method = req.method ?? 'GET';
    const only = (m: string) => { if (method !== m) { res.setHeader('Allow', m); fail(405, 'Método no permitido.'); } };

    if (route === '/api/play/catalog') { only('GET'); return json(res, 200, catalog()); }
    if (route === '/api/play/leaderboard') {
      only('GET');
      // SOLO alias de cuentas que activaron el ranking y con alias aprobado. Ningún nombre real, horario ni estadística privada.
      const which = url.searchParams.get('week') === 'previous' ? 'previous' : 'current';
      const limit = Math.max(1, Math.min(50, Number(url.searchParams.get('limit')) || 10));
      const l = log(); const now = l.now();
      const at = which === 'previous' ? nextWeekStart(now) - 7 * 86_400_000 - 3_600_000 : now;
      const week = isoWeek(at); const rankable = accounts.rankable();
      const table = standings(l, week, (p) => rankable.has(p));
      const entries: RankingEntry[] = table.slice(0, limit).map((r) => ({ rank: r.rank, alias: rankable.get(r.profile)!, points: r.points }));
      const view: RankingView = { week, which, range: weekRange(at), resetsAt: nextWeekStart(now), players: table.length, entries };
      const who = identify(accounts, req);
      if (who.kind === 'account') {
        const a = who.account;
        const optedIn = a.rankingOptIn && a.aliasStatus === 'approved';
        view.me = { alias: a.alias, points: l.weekPoints(a.id, week), rank: optedIn ? table.find((r) => r.profile === a.id)?.rank ?? null : null, optedIn };
      }
      return json(res, 200, view);
    }

    if (route === '/api/account/register') {
      only('POST');
      const blocked = guard.registerBlocked(ip); if (blocked) fail(429, blocked);
      const input = await body(req);
      const r = await accounts.register(input.alias, input.password, input.rankingOptIn === true);
      if (!r.ok) return fail(r.status, r.error);
      return json(res, 200, { token: r.token, account: pub(r.account) });
    }
    if (route === '/api/account/login') {
      only('POST');
      const input = await body(req);
      const key = typeof input.alias === 'string' ? aliasKey(input.alias.trim()) : '';
      const blocked = guard.loginBlocked(ip, key); if (blocked) fail(429, blocked);
      const r = await accounts.login(input.alias, input.password);
      if (!r.ok) { guard.loginFailed(ip, key); return fail(r.status, r.error); }
      return json(res, 200, { token: r.token, account: pub(r.account) });
    }
    if (route === '/api/account/logout') {
      only('POST');
      const t = req.headers['x-student-session']; if (typeof t === 'string') accounts.logout(t);
      return json(res, 200, { ok: true });
    }
    if (route === '/api/account/me') { only('GET'); return json(res, 200, { account: pub(need(req)) }); }
    if (route === '/api/account/progress') { only('GET'); return json(res, 200, summary(need(req))); }
    if (route === '/api/account/settings') {
      only('POST');
      const a = need(req); const input = await body(req);
      if (typeof input.rankingOptIn !== 'boolean') fail(400, 'Se esperaba rankingOptIn (true/false).');
      accounts.setRanking(a, input.rankingOptIn as boolean);
      return json(res, 200, { account: pub(a) });
    }
    if (route === '/api/account/password') {
      only('POST');
      const a = need(req); const input = await body(req);
      const blocked = guard.loginBlocked(ip, aliasKey(a.alias)); if (blocked) fail(429, blocked);
      const r = await accounts.changePassword(a, input.current, input.next, String(req.headers['x-student-session']));
      if (!r.ok) { if (r.status === 401) guard.loginFailed(ip, aliasKey(a.alias)); return fail(r.status, r.error); }
      return json(res, 200, { ok: true });
    }
    if (route === '/api/account/delete') {
      only('POST');
      const a = need(req); const input = await body(req);
      const blocked = guard.loginBlocked(ip, aliasKey(a.alias)); if (blocked) fail(429, blocked);
      if (!(await accounts.remove(a, input.password))) { guard.loginFailed(ip, aliasKey(a.alias)); fail(401, 'Contraseña incorrecta.'); }
      log().removeProfile(a.id);
      onRemoved?.(a.id);
      return json(res, 200, { ok: true });
    }
    fail(404, 'Ruta desconocida.');
  }
  let onRemoved: ((id: string) => void) | undefined;
  const handler = (req: IncomingMessage, res: ServerResponse): boolean => {
    const url = new URL(req.url ?? '/', 'http://play.local');
    if (!url.pathname.startsWith('/api/account/') && !url.pathname.startsWith('/api/play/catalog') && !url.pathname.startsWith('/api/play/leaderboard')) return false;
    void now;
    dispatch(req, res, url).catch((e: unknown) => {
      if (!(e instanceof ApiError)) console.error('[play-api]', e);
      json(res, e instanceof ApiError ? e.status : 500, { error: e instanceof ApiError ? e.message : 'No se pudo completar la petición.' }, e instanceof ApiError && e.status === 429 ? { 'Retry-After': '60' } : {});
    });
    return true;
  };
  return Object.assign(handler, { summary, setOnRemoved: (fn: (id: string) => void) => { onRemoved = fn; } });
}
