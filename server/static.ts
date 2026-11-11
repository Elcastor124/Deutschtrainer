// Resolución segura de archivos estáticos. Pura (sin red) para poder probarla.
import { isAbsolute, join, normalize, relative } from 'node:path';

/**
 * Ruta absoluta dentro de `root` para un pathname de URL, o `null` si no es válida:
 *  - un `%` mal formado (decodeURIComponent lanza URIError) o un byte nulo → null;
 *  - cualquier salida de `root` (`..`, o un directorio hermano con el mismo prefijo: `dist-x`) → null.
 */
export function resolveStatic(root: string, pathname: string): string | null {
  let decoded: string;
  try { decoded = decodeURIComponent(pathname); } catch { return null; }
  if (decoded.includes('\0')) return null;
  const file = normalize(join(root, decoded));
  const rel = relative(root, file);
  if (rel.startsWith('..') || isAbsolute(rel)) return null;
  return file;
}

/** Cabeceras de endurecimiento. La CSP admite scripts en línea porque las presentaciones los llevan, pero cierra todo lo
 * demás: solo recursos propios + Google Fonts, las dos APIs de traducción que usa el diccionario, sin <object>, sin que otra
 * web meta Deutschtrainer en un iframe (clickjacking) y sin formularios hacia fuera. HSTS: solo HTTPS durante 1 año. */
export const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'SAMEORIGIN',
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'permissions-policy': 'camera=(), geolocation=(), payment=(), usb=(), microphone=(self)',
  'content-security-policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "media-src 'self' data: blob:",
    "connect-src 'self' ws: wss: https://api.mymemory.translated.net https://translate.googleapis.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join('; '),
} as const;
