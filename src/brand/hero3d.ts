// Escena 3D de la portada (three.js, cargada bajo demanda).
// Centro: el símbolo «Punkt-D» como objeto físico (baldosa negra lacada, tubo rojo, asta papel, punto de oro).
// Alrededor: tres dados de artículo — der / die / das — que el alumno puede tocar para sacar una palabra.
// Detrás: un globo de puntos (la pantalla de puntos de BlackCard hecha esfera).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BRAND, SYMBOL } from './geometry.ts';

export type Article = 'der' | 'die' | 'das';
export interface HeroOptions {
  words: Record<Article, { de: string; es: string }[]>;
  onArticle?: (hit: { article: Article; de: string; es: string }) => void;
  reduced?: boolean;
}
export interface HeroHandle { setActive(on: boolean): void; dispose(): void }

const ART: { a: Article; color: string; ink: string; gender: string }[] = [
  { a: 'der', color: BRAND.paper, ink: BRAND.black, gender: 'maskulin' },
  { a: 'die', color: BRAND.red, ink: BRAND.black, gender: 'feminin' },
  { a: 'das', color: BRAND.gold, ink: BRAND.black, gender: 'neutral' },
];

/** Coordenadas de la retícula 48×48 (y hacia abajo) → mundo (unidad = 8 px). */
const P = (x: number, y: number, z = 0) => new THREE.Vector3((x - 24) / 8, -(y - 24) / 8, z);

function faceTexture(label: string, sub: string, bg: string, ink: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const draw = () => {
    const x = c.getContext('2d')!;
    x.fillStyle = bg; x.fillRect(0, 0, 256, 256);
    // retícula de puntos sutil
    x.fillStyle = 'rgba(0,0,0,0.08)';
    for (let i = 14; i < 256; i += 20) for (let j = 14; j < 256; j += 20) { x.beginPath(); x.arc(i, j, 1.6, 0, Math.PI * 2); x.fill(); }
    x.fillStyle = ink; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '700 92px "Space Grotesk Variable", system-ui, sans-serif';
    x.fillText(label, 128, 116);
    x.font = '600 22px "JetBrains Mono Variable", ui-monospace, monospace';
    x.globalAlpha = 0.7; x.fillText(sub.toUpperCase(), 128, 188); x.globalAlpha = 1;
    tex.needsUpdate = true;
  };
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  draw();
  document.fonts?.ready.then(draw).catch(() => {});
  return tex;
}

function dotSprite(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.55, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.beginPath(); x.arc(32, 32, 30, 0, Math.PI * 2); x.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function mountHero(canvas: HTMLCanvasElement, opts: HeroOptions): HeroHandle {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0, 15.5);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x220806, 0.5));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(4, 6, 8); scene.add(key);
  const rim = new THREE.PointLight(0xff3832, 40, 30, 1.6); rim.position.set(-5, -2, -3); scene.add(rim);
  const warm = new THREE.PointLight(0xe9b949, 26, 30, 1.6); warm.position.set(5, 4, -2); scene.add(warm);

  const disposables: { dispose(): void }[] = [envTex, pmrem];
  const track = <T extends { dispose(): void }>(x: T) => { disposables.push(x); return x; };

  // ── Símbolo en 3D ──
  const world = new THREE.Group();
  scene.add(world);
  const logo = new THREE.Group();
  world.add(logo);
  const lacquer = track(new THREE.MeshPhysicalMaterial({ color: 0x0b0b0b, roughness: 0.28, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.12 }));
  const red = track(new THREE.MeshPhysicalMaterial({ color: 0xff3832, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.2, emissive: 0x3a0402, emissiveIntensity: 0.35 }));
  const paper = track(new THREE.MeshPhysicalMaterial({ color: 0xf2f1ee, roughness: 0.38, clearcoat: 0.5 }));
  const gold = track(new THREE.MeshStandardMaterial({ color: 0xe9b949, roughness: 0.22, metalness: 1 }));

  const tile = new THREE.Mesh(track(new RoundedBoxGeometry(6, 6, 0.8, 6, 1.4)), lacquer);
  logo.add(tile);
  const R = 0.4, Z = 0.4 + R * 0.55;
  // Panza: línea superior + arco (centro 21.5,24, r 12.5) + remate inferior.
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 8; i++) pts.push(P(14.5 + (7 * i) / 8, 11.5, Z));
  for (let i = 1; i <= 40; i++) { const t = Math.PI / 2 - (Math.PI * i) / 40; pts.push(P(21.5 + 12.5 * Math.cos(t), 24 - 12.5 * Math.sin(t), Z)); }
  pts.push(P(22.5, 36.5, Z));
  const bowlCurve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  logo.add(new THREE.Mesh(track(new THREE.TubeGeometry(bowlCurve, 140, R, 20, false)), red));
  const cap = track(new THREE.SphereGeometry(R, 24, 16));
  for (const p of [pts[0], pts[pts.length - 1]]) { const m = new THREE.Mesh(cap, red); m.position.copy(p); logo.add(m); }
  const stemLen = (27 - 11.5) / 8;
  const stem = new THREE.Mesh(track(new THREE.CapsuleGeometry(R * 1.02, stemLen, 8, 20)), paper);
  stem.position.copy(P(14.5, (11.5 + 27) / 2, Z + 0.02));
  logo.add(stem);
  const dot = new THREE.Mesh(track(new THREE.SphereGeometry((SYMBOL.dot.r / 8) * 1.05, 40, 28)), gold);
  dot.position.copy(P(SYMBOL.dot.cx, SYMBOL.dot.cy, Z + 0.12));
  logo.add(dot);

  // ── Dados de artículo ──
  const cubeGeo = track(new RoundedBoxGeometry(1.55, 1.55, 1.55, 5, 0.26));
  const cubes = ART.map((art, i) => {
    const tex = track(faceTexture(art.a, art.gender, art.color, art.ink));
    const mat = track(new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.25, metalness: art.a === 'das' ? 0.25 : 0 }));
    const mesh = new THREE.Mesh(cubeGeo, mat);
    mesh.userData = { article: art.a, i, spin: 0, bump: 0 };
    world.add(mesh);
    return mesh;
  });
  const ANCH = [new THREE.Vector3(-4.1, 2.2, 1.2), new THREE.Vector3(4.15, 0.9, 0.6), new THREE.Vector3(-2.6, -3.25, 1.6)];

  // ── Globo de puntos ──
  const N = 1500, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const cPaper = new THREE.Color(0xf2f1ee), cRed = new THREE.Color(0xff3832), cGold = new THREE.Color(0xe9b949);
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.399963;
    pos.set([Math.cos(th) * r * 6.2, y * 6.2, Math.sin(th) * r * 6.2], i * 3);
    const band = y > 0.33 ? cPaper : y > -0.33 ? cRed : cGold; // franjas de la bandera
    const h = Math.sin(i * 12.9898) * 43758.5453; const rnd = h - Math.floor(h);
    const c = rnd < 0.16 ? band : cPaper.clone().multiplyScalar(0.28);
    col.set([c.r, c.g, c.b], i * 3);
  }
  const gGeo = track(new THREE.BufferGeometry());
  gGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  gGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const sprite = track(dotSprite());
  const globe = new THREE.Points(gGeo, track(new THREE.PointsMaterial({ size: 0.11, map: sprite, vertexColors: true, transparent: true, depthWrite: false, alphaTest: 0.05, opacity: 0.9 })));
  globe.position.z = -4.5;
  globe.rotation.z = 0.25;
  world.add(globe);

  // ── Interacción ──
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  let logoSpin = 0;
  const pick = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects([...cubes, tile, ...logo.children], false)[0]?.object ?? null;
  };
  const onMove = (e: PointerEvent) => {
    mouse.tx = (e.clientX / innerWidth) * 2 - 1; mouse.ty = (e.clientY / innerHeight) * 2 - 1;
  };
  const onCanvasMove = (e: PointerEvent) => { canvas.style.cursor = pick(e) ? 'pointer' : ''; };
  const used: Record<Article, number> = { der: 0, die: 0, das: 0 };
  const onDown = (e: PointerEvent) => {
    const hit = pick(e);
    if (!hit) return;
    if (hit.userData.article) {
      const a = hit.userData.article as Article;
      hit.userData.spin = 1; hit.userData.bump = 1;
      const list = opts.words[a];
      if (list.length) { const w = list[used[a]++ % list.length]; opts.onArticle?.({ article: a, de: w.de, es: w.es }); }
    } else logoSpin = 1;
  };
  addEventListener('pointermove', onMove, { passive: true });
  canvas.addEventListener('pointermove', onCanvasMove);
  canvas.addEventListener('pointerdown', onDown);

  // ── Tamaño ──
  let w = 0, h = 0;
  const resize = () => {
    const r = canvas.parentElement!.getBoundingClientRect();
    if (r.width === w && r.height === h) return;
    w = r.width; h = r.height;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1);
    // Encaja el conjunto (≈11 × 9.5 unidades) en el lienzo, sea horizontal o vertical.
    const fitH = 10.2 / (2 * Math.tan((camera.fov * Math.PI) / 360));
    const fitW = 11.6 / (2 * Math.tan((camera.fov * Math.PI) / 360) * camera.aspect);
    camera.position.z = Math.max(fitH, fitW);
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas.parentElement!);
  resize();

  // ── Bucle ──
  let active = true, raf = 0, last = performance.now();
  const t0 = last;
  const ease = (x: number) => 1 - Math.pow(1 - Math.min(Math.max(x, 0), 1), 3);
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    const t = (now - t0) / 1000;
    const k = opts.reduced ? 0.15 : 1;
    mouse.x += (mouse.tx - mouse.x) * 0.06; mouse.y += (mouse.ty - mouse.y) * 0.06;
    const intro = opts.reduced ? 1 : ease(t / 1.4);
    world.scale.setScalar(0.72 + 0.28 * intro);
    world.rotation.y = mouse.x * 0.32 + (1 - intro) * -0.9;
    world.rotation.x = mouse.y * 0.18;
    logoSpin = Math.max(0, logoSpin - dt * 0.9);
    logo.rotation.y = Math.sin(t * 0.5 * k) * 0.22 + (logoSpin > 0 ? ease(1 - logoSpin) * Math.PI * 2 : 0);
    logo.rotation.x = Math.sin(t * 0.37 * k) * 0.07;
    logo.position.y = Math.sin(t * 0.8 * k) * 0.12;
    cubes.forEach((c, i) => {
      const a = ANCH[i], u = c.userData;
      u.spin = Math.max(0, u.spin - dt * 1.2); u.bump = Math.max(0, u.bump - dt * 2.4);
      const delay = ease((t - 0.35 - i * 0.18) / 1.1);
      c.position.set(a.x * (0.6 + 0.4 * delay), a.y + Math.sin(t * 0.9 * k + i * 2.1) * 0.22, a.z);
      // Giro solo alrededor de Y (con un ligero balanceo) para que der/die/das se lean siempre derechos.
      const flip = u.spin > 0 ? ease(1 - u.spin) * Math.PI * 2 : 0;
      c.rotation.set(0.22 * Math.sin(t * 0.6 * k + i), -0.5 + i * 0.5 + Math.sin(t * 0.35 * k + i * 2) * 0.55 + flip, 0.1 * Math.sin(t * 0.45 * k + i * 1.3));
      c.scale.setScalar(delay * (1 + Math.sin(u.bump * Math.PI) * 0.22));
    });
    globe.rotation.y += dt * 0.06 * k;
    renderer.render(scene, camera);
  };
  const start = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };
  const onVis = () => (document.hidden || !active ? stop() : start());
  document.addEventListener('visibilitychange', onVis);
  start();

  return {
    setActive(on) { active = on; onVis(); },
    dispose() {
      stop(); ro.disconnect();
      removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointermove', onCanvasMove);
      canvas.removeEventListener('pointerdown', onDown);
      document.removeEventListener('visibilitychange', onVis);
      for (const d of disposables) d.dispose();
      renderer.dispose();
    },
  };
}
