// Conexión WebSocket con reconexión automática. El servidor es la única fuente de verdad:
// aquí no se simula nada; si una acción no llega, se informa al usuario.
import { useSyncExternalStore } from 'react';
import type { ClientMsg, RoomView, ServerMsg } from '../shared/types.ts';

export type Conn = 'connecting' | 'online' | 'offline';
type Hello = Extract<ClientMsg, { t: 'hello' }>;
type Welcome = Extract<ServerMsg, { t: 'welcome' }>;
export interface Ack { ok: boolean; error?: string; retry?: boolean }
type Request = ClientMsg extends infer M ? (M extends { id: number } ? Omit<M, 'id'> : never) : never;

export interface NetState {
  conn: Conn;
  view: RoomView | null;
  error: string | null;
  fatal: boolean;
  /** serverNow − Date.now() */
  offset: number;
  pid?: string;
}

export class Net {
  state: NetState = { conn: 'connecting', view: null, error: null, fatal: false, offset: 0 };
  private ws: WebSocket | null = null;
  private listeners = new Set<() => void>();
  private hello: Hello;
  private retries = 0;
  private seq = 0;
  private pending = new Map<number, (a: Ack) => void>();
  private closed = false;
  onWelcome?: (m: Welcome) => void;

  constructor(hello: Hello, onWelcome?: (m: Welcome) => void) {
    this.hello = hello;
    this.onWelcome = onWelcome;
    // Acceso de depuración (pruebas automáticas). Solo contiene lo que este cliente ya ve: nunca soluciones.
    (globalThis as { __bcNet?: Net }).__bcNet = this;
    this.open();
  }

  private set(p: Partial<NetState>) {
    this.state = { ...this.state, ...p };
    for (const l of this.listeners) l();
  }

  private open() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws = ws;
    this.set({ conn: 'connecting' });
    ws.onopen = () => {
      this.retries = 0;
      ws.send(JSON.stringify(this.hello));
    };
    ws.onmessage = (e) => {
      let m: ServerMsg;
      try { m = JSON.parse(e.data); } catch { return; }
      this.receive(m);
    };
    ws.onclose = () => {
      if (this.ws === ws) this.ws = null;
      for (const r of this.pending.values()) r({ ok: false, error: 'Se ha perdido la conexión: la acción no ha llegado al servidor.' });
      this.pending.clear();
      if (this.closed || this.state.fatal) return;
      this.set({ conn: 'offline' });
      setTimeout(() => !this.closed && this.open(), Math.min(5000, 400 * 2 ** this.retries++));
    };
  }

  private receive(m: ServerMsg) {
    if (m.t === 'welcome') {
      // A partir de ahora, si se reconecta, se identifica con su token (no crea otro jugador).
      this.hello = { t: 'hello', role: m.role, room: m.room, token: m.token } as Hello;
      this.onWelcome?.(m);
      this.set({ conn: 'online', error: null, pid: m.pid });
    } else if (m.t === 'state') {
      this.set({ view: m.s, offset: m.s.serverNow - Date.now(), conn: 'online' });
    } else if (m.t === 'ack') {
      this.pending.get(m.id)?.(m);
      this.pending.delete(m.id);
    } else if (m.t === 'err') {
      this.set({ error: m.msg, fatal: !!m.fatal });
      if (m.fatal) this.close();
    }
  }

  request(msg: Request): Promise<Ack> {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return Promise.resolve({ ok: false, error: 'Sin conexión con el servidor. Reintentando…' });
    const id = ++this.seq;
    ws.send(JSON.stringify({ ...msg, id }));
    return new Promise((res) => {
      this.pending.set(id, res);
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          res({ ok: false, error: 'El servidor no ha respondido. Comprueba la conexión.' });
        }
      }, 8000);
    });
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.state;

  close() {
    this.closed = true;
    this.ws?.close();
  }
}

export function useNet(net: Net): NetState {
  return useSyncExternalStore(net.subscribe, net.getSnapshot);
}

/** Hora del servidor estimada. */
export const serverNow = (s: NetState) => Date.now() + s.offset;
