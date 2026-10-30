// Sesiones por cookie HttpOnly: el token nunca queda al alcance de JavaScript (ni en localStorage).
import type { IncomingMessage, ServerResponse } from 'node:http';

export const STUDENT_COOKIE = 'dt_s';
export const TEACHER_COOKIE = 'dt_t';

export function readCookie(req: Pick<IncomingMessage, 'headers'>, name: string): string | undefined {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) { try { return decodeURIComponent(part.slice(i + 1).trim()); } catch { return undefined; } }
  }
  return undefined;
}

/** HttpOnly + SameSite=Lax (+ Secure tras HTTPS). Path=/ para que viaje también en la conexión WebSocket. */
export function setCookie(res: ServerResponse, req: IncomingMessage, name: string, value: string, maxAgeSec: number) {
  const https = req.headers['x-forwarded-proto'] === 'https' || (req.socket as { encrypted?: boolean }).encrypted;
  const c = `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.max(0, Math.floor(maxAgeSec))}${https ? '; Secure' : ''}`;
  const prev = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', [...(Array.isArray(prev) ? prev : prev ? [String(prev)] : []), c]);
}
export const clearCookie = (res: ServerResponse, req: IncomingMessage, name: string) => setCookie(res, req, name, '', 0);

/**
 * Defensa CSRF para peticiones que cambian algo con autenticación por cookie: deben ser JSON (un formulario de otro sitio no puede
 * enviarlo sin preflight) y, si el navegador manda Origin, coincidir con el Host. SameSite=Lax es la segunda barrera.
 */
export function sameOriginJson(req: IncomingMessage): boolean {
  if (!(req.headers['content-type'] ?? '').includes('application/json')) return false;
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}
