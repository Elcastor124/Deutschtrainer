import type { BoxingAction, BoxingView, BoxingWelcome } from '../shared/boxing.ts';
import { studentSession, teacherKey } from './util.ts';

type SessionStore = Pick<Storage, 'getItem' | 'setItem'>;
const slot = (code: string, role: BoxingWelcome['role']) => `dt:boxing:${role}:${code}`;
export function saveBoxingSession(session: BoxingWelcome, storage: SessionStore = localStorage) {
  try {
    storage.setItem(slot(session.code, session.role), JSON.stringify(session));
    storage.setItem('dt:boxing:last', JSON.stringify({ code: session.code, role: session.role }));
  } catch { /* La sesión sigue viva aunque el navegador bloquee el almacenamiento. */ }
}
export function readBoxingSession(code?: string, role?: BoxingWelcome['role'], storage: SessionStore = localStorage): BoxingWelcome | null {
  try {
    if (!code) {
      const last = JSON.parse(storage.getItem('dt:boxing:last') ?? 'null');
      if (!last?.code || !['teacher', 'player'].includes(last.role)) return null;
      return readBoxingSession(last.code, last.role, storage);
    }
    for (const kind of role ? [role] : ['player', 'teacher'] as const) {
      const value = JSON.parse(storage.getItem(slot(code, kind)) ?? 'null');
      if (value?.code === code && value.role === kind && typeof value.token === 'string' && value.token) return value;
    }
  } catch { /* Una entrada dañada nunca impide entrar en otra sala. */ }
  return null;
}

/** `free`: partida del modo libre (API de jugador /api/play/boxing/*, con la sesión de alumno si la hay). */
export async function boxingRequest<T>(path: string, body?: unknown, token?: string, signal?: AbortSignal, free = false): Promise<T> {
  const student = free ? studentSession() : undefined;
  const response = await fetch(`/api/${free ? 'play/boxing' : 'boxing'}/${path}`, {
    method: body === undefined ? 'GET' : 'POST', cache: 'no-store', signal,
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(student ? { 'X-Student-Session': student } : {}), ...(!free && path === 'create' && teacherKey() ? { 'X-Teacher-Key': teacherKey()! } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  let data;
  try { data = await response.json(); } catch { throw new Error('El servidor no ha respondido correctamente. Reintenta en unos segundos.'); }
  if (!response.ok || data?.ok === false) throw new Error(typeof data?.error === 'string' ? data.error : 'No se pudo completar la acción. Comprueba la conexión.');
  return data as T;
}

export interface BoxingClientState {
  view: BoxingView | null;
  connection: 'connecting' | 'online' | 'offline';
  error: string | null;
  busy: boolean;
}

/** One in-flight request, abortable room lifetime; the server alone resolves exchanges. */
export class BoxingClient {
  private session: BoxingWelcome;
  private snapshot: BoxingClientState = { view: null, connection: 'connecting', error: null, busy: false };
  private listeners = new Set<() => void>();
  private timer?: ReturnType<typeof setTimeout>;
  private controller?: AbortController;
  private generation = 0;
  private closed = false;
  private polling = false;
  constructor(session: BoxingWelcome) { this.session = session; }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.snapshot;
  private set(patch: Partial<BoxingClientState>) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }
  private cancel() {
    ++this.generation;
    clearTimeout(this.timer);
    this.controller?.abort();
  }
  private schedule() {
    if (this.polling && !this.closed) this.timer = setTimeout(() => { void this.refresh(); }, 650);
  }
  start() { this.closed = false; this.polling = true; void this.refresh(); }
  refresh = async () => {
    if (this.closed || this.snapshot.busy) return;
    this.cancel();
    const generation = this.generation;
    const controller = this.controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const view = await boxingRequest<BoxingView>(`state?code=${encodeURIComponent(this.session.code)}`, undefined, this.session.token, controller.signal, !!this.session.free);
      if (!this.closed && generation === this.generation) this.set({ view, connection: 'online', error: null });
    } catch (error) {
      if (!this.closed && generation === this.generation) this.set({ connection: 'offline', error: error instanceof Error && error.name !== 'AbortError' ? error.message : 'La conexión tarda demasiado. Reintentando…' });
    } finally {
      clearTimeout(timeout);
      if (generation === this.generation) this.schedule();
    }
  };
  action = async (action: BoxingAction) => {
    if (this.closed || this.snapshot.busy) return false;
    this.cancel();
    const generation = this.generation;
    const controller = this.controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    this.set({ busy: true, error: null });
    let ok = false;
    try {
      await boxingRequest('action', { code: this.session.code, action }, this.session.token, controller.signal, !!this.session.free);
      ok = true;
      if (!this.closed && generation === this.generation) this.set({ connection: 'online' });
    } catch (error) {
      if (!this.closed && generation === this.generation) this.set({ error: error instanceof Error && error.name !== 'AbortError' ? error.message : 'No se ha confirmado la acción. Comprueba tu conexión antes de reintentar.' });
    } finally {
      clearTimeout(timeout);
      if (!this.closed && generation === this.generation) {
        const error = this.snapshot.error;
        this.set({ busy: false });
        // Always reconcile: the server may have accepted an action before a network timeout.
        await this.refresh();
        if (!ok && !this.closed && this.snapshot.connection === 'online') this.set({ error });
      }
    }
    return ok;
  };
  close() { this.closed = true; this.polling = false; this.cancel(); }
}
