// BlackCard en 3D (Three.js, cargado bajo demanda). Dos escenas:
//  · activate: la carta entra girando, brilla y se retira.
//  · burn: muestra el resultado (+10 / −10) y se quema de forma procedural:
//    borde incandescente, zona carbonizada, brasas (aditivas) y cenizas que suben.
// El campo de ruido se calcula una vez en CPU y se sube como textura: shader y emisor de partículas
// usan exactamente los mismos valores, así las brasas nacen justo en el frente de fuego.
import * as THREE from 'three';
import { GLYPHS } from '../components/Glyph.tsx';

export interface BcOpts { mode: 'activate' | 'burn'; result?: 'win' | 'lose'; lite?: boolean }

const W = 512, H = 716;           // textura de la carta (5:7)
const CW = 2.5, CH = 3.5;          // tamaño en el mundo
const NX = 96, NY = 134;           // resolución del campo de combustión
const N_MAX = 1.0;                 // el campo se normaliza a [0, 1]

// ── ruido (solo CPU) ──
const fract = (x: number) => x - Math.floor(x);
const hash = (x: number, y: number) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
function vnoise(x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
function fbm(x: number, y: number) {
  let v = 0, a = 0.5;
  for (let i = 0; i < 5; i++) { v += a * vnoise(x, y); x *= 2.03; y *= 2.03; a *= 0.5; }
  return v;
}

function roundRect(x: CanvasRenderingContext2D, l: number, t: number, w: number, h: number, r: number) {
  x.beginPath();
  x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r); x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r);
  x.closePath();
}

function face(kind: 'front' | 'win' | 'lose' | 'back'): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d') as CanvasRenderingContext2D;
  roundRect(x, 0, 0, W, H, 34);
  x.clip();
  if (kind === 'back') {
    x.fillStyle = '#FF3832'; x.fillRect(0, 0, W, H);
    x.fillStyle = 'rgba(8,8,8,0.55)';
    for (let yy = 14; yy < H; yy += 20) for (let xx = 14 + ((yy / 20) % 2) * 10; xx < W; xx += 20) { x.beginPath(); x.arc(xx, yy, 2.6, 0, 7); x.fill(); }
    x.fillStyle = '#080808'; x.font = '900 190px "Doto Variable", monospace'; x.textAlign = 'center'; x.fillText('BC', W / 2, H / 2 + 66);
    return c;
  }
  x.fillStyle = '#060606'; x.fillRect(0, 0, W, H);
  const g = x.createRadialGradient(W / 2, H * 0.55, 10, W / 2, H * 0.55, W * 0.75);
  g.addColorStop(0, 'rgba(255,56,50,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = 'rgba(242,241,238,0.07)';
  for (let yy = 18; yy < H; yy += 18) for (let xx = 18; xx < W; xx += 18) { x.beginPath(); x.arc(xx, yy, 1.3, 0, 7); x.fill(); }
  x.strokeStyle = '#FF3832'; x.lineWidth = 5; roundRect(x, 16, 16, W - 32, H - 32, 24); x.stroke();
  x.strokeStyle = 'rgba(242,241,238,0.18)'; x.lineWidth = 1.5; roundRect(x, 30, 30, W - 60, H - 60, 16); x.stroke();
  x.textAlign = 'left';
  x.fillStyle = '#FF3832'; x.font = '900 70px "Doto Variable", monospace';
  x.fillText('BLACK', 50, 112); x.fillText('CARD', 50, 178);
  x.fillStyle = '#F2F1EE'; x.font = '600 22px "Space Grotesk Variable", sans-serif'; x.fillText('Risk or reward', 54, 218);
  if (kind === 'front') {
    const rows = GLYPHS.blackcard, cell = 30, ox = W / 2 - (9 * cell) / 2, oy = 262;
    x.shadowColor = '#FF3832'; x.shadowBlur = 22;
    rows.forEach((row, yy) => [...row].forEach((ch, xx) => {
      x.fillStyle = ch === '#' ? '#FF3832' : 'rgba(242,241,238,0.06)';
      x.beginPath(); x.arc(ox + xx * cell + cell / 2, oy + yy * cell + cell / 2, ch === '#' ? 11 : 4, 0, 7); x.fill();
    }));
    x.shadowBlur = 0;
    x.fillStyle = '#F2F1EE'; x.font = '900 46px "Doto Variable", monospace'; x.textAlign = 'center';
    x.fillText('+10  /  −10', W / 2, H - 92);
    x.fillStyle = 'rgba(242,241,238,0.45)'; x.font = '500 18px "JetBrains Mono Variable", monospace'; x.fillText('Nº 0001 · SOLO PREGUNTAS ◆', W / 2, H - 56);
  } else {
    const win = kind === 'win';
    x.textAlign = 'center';
    x.shadowColor = '#FF3832'; x.shadowBlur = win ? 40 : 28;
    x.fillStyle = win ? '#F2F1EE' : '#FF3832';
    x.font = '900 210px "Doto Variable", monospace';
    x.fillText(win ? '+10' : '−10', W / 2, H * 0.62);
    x.shadowBlur = 0;
    x.font = '700 30px "Space Grotesk Variable", sans-serif'; x.fillStyle = win ? '#FF3832' : '#F2F1EE';
    x.fillText(win ? 'Gewonnen' : 'Verloren', W / 2, H * 0.62 + 60);
  }
  return c;
}

const CARD_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const CARD_FS = `
uniform sampler2D map; uniform sampler2D field; uniform float burn; uniform float time; uniform float glow; uniform float opacity;
varying vec2 vUv;
void main(){
  vec4 tex = texture2D(map, vUv);
  if (tex.a < 0.02) discard;
  float n = texture2D(field, vUv).r * ${N_MAX.toFixed(2)};
  float t = burn * ${(N_MAX + 0.08).toFixed(2)} - 0.04;
  float k = n - t;
  if (burn > 0.0 && k < 0.0) discard;
  float edge = burn > 0.0 ? 1.0 - smoothstep(0.0, 0.06, k) : 0.0;
  float charz = burn > 0.0 ? 1.0 - smoothstep(0.0, 0.28, k) : 0.0;
  vec3 col = tex.rgb * (1.0 - 0.88 * charz);
  vec3 ember = mix(vec3(1.0, 0.16, 0.04), vec3(1.0, 0.86, 0.45), edge * edge);
  float flick = 0.75 + 0.25 * sin(time * 37.0 + n * 90.0);
  col = mix(col, ember * 2.2 * flick, pow(edge, 1.3));
  col += vec3(1.0, 0.12, 0.08) * glow * 0.22;
  gl_FragColor = vec4(col, tex.a * opacity);
}`;
const PT_VS = `
uniform float uScale; attribute float aAlpha; attribute float aSize; attribute vec3 aColor; varying float vA; varying vec3 vC;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; vA = aAlpha; vC = aColor; }`;
const EMBER_FS = `varying float vA; varying vec3 vC;
void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vC * (1.0 + a), a * vA); }`;
// Ceniza: copo irregular (borde ondulado según el ángulo y el tono de cada partícula).
const ASH_FS = `varying float vA; varying vec3 vC;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float seed = vC.r * 97.0;
  float ang = atan(c.y, c.x);
  float r = 0.30 + 0.09 * sin(ang * 3.0 + seed) + 0.06 * sin(ang * 7.0 + seed * 1.7);
  float d = length(c * vec2(1.0, 1.0 + fract(seed) * 0.8));
  if (d > r) discard;
  float edge = smoothstep(r, r - 0.08, d);
  vec3 col = vC + vec3(0.25, 0.08, 0.02) * (1.0 - edge) * step(0.5, fract(seed * 3.1));
  gl_FragColor = vec4(col, vA * edge);
}`;

class Particles {
  n: number;
  pos: Float32Array; vel: Float32Array; life: Float32Array; max: Float32Array; alpha: Float32Array; size: Float32Array; color: Float32Array; phase: Float32Array;
  geo = new THREE.BufferGeometry();
  points: THREE.Points;
  next = 0;
  /** Tamaño de punto en píxeles ≈ aSize · uScale / distancia: depende de la altura real del canvas. */
  scale = { value: 14 };
  constructor(n: number, fs: string, additive: boolean) {
    this.n = n;
    this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.max = new Float32Array(n).fill(1);
    this.alpha = new Float32Array(n); this.size = new Float32Array(n); this.color = new Float32Array(n * 3); this.phase = new Float32Array(n);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.color, 3));
    const mat = new THREE.ShaderMaterial({
      vertexShader: PT_VS, fragmentShader: fs, transparent: true, depthWrite: false, uniforms: { uScale: this.scale },
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
  }
  spawn(p: THREE.Vector3, v: [number, number, number], life: number, size: number, rgb: [number, number, number]) {
    const i = this.next; this.next = (this.next + 1) % this.n;
    this.pos.set([p.x, p.y, p.z], i * 3); this.vel.set(v, i * 3); this.life[i] = life; this.max[i] = life; this.size[i] = size;
    this.color.set(rgb, i * 3); this.phase[i] = Math.random() * 6.28;
  }
  update(dt: number, t: number, kind: 'ember' | 'ash') {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const k = Math.max(0, this.life[i] / this.max[i]);
      const j = i * 3;
      if (kind === 'ember') {
        this.vel[j + 1] += 0.9 * dt;
        this.vel[j] += (Math.random() - 0.5) * 2.2 * dt;
        this.alpha[i] = k;
        this.color[j + 1] = 0.15 + 0.7 * k * k; this.color[j + 2] = 0.05 + 0.3 * k * k * k;
      } else {
        this.vel[j + 1] += 0.18 * dt;
        this.vel[j] = Math.sin(t * 2 + this.phase[i]) * 0.35;
        this.alpha[i] = Math.min(1, k * 2) * 0.85;
      }
      this.pos[j] += this.vel[j] * dt; this.pos[j + 1] += this.vel[j + 1] * dt; this.pos[j + 2] += this.vel[j + 2] * dt;
    }
    for (const a of ['position', 'aAlpha', 'aColor'] as const) (this.geo.getAttribute(a) as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true;
  }
  dispose() { this.geo.dispose(); (this.points.material as THREE.Material).dispose(); }
}

const ease = { out: (k: number) => 1 - Math.pow(1 - k, 3), inOut: (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2) };
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export async function playBlackCard(host: HTMLElement, o: BcOpts): Promise<void> {
  try { await Promise.all([document.fonts.load('900 64px "Doto Variable"'), document.fonts.load('600 22px "Space Grotesk Variable"')]); } catch { /* fuentes del sistema */ }
  const lite = !!o.lite;
  const renderer = new THREE.WebGLRenderer({ antialias: !lite, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, lite ? 1 : 1.5));
  const size = () => renderer.setSize(host.clientWidth, host.clientHeight, false);
  size();
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, host.clientWidth / Math.max(1, host.clientHeight), 0.1, 100);
  camera.position.set(0, 0, 9.5);
  const onResize = () => { size(); fitPoints(); camera.aspect = host.clientWidth / Math.max(1, host.clientHeight); camera.updateProjectionMatrix(); };
  addEventListener('resize', onResize);

  // Campo de combustión compartido (CPU ⇄ GPU)
  const ox = 0.5 + (Math.random() - 0.5) * 0.5, oy = -0.06;
  const raw = new Float32Array(NX * NY);
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const u = i / (NX - 1), v = j / (NY - 1);
    raw[j * NX + i] = fbm(u * 4, v * 5.6) * 0.55 + Math.hypot(u - ox, v - oy) * 0.75;
  }
  // Normalizado a [0, 1]: la combustión se reparte por toda la duración de la animación.
  let lo = Infinity, hi = -Infinity;
  for (const n of raw) { lo = Math.min(lo, n); hi = Math.max(hi, n); }
  const field = new Uint8Array(NX * NY);
  for (let k = 0; k < raw.length; k++) field[k] = Math.round(((raw[k] - lo) / (hi - lo)) * 255);
  const fieldTex = new THREE.DataTexture(field, NX, NY, THREE.RedFormat, THREE.UnsignedByteType);
  fieldTex.magFilter = THREE.LinearFilter; fieldTex.minFilter = THREE.LinearFilter; fieldTex.needsUpdate = true;

  const frontKind = o.mode === 'activate' ? 'front' : o.result === 'win' ? 'win' : 'lose';
  const tFront = new THREE.CanvasTexture(face(frontKind));
  const tBack = new THREE.CanvasTexture(face('back'));
  for (const t of [tFront, tBack]) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; }
  const uniforms = { burn: { value: 0 }, time: { value: 0 }, glow: { value: 0 }, opacity: { value: 1 }, field: { value: fieldTex } };
  const mkMat = (map: THREE.Texture) => new THREE.ShaderMaterial({ vertexShader: CARD_VS, fragmentShader: CARD_FS, transparent: true, uniforms: { ...uniforms, map: { value: map } } });
  const geo = new THREE.PlaneGeometry(CW, CH);
  // Ambas caras comparten los mismos objetos uniform (burn, time…): un solo valor anima las dos.
  const matF = mkMat(tFront), matB = mkMat(tBack);
  const front = new THREE.Mesh(geo, matF);
  const back = new THREE.Mesh(geo, matB);
  back.rotation.y = Math.PI;
  back.position.z = -0.002;
  const card = new THREE.Group();
  card.add(front, back);
  scene.add(card);

  const embers = new Particles(lite ? 260 : 1100, EMBER_FS, true);
  const ash = new Particles(lite ? 90 : 420, ASH_FS, false);
  const fitPoints = () => { const h = renderer.getDrawingBufferSize(new THREE.Vector2()).y; embers.scale.value = h * 0.016; ash.scale.value = h * 0.016; };
  fitPoints();
  scene.add(embers.points, ash.points);

  // Muestras del campo para emitir en el frente de fuego.
  const step = lite ? 4 : 2;
  const samples: { u: number; v: number; n: number }[] = [];
  for (let j = 0; j < NY; j += step) for (let i = 0; i < NX; i += step) samples.push({ u: i / (NX - 1), v: j / (NY - 1), n: (field[j * NX + i] / 255) * N_MAX });
  const tmp = new THREE.Vector3();
  const world = (u: number, v: number) => tmp.set((u - 0.5) * CW, (v - 0.5) * CH, 0.01).applyMatrix4(front.matrixWorld);

  const DUR = o.mode === 'activate' ? 2.5 : 5.0;
  const t0 = performance.now();
  let last = t0;
  let prevT = -1;
  let sparked = false;

  await new Promise<void>((resolve) => {
    const frame = (now: number) => {
      const t = (now - t0) / 1000;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      uniforms.time.value = t;
      if (o.mode === 'activate') {
        const k = ease.out(clamp01(t / 1.1));
        card.position.z = -14 * (1 - k);
        card.rotation.y = 4 * Math.PI * (1 - k) + (t > 1.1 ? Math.sin((t - 1.1) * 2.2) * 0.18 : 0);
        card.rotation.x = 0.25 * (1 - k);
        card.scale.setScalar(0.5 + 0.5 * k);
        uniforms.glow.value = t > 0.9 ? 0.5 + 0.5 * Math.sin(t * 7) : 0;
        if (t > 1.0 && !sparked) {
          sparked = true;
          card.updateMatrixWorld();
          for (let s = 0; s < (lite ? 50 : 180); s++) {
            const side = Math.random();
            const u = side < 0.5 ? Math.random() : side < 0.75 ? 0 : 1, v = side < 0.5 ? (Math.random() < 0.5 ? 0 : 1) : Math.random();
            const p = world(u, v);
            const a = Math.atan2(p.y, p.x);
            embers.spawn(p, [Math.cos(a) * (1 + Math.random() * 2.5), Math.sin(a) * (1 + Math.random() * 2.5), Math.random()], 0.6 + Math.random() * 0.7, 6 + Math.random() * 8, [1, 0.5, 0.2]);
          }
        }
        if (t > 1.95) {
          const k2 = ease.inOut(clamp01((t - 1.95) / 0.5));
          card.position.y = 2.2 * k2;
          card.scale.setScalar(1 - 0.6 * k2);
          uniforms.opacity.value = 1 - k2;
        }
      } else {
        const kin = ease.out(clamp01(t / 0.6));
        card.rotation.y = Math.PI * (1 - kin);
        card.scale.setScalar(0.85 + 0.15 * kin);
        if (o.result === 'lose' && t > 0.6 && t < 1.0) card.position.x = Math.sin(t * 90) * 0.06 * (1 - (t - 0.6) / 0.4);
        else card.position.x = 0;
        uniforms.glow.value = t < 1 ? 0.6 : 0;
        const b = Math.pow(clamp01((t - 1.1) / 3.1), 0.85); // combustión casi lineal, arranque visible
        uniforms.burn.value = b;
        card.updateMatrixWorld();
        const curT = b * (N_MAX + 0.08) - 0.04;
        if (b > 0) {
          for (const s of samples) {
            if (s.n > prevT && s.n <= curT) {
              const p = world(s.u, s.v);
              if (Math.random() < (lite ? 0.5 : 0.9)) {
                embers.spawn(p, [(Math.random() - 0.5) * 0.6, 0.3 + Math.random() * 0.9, (Math.random() - 0.2) * 0.6], 0.5 + Math.random() * 1.1, 4 + Math.random() * 7, [1, 0.8, 0.35]);
              }
              if (Math.random() < 0.14) {
                const g = 0.1 + Math.random() * 0.16;
                ash.spawn(p, [(Math.random() - 0.5) * 0.3, 0.12 + Math.random() * 0.35, Math.random() * 0.3], 1.4 + Math.random() * 1.8, 4 + Math.random() * 7, [g, g * 0.92, g * 0.86]);
              }
            }
          }
          prevT = curT;
        }
      }
      embers.update(dt, t, 'ember');
      ash.update(dt, t, 'ash');
      renderer.render(scene, camera);
      if (t < DUR) requestAnimationFrame(frame);
      else resolve();
    };
    requestAnimationFrame(frame);
  });

  removeEventListener('resize', onResize);
  embers.dispose(); ash.dispose(); geo.dispose(); matF.dispose(); matB.dispose(); tFront.dispose(); tBack.dispose(); fieldTex.dispose();
  renderer.dispose();
  renderer.domElement.remove();
}
