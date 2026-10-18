// Partículas en un único canvas superpuesto (ligero: se detiene cuando no hay nada que dibujar).
type Kind = 'spark' | 'confetti' | 'ember';
interface P { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: Kind; rot: number; vr: number }

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let parts: P[] = [];
let running = false;
let liteMode = false;

export const setLite = (v: boolean) => { liteMode = v; };

function ensure() {
  if (canvas) return;
  canvas = document.createElement('canvas');
  canvas.className = 'particles';
  document.body.appendChild(canvas);
  ctx = canvas.getContext('2d');
  const fit = () => {
    if (!canvas) return;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  fit();
  addEventListener('resize', fit);
}

const COLORS: Record<Kind, string[]> = {
  spark: ['#F2F1EE', '#F2F1EE', '#FF3832'],
  confetti: ['#F2F1EE', '#FF3832', '#8f8e89', '#F2F1EE'],
  ember: ['#ffb347', '#FF3832', '#ffd27a', '#ff6a2b'],
};

export function burst(x: number, y: number, kind: Kind = 'spark', n = 40) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  ensure();
  const count = Math.round(liteMode ? n * 0.25 : n);
  const cols = COLORS[kind];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = kind === 'ember' ? 0.5 + Math.random() * 2 : 2 + Math.random() * (kind === 'confetti' ? 9 : 6);
    parts.push({
      x, y, vx: Math.cos(a) * s, vy: kind === 'ember' ? -1 - Math.random() * 2.5 : Math.sin(a) * s - (kind === 'confetti' ? 5 : 1),
      life: 0, max: 50 + Math.random() * (kind === 'confetti' ? 90 : 40), size: kind === 'confetti' ? 5 + Math.random() * 5 : 2 + Math.random() * 2.5,
      color: cols[i % cols.length], kind, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3,
    });
  }
  if (!running) { running = true; requestAnimationFrame(loop); }
}

export function burstAt(el: Element | null, kind: Kind = 'spark', n = 40) {
  if (!el) return burst(innerWidth / 2, innerHeight / 2, kind, n);
  const r = el.getBoundingClientRect();
  burst(r.left + r.width / 2, r.top + r.height / 2, kind, n);
}

function loop() {
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  for (const p of parts) {
    p.life++;
    p.vy += p.kind === 'ember' ? -0.02 : p.kind === 'confetti' ? 0.22 : 0.08;
    p.vx *= 0.98;
    if (p.kind === 'ember') p.vx += (Math.random() - 0.5) * 0.3;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    const a = Math.max(0, 1 - p.life / p.max);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    if (p.kind === 'confetti') {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); ctx.restore();
    } else {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  parts = parts.filter((p) => p.life < p.max && p.y < innerHeight + 40);
  if (parts.length) requestAnimationFrame(loop);
  else { running = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
}
