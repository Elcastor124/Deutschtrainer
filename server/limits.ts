// Limitadores en memoria (sin servicios externos). Son POR PROCESO: el estado del juego también vive en memoria,
// así que la app solo funciona con una instancia (ver server/instance-lock.ts y docs/SECURITY_AUDIT.md).
import type { IncomingMessage } from 'node:http';

export const envInt = (name: string, fallback: number, env: NodeJS.ProcessEnv = process.env): number => {
  const v = Number(env[name]);
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : fallback;
};

/** Ventana deslizante por clave. `take` comprueba y registra; `blocked`/`record` permiten contar solo los fallos. */
export class SlidingLimiter {
  private hits = new Map<string, number[]>();
  readonly max: number;
  readonly windowMs: number;
  private now: () => number;
  constructor(max: number, windowMs: number, now: () => number = Date.now) { this.max = max; this.windowMs = windowMs; this.now = now; }

  private live(key: string): number[] {
    const cutoff = this.now() - this.windowMs;
    const arr = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (arr.length) this.hits.set(key, arr); else this.hits.delete(key);
    return arr;
  }
  blocked(key: string): boolean { return this.live(key).length >= this.max; }
  record(key: string) { const a = this.live(key); a.push(this.now()); this.hits.set(key, a); }
  /** true = permitido (y registrado). */
  take(key: string): boolean { if (this.blocked(key)) return false; this.record(key); return true; }
  /** Segundos hasta que el intento más antiguo salga de la ventana (para el mensaje al usuario). */
  retryAfter(key: string): number { const a = this.live(key); return a.length ? Math.max(1, Math.ceil((a[0] + this.windowMs - this.now()) / 1000)) : 0; }
  sweep() { for (const k of [...this.hits.keys()]) this.live(k); }
  get size() { return this.hits.size; }
}

/** Cubo de fichas (ráfaga + ritmo sostenido) para mensajes por conexión. */
export class TokenBucket {
  private tokens: number;
  private last: number;
  private capacity: number;
  private perSecond: number;
  private now: () => number;
  constructor(capacity: number, perSecond: number, now: () => number = Date.now) { this.capacity = capacity; this.perSecond = perSecond; this.now = now; this.tokens = capacity; this.last = now(); }
  take(): boolean {
    const t = this.now();
    this.tokens = Math.min(this.capacity, this.tokens + ((t - this.last) / 1000) * this.perSecond);
    this.last = t;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

/**
 * IP del cliente. Con `trustProxy = n` (variable TRUST_PROXY) se toma la entrada n-ésima desde la derecha de X-Forwarded-For:
 * las de la izquierda las puede falsificar el cliente, las de la derecha las añaden nuestros proxies.
 * Sin TRUST_PROXY se ignora la cabecera (un cliente directo no puede inventarse otra IP).
 */
export function clientIp(req: Pick<IncomingMessage, 'headers' | 'socket'>, trustProxy = 0): string {
  const direct = req.socket?.remoteAddress ?? 'unknown';
  if (trustProxy > 0) {
    const raw = req.headers['x-forwarded-for'];
    const list = (Array.isArray(raw) ? raw.join(',') : raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const hit = list[list.length - trustProxy];
    if (hit) return hit.replace(/^::ffff:/, '');
  }
  return direct.replace(/^::ffff:/, '');
}
