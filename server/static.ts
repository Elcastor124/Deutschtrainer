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

/** Cabeceras de endurecimiento sin efecto sobre el contenido (no hay CSP: las presentaciones llevan scripts en línea). */
export const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
} as const;
