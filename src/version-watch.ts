// Pestañas abiertas desde antes de un despliegue siguen con el JS viejo (p. ej. la tarjeta Plus con Bizum ya quitado).
// Cada 5 min y al volver a la pestaña se mira qué bundle sirve el servidor; si cambió, en la SIGUIENTE navegación
// interna se recarga la página (nunca en medio de un ejercicio, ni perdiendo lo escrito: solo al cambiar de pantalla).
const mine = (() => {
  const s = [...document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]')].map((x) => x.getAttribute('src') ?? '').find((x) => /\/assets\/index-[\w-]+\.js$/.test(x));
  return s ? s.slice(s.lastIndexOf('/') + 1) : null;
})();
let stale = false;

async function check() {
  if (!mine || stale || document.visibilityState === 'hidden') return;
  try {
    const html = await (await fetch('/', { cache: 'no-store', credentials: 'same-origin' })).text();
    const live = /\/assets\/(index-[\w-]+\.js)/.exec(html)?.[1];
    if (live && live !== mine) stale = true;
  } catch { /* sin red: ya se mirará */ }
}

export function watchVersion() {
  if (!mine || import.meta.env.DEV) return;
  setInterval(() => void check(), 5 * 60_000);
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void check(); });
  // navigate() y el botón atrás disparan popstate: la nueva pantalla se carga ya con la versión nueva.
  addEventListener('popstate', () => { if (stale) location.reload(); });
}
