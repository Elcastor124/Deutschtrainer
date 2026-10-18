// «Gamejuice»: sacudidas, destellos, ondas, golpes de escala y puntos que vuelan de un sitio a otro.
// Todo con transform/opacity (barato en Chromebooks) y desactivable con el modo ligero o «reducir movimiento».
import { burst } from './particles.ts';

let lite = false;
export const setJuiceLite = (v: boolean) => { lite = v; };
const calm = () => lite || matchMedia('(prefers-reduced-motion: reduce)').matches;
export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type Target = Element | DOMRect | null | undefined;
export function rectOf(t: Target): DOMRect | null {
  if (!t) return null;
  if (t instanceof DOMRect) return t;
  const r = t.getBoundingClientRect();
  return r.width || r.height ? r : null;
}
const centerOf = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

/** Sacude toda la interfaz (no las capas de efectos). */
export function shake(power = 1) {
  if (calm()) return;
  const el = document.querySelector('.app');
  if (!el) return;
  const a = 9 * power;
  const frames = [0, -1, 0.8, -0.6, 0.4, -0.2, 0].map((k, i) => ({ transform: `translate(${(k * a).toFixed(1)}px, ${(i % 2 ? -1 : 1) * Math.abs(k) * a * 0.35}px)` }));
  el.animate(frames, { duration: 360 + 80 * power, easing: 'ease-out' });
}

/** Destello de pantalla completa. */
export function flash(kind: 'white' | 'red' | 'gold' | 'black' = 'white', ms = 420) {
  if (lite) return;
  const d = document.createElement('div');
  d.className = `flash ${kind}`;
  d.setAttribute('aria-hidden', 'true');
  document.body.appendChild(d);
  d.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, easing: 'ease-out' }).onfinish = () => d.remove();
}

/** Golpe de escala sobre un elemento (aterriza un punto, sube el marcador…). */
export function punch(el: Element | null | undefined, scale = 1.22) {
  if (!el || calm()) return;
  el.animate([{ transform: 'scale(1)' }, { transform: `scale(${scale})`, offset: 0.35 }, { transform: 'scale(1)' }], { duration: 380, easing: 'cubic-bezier(.2,1.5,.4,1)' });
}

/** Onda expansiva circular. */
export function ring(at: Target, color = 'var(--paper)', size = 420) {
  const r = rectOf(at);
  if (!r || calm()) return;
  const { x, y } = centerOf(r);
  const d = document.createElement('div');
  d.className = 'ring';
  d.style.cssText = `left:${x}px;top:${y}px;--c:${color};width:${size}px;height:${size}px;margin:${-size / 2}px 0 0 ${-size / 2}px`;
  document.body.appendChild(d);
  d.animate([{ transform: 'scale(0.05)', opacity: 1 }, { transform: 'scale(1)', opacity: 0 }], { duration: 650, easing: 'cubic-bezier(.1,.7,.3,1)' }).onfinish = () => d.remove();
}

/** Texto que vuela en arco de un punto a otro (p. ej. «+5» al marcador) y golpea al llegar. */
export async function flyText(from: Target, to: Target, text: string, cls = '', dur = 760): Promise<void> {
  const a = rectOf(from), b = rectOf(to);
  if (!a || !b) return;
  const p0 = centerOf(a), p1 = centerOf(b);
  const d = document.createElement('div');
  d.className = `fly ${cls}`;
  d.textContent = text;
  d.setAttribute('aria-hidden', 'true');
  d.style.left = `${p0.x}px`;
  d.style.top = `${p0.y}px`;
  document.body.appendChild(d);
  if (calm()) {
    await sleep(250);
    d.remove();
    return;
  }
  const dx = p1.x - p0.x, dy = p1.y - p0.y;
  const lift = Math.min(160, 60 + Math.abs(dx) * 0.25);
  await d.animate([
    { transform: 'translate(-50%,-50%) scale(0.6)', opacity: 0 },
    { transform: 'translate(-50%,-50%) scale(1.35)', opacity: 1, offset: 0.18 },
    { transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${dy * 0.5 - lift}px)) scale(1.1)`, opacity: 1, offset: 0.6 },
    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.5)`, opacity: 0.9 },
  ], { duration: dur, easing: 'cubic-bezier(.45,0,.25,1)' }).finished.catch(() => undefined);
  d.remove();
  punch(to instanceof Element ? to : null);
  burst(p1.x, p1.y, cls.includes('neg') ? 'shard' : 'pixel', 14, { speed: 0.6, up: 0.3 });
}

/** Chorro de puntos luminosos de un sitio a otro (robos). */
export async function stream(from: Target, to: Target, n = 10, color = 'var(--signal)'): Promise<void> {
  const a = rectOf(from), b = rectOf(to);
  if (!a || !b) return;
  if (calm()) return;
  const p0 = centerOf(a), p1 = centerOf(b);
  const jobs: Promise<unknown>[] = [];
  for (let i = 0; i < n; i++) {
    const d = document.createElement('i');
    d.className = 'mote';
    d.style.cssText = `left:${p0.x}px;top:${p0.y}px;--c:${color}`;
    document.body.appendChild(d);
    const bend = (Math.random() - 0.5) * 220;
    const anim = d.animate([
      { transform: 'translate(-50%,-50%) scale(0)', opacity: 0 },
      { transform: `translate(calc(-50% + ${(p1.x - p0.x) * 0.5 + bend}px), calc(-50% + ${(p1.y - p0.y) * 0.5 - 80}px)) scale(1.4)`, opacity: 1, offset: 0.5 },
      { transform: `translate(calc(-50% + ${p1.x - p0.x}px), calc(-50% + ${p1.y - p0.y}px)) scale(0.6)`, opacity: 1 },
    ], { duration: 620 + Math.random() * 260, delay: i * 45, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'backwards' });
    jobs.push(anim.finished.catch(() => undefined).then(() => d.remove()));
  }
  await Promise.all(jobs);
  if (to instanceof Element) punch(to, 1.15);
  burst(p1.x, p1.y, 'pixel', 18, { colors: ['#FF3832', '#F2F1EE'], speed: 0.7 });
}

/** Marca un elemento con un brillo temporal (clase CSS «hit-<tipo>»). */
export function mark(el: Element | null | undefined, kind: 'good' | 'bad' | 'hot', ms = 900) {
  if (!el) return;
  const c = `hit-${kind}`;
  el.classList.remove(c);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(c);
  setTimeout(() => el.classList.remove(c), ms);
}
