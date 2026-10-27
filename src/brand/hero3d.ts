// Escena 3D de la portada (three.js, cargada bajo demanda).
// Una sola pieza de joyería: el símbolo DT/A cuaderno-lápiz en relieve sobre una placa
// lacada con canto dorado, tres órbitas finas (oro, rojo, marfil) con su cuenta de luz,
// un halo cálido que respira y polvo dorado suspendido. Sin texto en 3D ni juguetes.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createHeroMark } from './hero-mark3d.ts';
export { createHeroMark } from './hero-mark3d.ts';

export interface HeroOptions {
  reduced?: boolean;
  /** Abort before or during mount: no GPU work survives it. */
  signal?: AbortSignal;
}
export interface HeroHandle {
  /** Resolves after shaders are compiled and the first frame has been drawn. */
  ready: Promise<void>;
  setActive(on: boolean): void;
  dispose(): void;
}

const GOLD = 0xe9b949, RED = 0xff3832, PAPER = 0xf2f1ee;

function radialTexture(stops: [number, string][], size = 256): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [at, color] of stops) g.addColorStop(at, color);
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function mountHero(canvas: HTMLCanvasElement, opts: HeroOptions = {}): HeroHandle {
  const reduced = !!opts.reduced;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  // MSAA at a capped density: crisp on retina without paying a 4K fill cost.
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 16);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x220806, 0.45));
  const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(4, 6, 8); scene.add(key);
  const rim = new THREE.PointLight(RED, 42, 30, 1.6); rim.position.set(-5, -2, -2); scene.add(rim);
  const warm = new THREE.PointLight(GOLD, 30, 30, 1.6); warm.position.set(5, 4, -1); scene.add(warm);

  const disposables: { dispose(): void }[] = [envTex, pmrem];
  const track = <T extends { dispose(): void }>(x: T) => { disposables.push(x); return x; };

  const world = new THREE.Group();
  scene.add(world);

  // ── Halo: luz cálida detrás de la placa (una textura, mezcla aditiva) ──
  const haloTex = track(radialTexture([[0, 'rgba(255,72,50,0.55)'], [0.28, 'rgba(200,40,30,0.22)'], [0.55, 'rgba(233,185,73,0.07)'], [1, 'rgba(0,0,0,0)']]));
  const haloMat = track(new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const halo = new THREE.Mesh(track(new THREE.PlaneGeometry(19, 19)), haloMat);
  halo.position.z = -3.4;
  world.add(halo);

  // ── Placa: laca negra con canto de oro y el símbolo en relieve ──
  const logo = new THREE.Group();
  logo.name = 'dt-hero-plaque';
  world.add(logo);
  const lacquer = track(new THREE.MeshPhysicalMaterial({ color: 0x0b0b0b, roughness: 0.26, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.1 }));
  const goldMetal = track(new THREE.MeshStandardMaterial({ color: GOLD, roughness: 0.22, metalness: 0.95 }));
  const tile = new THREE.Mesh(track(new RoundedBoxGeometry(5.6, 5.6, 0.7, 6, 1.25)), lacquer);
  const bezel = new THREE.Mesh(track(new RoundedBoxGeometry(5.82, 5.82, 0.5, 6, 1.34)), goldMetal);
  bezel.position.z = -0.14;
  logo.add(bezel, tile);
  // The canonical relief is ~30 tubes/caps/extrusions. Bake it into one mesh per material
  // (4 draw calls instead of ~30): identical pixels, far less per-frame CPU on phones.
  const relief = new THREE.Group();
  relief.name = 'dt-pencil-book-relief';
  const source = createHeroMark();
  source.updateMatrixWorld(true);
  const byMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const sourceResources = new Set<THREE.BufferGeometry | THREE.Material>();
  source.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const material = object.material as THREE.Material;
    sourceResources.add(object.geometry); sourceResources.add(material);
    const geometry = (object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone()).applyMatrix4(object.matrixWorld);
    for (const name of Object.keys(geometry.attributes)) if (!['position', 'normal'].includes(name)) geometry.deleteAttribute(name);
    byMaterial.set(material, [...(byMaterial.get(material) ?? []), geometry]);
  });
  for (const [material, parts] of byMaterial) {
    const merged = mergeGeometries(parts, false);
    parts.forEach(part => part.dispose());
    if (!merged) continue;
    relief.add(new THREE.Mesh(track(merged), track(material)));
  }
  // Source geometries are no longer referenced by the scene; materials are reused above.
  sourceResources.forEach(resource => { if (resource instanceof THREE.BufferGeometry) resource.dispose(); });
  relief.scale.setScalar(0.93);
  relief.position.z = -0.03;
  logo.add(relief);

  // ── Órbitas: hilos de luz finos, cada uno con una cuenta brillante ──
  const ORBITS = [
    { r: 4.75, tube: 0.016, color: GOLD, opacity: 0.85, tilt: [1.18, 0.0, 0.32], speed: 0.16, bead: 0.11 },
    { r: 5.35, tube: 0.012, color: RED, opacity: 0.7, tilt: [1.36, 0.5, -0.55], speed: -0.11, bead: 0.085 },
    { r: 6.05, tube: 0.008, color: PAPER, opacity: 0.32, tilt: [1.05, -0.62, 0.95], speed: 0.07, bead: 0.06 },
  ] as const;
  const beadGeo = track(new THREE.SphereGeometry(1, 20, 14));
  const orbits = ORBITS.map((o) => {
    const pivot = new THREE.Group();
    pivot.name = 'dt-hero-orbit';
    pivot.rotation.set(o.tilt[0], o.tilt[1], o.tilt[2]);
    const spinner = new THREE.Group();
    pivot.add(spinner);
    const ring = new THREE.Mesh(
      track(new THREE.TorusGeometry(o.r, o.tube, 6, 360)),
      track(new THREE.MeshBasicMaterial({ color: o.color, transparent: true, opacity: o.opacity, depthWrite: false })),
    );
    const bead = new THREE.Mesh(beadGeo, track(new THREE.MeshStandardMaterial({ color: o.color, emissive: o.color, emissiveIntensity: 1.6, roughness: 0.3, metalness: 0.4 })));
    bead.scale.setScalar(o.bead);
    bead.position.set(o.r, 0, 0);
    const glow = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: haloTex, color: o.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 })));
    glow.scale.setScalar(o.bead * 9);
    bead.add(glow);
    spinner.add(ring, bead);
    world.add(pivot);
    return { pivot, spinner, speed: o.speed };
  });

  // ── Polvo dorado: un disco amplio de partículas lentas ──
  const N = 520, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const cGold = new THREE.Color(GOLD), cPaper = new THREE.Color(PAPER), cRed = new THREE.Color(RED);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < N; i++) {
    const a = rnd() * Math.PI * 2, r = 3.6 + Math.pow(rnd(), 0.7) * 6.4;
    pos.set([Math.cos(a) * r, (rnd() - 0.5) * 7.5, Math.sin(a) * r * 0.55 - 1.2], i * 3);
    const pick = rnd();
    const c = (pick < 0.6 ? cGold : pick < 0.85 ? cPaper : cRed).clone().multiplyScalar(0.35 + rnd() * 0.65);
    col.set([c.r, c.g, c.b], i * 3);
  }
  const dustGeo = track(new THREE.BufferGeometry());
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dustGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const dotTex = track(radialTexture([[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']], 64));
  const dust = new THREE.Points(dustGeo, track(new THREE.PointsMaterial({ size: 0.075, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 })));
  world.add(dust);

  // ── Bucle (declared before any callback can reach it) ──
  let active = true, raf = 0, last = 0, clock = 0, firstFrame = false, disposed = false;
  let logoSpin = 0;
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  const ease = (x: number) => 1 - Math.pow(1 - Math.min(Math.max(x, 0), 1), 3);
  const pose = (t: number, dt: number) => {
    const k = reduced ? 0 : 1;
    mouse.x += (mouse.tx - mouse.x) * 0.05; mouse.y += (mouse.ty - mouse.y) * 0.05;
    const enter = reduced ? 1 : ease(t / 1.6);
    world.scale.setScalar(0.86 + 0.14 * enter);
    world.rotation.y = mouse.x * 0.22 + (1 - enter) * -0.5;
    world.rotation.x = mouse.y * 0.12;
    logoSpin = Math.max(0, logoSpin - dt * 0.8);
    logo.rotation.y = Math.sin(t * 0.42 * k) * 0.2 + (logoSpin > 0 ? ease(1 - logoSpin) * Math.PI * 2 : 0);
    logo.rotation.x = Math.sin(t * 0.31 * k) * 0.06;
    logo.position.y = Math.sin(t * 0.7 * k) * 0.1;
    // La luz principal barre la laca: el brillo recorre la placa sin mover la cámara.
    key.position.set(Math.cos(t * 0.35 * k) * 7, 5 + Math.sin(t * 0.5 * k) * 2, 8);
    orbits.forEach((o, i) => {
      o.spinner.rotation.z = t * o.speed * k + i * 2.1;
      o.pivot.scale.setScalar(reduced ? 1 : Math.max(0.001, ease((t - 0.25 - i * 0.18) / 1.3)));
    });
    haloMat.opacity = 0.82 + Math.sin(t * 0.8 * k) * 0.14;
    dust.rotation.y = t * 0.025 * k;
    dust.position.y = Math.sin(t * 0.2 * k) * 0.15;
  };
  const draw = () => { renderer.render(scene, camera); firstFrame = true; };
  // Adaptive quality: if the device cannot hold ~60 fps, drop the backbuffer density first,
  // then render every other frame. Motion stays time-based, so it slows down never.
  let slow = 0, tier = 0, skip = false;
  const degrade = () => {
    tier++;
    if (tier === 1) { renderer.setPixelRatio(1); w = h = 0; resize(); }
    canvas.dataset.heroQuality = String(tier);
  };
  const frame = (now: number) => {
    raf = 0;
    if (disposed || !active || document.hidden) return;
    const raw = last ? now - last : 16.7;
    const dt = Math.min(raw / 1000, 0.05);
    last = now; clock += dt;
    if (!reduced && tier < 2 && clock > 1) {
      slow = raw > 24 ? slow + 1 : Math.max(0, slow - 2);
      if (slow > 30) { slow = 0; degrade(); }
    }
    skip = tier >= 2 ? !skip : false;
    if (!skip) { pose(reduced ? 4 : clock, dt); draw(); }
    if (!reduced || logoSpin > 0) raf = requestAnimationFrame(frame);
  };
  const start = () => { if (!raf && !disposed && active && !document.hidden && firstFrame) { last = 0; raf = requestAnimationFrame(frame); } };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };
  const onVis = () => (document.hidden || !active ? stop() : start());

  // ── Interacción: parallax suave; tocar el símbolo lo hace girar ──
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pick = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObject(logo, true)[0]?.object ?? null;
  };
  const onMove = (e: PointerEvent) => {
    if (reduced || e.pointerType === 'touch') return;
    mouse.tx = (e.clientX / innerWidth) * 2 - 1; mouse.ty = (e.clientY / innerHeight) * 2 - 1;
  };
  const onCanvasMove = (e: PointerEvent) => { if (e.pointerType !== 'touch') canvas.style.cursor = pick(e) ? 'pointer' : ''; };
  const onDown = (e: PointerEvent) => { if (!reduced && pick(e)) { logoSpin = 1; start(); } };
  addEventListener('pointermove', onMove, { passive: true });
  canvas.addEventListener('pointermove', onCanvasMove, { passive: true });
  canvas.addEventListener('pointerdown', onDown, { passive: true });
  document.addEventListener('visibilitychange', onVis);

  // ── Tamaño ──
  let w = 0, h = 0;
  const resize = () => {
    const r = canvas.parentElement!.getBoundingClientRect();
    if (r.width === w && r.height === h) return;
    w = r.width; h = r.height;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1);
    // Encaja las órbitas (≈12.4 × 11 unidades) en el lienzo, sea horizontal o vertical.
    const tan = 2 * Math.tan((camera.fov * Math.PI) / 360);
    camera.position.z = Math.max(11.2 / tan, 12.6 / (tan * camera.aspect));
    camera.updateProjectionMatrix();
    if (!raf && firstFrame && !disposed) draw();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas.parentElement!);
  resize();

  // Compile every program before the first visible frame (async where the driver allows),
  // so the page never stalls when the scene appears.
  pose(reduced ? 4 : 0, 0);
  const compileAsync = (renderer as unknown as { compileAsync?: (s: THREE.Object3D, c: THREE.Camera) => Promise<unknown> }).compileAsync;
  const compiled = compileAsync ? compileAsync.call(renderer, scene, camera) : Promise.resolve().then(() => renderer.compile(scene, camera));
  const ready = compiled.catch(() => undefined).then(() => {
    if (disposed) return;
    draw();
    start();
  });

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    stop(); ro.disconnect();
    removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointermove', onCanvasMove);
    canvas.removeEventListener('pointerdown', onDown);
    document.removeEventListener('visibilitychange', onVis);
    for (const d of disposables) d.dispose();
    renderer.dispose();
  };
  if (opts.signal?.aborted) dispose();
  else opts.signal?.addEventListener('abort', dispose, { once: true });
  return {
    ready,
    setActive(on) { active = on; if (reduced) { if (on && firstFrame && !disposed) draw(); return; } onVis(); },
    dispose,
  };
}
