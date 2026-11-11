// Tablón (/api/tablon): peticiones del alumnado. Cualquiera puede leerlo; solo una cuenta de alumno que ya ha hecho al menos
// una actividad (práctica, misión, juego o algo con Klaus) puede abrir un ticket o apoyar uno. El profesor responde y cambia el estado.
//   GET  /api/tablon                     tickets públicos (sin alias del autor) + qué puede hacer «yo»
//   POST /api/tablon/ticket              { category, title, body } → abre un ticket
//   POST /api/tablon/vote                { id } → apoya / retira el apoyo
//   POST /api/tablon/withdraw            { id } → el autor retira su ticket abierto
//   GET  /api/tablon/admin               (profesor) tickets con alias
//   POST /api/tablon/admin/update        (profesor) { id, status?, reply? }
//   POST /api/tablon/admin/delete        (profesor) { id } → quita el ticket del tablón (definitivo)
// SEGURIDAD: identidad por cookie verificada en el servidor; JSON acotado; mismo origen; límites por cuenta; filtro de palabras.
// Persistencia: DATA_DIR/tablon.json (escritura atómica, 0600).
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { sameOriginJson } from './cookies.ts';
import { identify } from './play-api.ts';
import { hasBadWords, type AccountStore, type Account } from './accounts.ts';

export const TICKET_CATEGORIES = ['contenido', 'funcion', 'error', 'otro'] as const;
export const TICKET_STATUSES = ['abierto', 'en-curso', 'hecho', 'descartado'] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export interface Ticket {
  id: string; n: number; accountId: string; alias: string; category: TicketCategory; title: string; body: string;
  status: TicketStatus; createdAt: number; updatedAt: number; votes: string[]; reply: string | null; repliedAt: number | null;
}
/** posted: momentos de publicación por cuenta (últimas 24 h). Retirar un ticket no devuelve el cupo diario. */
interface Data { version: 1; seq: number; tickets: Ticket[]; posted: Record<string, number[]> }

export const TABLON_LIMITS = { titleMin: 6, titleMax: 80, bodyMin: 15, bodyMax: 600, replyMax: 600, openPerAccount: 3, perDay: 3, keep: 500 } as const;
const DAY = 86_400_000;

/** Texto de una línea / párrafo: sin controles, espacios colapsados y recortado. */
export function cleanText(v: unknown, max: number, multiline = false): string {
  if (typeof v !== 'string') return '';
  let s = v.normalize('NFKC').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E]/g, '');
  s = multiline ? s.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n') : s.replace(/\s+/g, ' ');
  return s.trim().slice(0, max).trim();
}

export class TablonStore {
  readonly file: string | null;
  data: Data = { version: 1, seq: 0, tickets: [], posted: {} };
  #timer: NodeJS.Timeout | null = null;
  constructor(dataDir?: string) {
    this.file = dataDir ? join(dataDir, 'tablon.json') : null;
    if (this.file && existsSync(this.file)) {
      try {
        const raw = JSON.parse(readFileSync(this.file, 'utf8'));
        if (raw?.version === 1 && Array.isArray(raw.tickets)) this.data = { version: 1, seq: Number(raw.seq) || 0, tickets: raw.tickets.filter((t: Ticket) => t && typeof t.id === 'string' && typeof t.accountId === 'string'), posted: raw.posted && typeof raw.posted === 'object' ? raw.posted : {} };
      } catch (e) { console.error('[tablon] no se pudo leer tablon.json; se empieza vacío:', (e as Error).message); }
    }
  }
  find(id: string) { return this.data.tickets.find((t) => t.id === id) ?? null; }
  add(t: Omit<Ticket, 'id' | 'n'>): Ticket {
    const ticket: Ticket = { ...t, id: `tk_${randomBytes(8).toString('base64url')}`, n: ++this.data.seq };
    this.data.tickets.unshift(ticket);
    this.data.posted[t.accountId] = [...(this.data.posted[t.accountId] ?? []).filter((at) => t.createdAt - at < DAY), t.createdAt];
    // Se conservan los más recientes; los abiertos nunca se pierden por el recorte.
    if (this.data.tickets.length > TABLON_LIMITS.keep) {
      const open = this.data.tickets.filter((x) => x.status === 'abierto' || x.status === 'en-curso');
      const rest = this.data.tickets.filter((x) => !open.includes(x)).slice(0, Math.max(0, TABLON_LIMITS.keep - open.length));
      this.data.tickets = [...open, ...rest].sort((a, b) => b.createdAt - a.createdAt);
    }
    this.save(); return ticket;
  }
  forget(accountId: string) {
    this.data.tickets = this.data.tickets.filter((t) => t.accountId !== accountId);
    delete this.data.posted[accountId];
    for (const t of this.data.tickets) t.votes = t.votes.filter((v) => v !== accountId);
    this.save();
  }
  save() { if (!this.file || this.#timer) return; this.#timer = setTimeout(() => { this.#timer = null; this.flush(); }, 300); this.#timer.unref?.(); }
  flush() {
    if (!this.file) return; if (this.#timer) { clearTimeout(this.#timer); this.#timer = null; }
    const tmp = `${this.file}.${process.pid}.tmp`; writeFileSync(tmp, JSON.stringify(this.data), { mode: 0o600 }); renameSync(tmp, this.file);
  }
}

class ApiError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status; } }
const fail = (status: number, message: string): never => { throw new ApiError(status, message); };
function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(body));
}
async function body(req: IncomingMessage, max = 4_096): Promise<Record<string, unknown>> {
  if (!sameOriginJson(req)) fail(400, 'Petición no válida.');
  let raw = '';
  for await (const c of req) { raw += c; if (raw.length > max) fail(413, 'La petición es demasiado grande.'); }
  try { const v: unknown = JSON.parse(raw || '{}'); if (!v || typeof v !== 'object' || Array.isArray(v)) return fail(400, 'Se esperaba un objeto JSON.'); return v as Record<string, unknown>; }
  catch (e) { if (e instanceof ApiError) throw e; return fail(400, 'JSON no válido.'); }
}

export interface TablonDeps {
  accounts: AccountStore; store: TablonStore;
  /** ¿Ha hecho esta cuenta al menos una actividad? Lo decide el servidor con sus propios registros. */
  hasActivity: (accountId: string) => boolean;
  teacherOk?: (req: IncomingMessage) => boolean; now?: () => number;
}

export function createTablon({ accounts, store, hasActivity, teacherOk, now = Date.now }: TablonDeps) {
  /** Vista pública: nunca el alias ni el id de cuenta de otros; «mine» y «voted» solo para quien pregunta. */
  const view = (t: Ticket, me: Account | null) => ({
    id: t.id, n: t.n, category: t.category, title: t.title, body: t.body, status: t.status, createdAt: t.createdAt, updatedAt: t.updatedAt,
    votes: t.votes.length, reply: t.reply, repliedAt: t.repliedAt, mine: !!me && t.accountId === me.id, voted: !!me && t.votes.includes(me.id),
  });
  const whoAmI = (req: IncomingMessage): Account | null => { const w = identify(accounts, req); return w.kind === 'account' ? w.account : null; };
  const need = (req: IncomingMessage): Account => { const a = whoAmI(req); if (!a) fail(401, 'Inicia sesión para usar el tablón.'); return a as Account; };
  const blocked = (a: Account) => a.disabled || a.aliasStatus === 'blocked';
  const permissions = (a: Account) => {
    const mine = store.data.tickets.filter((t) => t.accountId === a.id);
    const open = mine.filter((t) => t.status === 'abierto' || t.status === 'en-curso').length;
    const today = (store.data.posted[a.id] ?? []).filter((at) => now() - at < DAY).length;
    const active = hasActivity(a.id);
    const reason = blocked(a) ? 'Tu cuenta no puede publicar en el tablón.'
      : !active ? 'Haz al menos una actividad (practicar, una misión, un juego o algo con Klaus) para abrir peticiones.'
      : open >= TABLON_LIMITS.openPerAccount ? `Tienes ${open} peticiones abiertas: espera a que se resuelva alguna.`
      : today >= TABLON_LIMITS.perDay ? 'Ya has abierto 3 peticiones en las últimas 24 horas.' : null;
    return { alias: a.alias, active, canPost: !reason, canVote: active && !blocked(a), reason, open, limit: TABLON_LIMITS.openPerAccount };
  };

  async function dispatch(req: IncomingMessage, res: ServerResponse, path: string) {
    const get = req.method === 'GET' || req.method === 'HEAD', post = req.method === 'POST';
    if (path === '' && get) {
      const me = whoAmI(req);
      return json(res, 200, { tickets: store.data.tickets.filter((t) => t.status !== 'descartado' || (me && t.accountId === me.id)).map((t) => view(t, me)), me: me ? permissions(me) : null, limits: TABLON_LIMITS });
    }
    if (path === '/ticket' && post) {
      const a = need(req), p = permissions(a); if (!p.canPost) return fail(403, p.reason!);
      const b = await body(req);
      const category = TICKET_CATEGORIES.includes(b.category as TicketCategory) ? b.category as TicketCategory : fail(400, 'Elige un tipo de petición.');
      const title = cleanText(b.title, TABLON_LIMITS.titleMax), text = cleanText(b.body, TABLON_LIMITS.bodyMax, true);
      if (title.length < TABLON_LIMITS.titleMin) return fail(400, `El título necesita al menos ${TABLON_LIMITS.titleMin} caracteres.`);
      if (text.length < TABLON_LIMITS.bodyMin) return fail(400, `Explica tu petición con al menos ${TABLON_LIMITS.bodyMin} caracteres.`);
      if (hasBadWords(title) || hasBadWords(text)) return fail(400, 'Reescribe la petición sin palabras malsonantes.');
      if (/https?:\/\/|www\./i.test(title + text)) return fail(400, 'Las peticiones no pueden llevar enlaces.');
      if (store.data.tickets.some((t) => t.accountId === a.id && t.title.toLowerCase() === title.toLowerCase() && t.status !== 'descartado')) return fail(409, 'Ya tienes una petición con ese título.');
      const t = store.add({ accountId: a.id, alias: a.alias, category, title, body: text, status: 'abierto', createdAt: now(), updatedAt: now(), votes: [], reply: null, repliedAt: null });
      return json(res, 200, { ticket: view(t, a), me: permissions(a) });
    }
    if (path === '/vote' && post) {
      const a = need(req), p = permissions(a); if (!p.canVote) return fail(403, p.reason ?? 'No puedes apoyar peticiones.');
      const b = await body(req, 500), t = store.find(String(b.id ?? ''));
      if (!t || t.status === 'descartado') return fail(404, 'Petición no encontrada.');
      if (t.accountId === a.id) return fail(400, 'No puedes apoyar tu propia petición.');
      t.votes = t.votes.includes(a.id) ? t.votes.filter((v) => v !== a.id) : [...t.votes, a.id]; store.save();
      return json(res, 200, { ticket: view(t, a) });
    }
    if (path === '/withdraw' && post) {
      const a = need(req), b = await body(req, 500), t = store.find(String(b.id ?? ''));
      if (!t || t.accountId !== a.id) return fail(404, 'Petición no encontrada.');
      if (t.status !== 'abierto') return fail(409, 'Solo puedes retirar una petición que sigue abierta.');
      store.data.tickets = store.data.tickets.filter((x) => x !== t); store.save();
      return json(res, 200, { ok: true, me: permissions(a) });
    }
    if (path.startsWith('/admin')) {
      if (!teacherOk?.(req)) return fail(401, 'Solo el profesor puede gestionar el tablón.');
      if (path === '/admin' && get) return json(res, 200, { tickets: store.data.tickets.map((t) => ({ ...view(t, null), alias: t.alias })) });
      if (path === '/admin/update' && post) {
        const b = await body(req), t = store.find(String(b.id ?? '')); if (!t) return fail(404, 'Petición no encontrada.');
        if (b.status !== undefined) { if (!TICKET_STATUSES.includes(b.status as TicketStatus)) return fail(400, 'Estado no válido.'); t.status = b.status as TicketStatus; }
        if (b.reply !== undefined) { const r = cleanText(b.reply, TABLON_LIMITS.replyMax, true); t.reply = r || null; t.repliedAt = r ? now() : null; }
        t.updatedAt = now(); store.save();
        return json(res, 200, { ticket: { ...view(t, null), alias: t.alias } });
      }
      if (path === '/admin/delete' && post) {
        const b = await body(req, 500), t = store.find(String(b.id ?? '')); if (!t) return fail(404, 'Petición no encontrada.');
        store.data.tickets = store.data.tickets.filter((x) => x !== t); store.save();
        return json(res, 200, { ok: true });
      }
    }
    return fail(404, 'Ruta desconocida.');
  }

  const handler = (req: IncomingMessage, res: ServerResponse): boolean => {
    const url = new URL(req.url || '/', 'http://tablon.local');
    if (url.pathname !== '/api/tablon' && !url.pathname.startsWith('/api/tablon/')) return false;
    void dispatch(req, res, url.pathname.slice('/api/tablon'.length)).catch((e: unknown) => {
      if (!(e instanceof ApiError)) console.error('[tablon]', (e as Error)?.name);
      if (res.headersSent) return void res.end();
      json(res, e instanceof ApiError ? e.status : 500, { error: e instanceof ApiError ? e.message : 'No se pudo completar la petición.' });
    });
    return true;
  };
  return Object.assign(handler, { forget: (id: string) => store.forget(id), flush: () => store.flush() });
}
