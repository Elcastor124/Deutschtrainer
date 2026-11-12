// Rutas públicas de la web: el cliente (App.tsx: título y página 404) y el servidor (código 404 real y sitemap)
// usan la MISMA lista, así no se desincronizan. Añadir aquí cada ruta nueva.

/** [patrón, título de la pestaña, ¿va al sitemap?] */
const ROUTES: [RegExp, string, string | null][] = [
  [/^\/$/, 'Deutschtrainer · Aprende alemán paso a paso', '/'],
  [/^\/curso\/?$/, 'Tu curso', '/curso'],
  [/^\/practi[cz]a\/?$/, 'Practicar', '/practica'],
  [/^\/mision\/?$/, 'Misión de hoy', null],
  [/^\/juegos\/?$/, 'Juegos', '/juegos'],
  [/^\/(examenes|road-to-b1)\/?$/, 'Exámenes', '/examenes'],
  [/^\/road-to-b1\/level-1\/?$/, 'Road to B1 · Nivel 1', null],
  [/^\/examenes\/a1-a2\/?$/, 'Simulacro A1–A2', null],
  [/^\/examenes\/horen-001\/?$/, 'Hören · Examen de comprensión', null],
  [/^\/examenes\/lesen-001\/?$/, 'Leseverstehen · Alltag und Kommunikation', null],
  [/^\/ranking\/?$/, 'Ranking semanal', '/ranking'],
  [/^\/mi\/?$/, 'Mi espacio', null],
  [/^\/cuenta\/?$/, 'Mi cuenta', null],
  [/^\/registro\/?$/, 'Crear cuenta', '/registro'],
  [/^\/entrar\/?$/, 'Entrar', null],
  [/^\/invitar\/?$/, 'Invita a un amigo', null],
  [/^\/i\/[A-Za-z0-9]{4,12}\/?$/, 'Te han invitado a Deutschtrainer', null],
  [/^\/klaus\/?$/, 'Klaus', '/klaus'],
  [/^\/escribir\/?$/, 'Schreibt mit Klaus', null],
  [/^\/unterricht\/?$/, 'Unterricht mit Klaus', null],
  [/^\/hablar\/?$/, 'Redet mit Klaus', null],
  [/^\/tablon\/?$/, 'Tablón', '/tablon'],
  [/^\/plus\/?$/, 'Deutschtrainer Plus', '/plus'],
  [/^\/teoria\/[\w-]+\/?$/, 'Teoría', null],
  [/^\/libre(\/jugar)?\/?$/, 'Modo libre', null],
  [/^\/(tema\/1|biblioteca)\/?$/, 'Biblioteca', '/biblioteca'],
  [/^\/tema\/1\/taller\/?$/, 'Taller', null],
  [/^\/jenga\/?$/, 'Jenga', null],
  [/^\/jugar\/?$/, 'BlackCard', null],
  [/^\/boxeo\/?$/, 'Boxeo', null],
  [/^\/(t|p|j)\/[A-Za-z0-9]{3,8}\/?$/, 'Sala de clase', null],
  [/^\/(teacher|profesor)(\/.*)?$/, 'Teacher OS', null],
  [/^\/preview\/klaus\/?$/, 'Klaus', null],
];

/** ¿Existe esta ruta de la app? (lo que no, es una 404 de verdad). */
export function isKnownRoute(path: string): boolean { return ROUTES.some(([re]) => re.test(path)); }

/** Título de la pestaña (y de Google) para una ruta; null si no existe. */
export function routeTitle(path: string): string | null {
  const r = ROUTES.find(([re]) => re.test(path));
  if (!r) return null;
  return r[1].startsWith('Deutschtrainer') ? r[1] : `${r[1]} · Deutschtrainer`;
}

/** Rutas públicas que se anuncian a los buscadores. */
export const SITEMAP_PATHS: string[] = ROUTES.map((r) => r[2]).filter((p): p is string => !!p);
