import { useEffect, useRef } from 'react';
import { ambientAllowed, ambientBufferSize, ambientCanRun } from './ambient-policy.ts';
import { readEffectsEnabled, subscribeEffects, useEffectsEnabled } from './effects.ts';
import './ambient-field.css';

// Original pigment field: two soft woven bands in red/gold, not a particle system.
// One buffer, one fullscreen triangle, no textures, postprocessing or external code.
const VERTEX = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * .5 + .5;
  gl_Position = vec4(aPosition, 0., 1.);
}`;
const FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
uniform vec2 uResolution;
uniform vec2 uPointer;
uniform float uTime;
float hash(vec2 p) {
  // Bound intermediates for real mobile mediump (not just desktop emulation).
  p = fract(mod(p, 16.) * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x),
             mix(hash(i + vec2(0., 1.)), hash(i + vec2(1.)), f.x), f.y);
}
void main() {
  vec2 uv = vUv + uPointer * .018;
  float aspect = uResolution.x / max(1., uResolution.y);
  vec2 grainUv = uv * vec2(max(1., aspect), 1.);
  float t = uTime * .085;
  // Domain-warped silk: two noise octaves bend the ribbons so they flow, never slide.
  vec2 warp = vec2(noise(grainUv * 1.7 + vec2(t * .31, -t * .17)), noise(grainUv * 1.9 - vec2(t * .21, t * .26))) - .5;
  float weave = noise(grainUv * 2.8 + warp * 1.4 + vec2(t * .25, -t * .14));
  weave += noise(grainUv * 5.3 - warp - vec2(t * .13, t * .08)) * .26;
  float curve = .50 + sin(uv.x * 3.1 + t * .55) * .16 + (weave - .63) * .2 + warp.y * .08;
  float redDistance = (uv.y - curve) / .23;
  float redBand = exp(-redDistance * redDistance);
  redBand *= smoothstep(.06, .95, uv.x) * .46;
  // A brighter core thread rides inside the red ribbon.
  float threadDistance = (uv.y - curve - .012 * sin(uv.x * 9. + t * 1.3)) / .018;
  float thread = exp(-threadDistance * threadDistance) * smoothstep(.2, .9, uv.x) * .22;
  float goldCurve = .82 - uv.x * .20 + sin(uv.x * 2.8 - t * .36) * .07 + warp.x * .05;
  float goldDistance = (uv.y - goldCurve + weave * .04) / .085;
  float goldBand = exp(-goldDistance * goldDistance);
  goldBand *= smoothstep(.36, 1., uv.x) * .2;
  // Deep crimson pool on the left keeps the composition balanced around the headline.
  vec2 poolOffset = (uv - vec2(.08 + .03 * sin(t * .4), .2 + .04 * cos(t * .33))) * vec2(aspect, 1.);
  float pool = exp(-dot(poolOffset, poolOffset) / .09) * .26;
  // Slow diagonal light sweep, once every ~12 s, low amplitude (no flash).
  float sweepDistance = (uv.x * .8 + uv.y * .6 - fract(uTime * .083) * 2.2 + .4) / .12;
  float sweep = exp(-sweepDistance * sweepDistance) * .07;
  // Warm light follows a fine pointer (uPointer is 0 for touch / reduced motion).
  vec2 lampOffset = (uv - (uPointer * .5 + .5)) * vec2(aspect, 1.);
  float lamp = exp(-dot(lampOffset, lampOffset) / .05) * .1 * min(1., length(uPointer) * 4.);
  float veil = smoothstep(.02, .35, uv.y) * (1. - smoothstep(.90, 1.5, uv.y));
  vec3 ink = vec3(.027, .026, .024);
  vec3 pigment = vec3(.32, .026, .019) * redBand + vec3(.62, .09, .05) * thread + vec3(.43, .28, .065) * goldBand
    + vec3(.2, .018, .014) * pool + vec3(.45, .32, .14) * (sweep * (redBand + goldBand + .25)) + vec3(.4, .2, .07) * lamp;
  // Stable, low-amplitude dither prevents large low-res gradients from banding.
  float grain = (hash(gl_FragCoord.xy) - .5) / 255.;
  gl_FragColor = vec4(ink + pigment * veil + grain, 1.);
}`;

type Graphics = {
  resize: () => void;
  draw: (time: number, pointer: { x: number; y: number }) => void;
  release: () => void;
};
function createGraphics(canvas: HTMLCanvasElement): Graphics {
  const gl = canvas.getContext('webgl', {
    alpha: true, antialias: false, depth: false, stencil: false,
    preserveDrawingBuffer: false, powerPreference: 'low-power',
  });
  if (!gl || gl.isContextLost()) throw new Error('Ambient WebGL unavailable');
  const shaders: WebGLShader[] = [];
  let program: WebGLProgram | null = null;
  let buffer: WebGLBuffer | null = null;
  const release = () => {
    if (buffer) { gl.deleteBuffer(buffer); buffer = null; }
    if (program) { gl.deleteProgram(program); program = null; }
    shaders.splice(0).forEach((shader) => gl.deleteShader(shader));
    // Delete owned resources and shrink the backbuffer. Do not deliberately lose a
    // live context: React StrictMode can reuse the same canvas for effect replay.
    if (!gl.isContextLost()) { canvas.width = 1; canvas.height = 1; }
  };
  try {
    const compile = (kind: number, source: string) => {
      const shader = gl.createShader(kind);
      if (!shader) throw new Error('Ambient shader unavailable');
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Ambient shader compilation failed');
      return shader;
    };
    program = gl.createProgram();
    if (!program) throw new Error('Ambient program unavailable');
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Ambient program linking failed');
    gl.useProgram(program);
    // Linked programs retain compiled code; the shader objects are no longer owned.
    shaders.splice(0).forEach((shader) => { gl.detachShader(program!, shader); gl.deleteShader(shader); });
    buffer = gl.createBuffer();
    if (!buffer) throw new Error('Ambient buffer unavailable');
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    const resolution = gl.getUniformLocation(program, 'uResolution');
    const time = gl.getUniformLocation(program, 'uTime');
    const pointer = gl.getUniformLocation(program, 'uPointer');
    const resize = () => {
      const size = ambientBufferSize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio);
      if (canvas.width !== size.width || canvas.height !== size.height) {
        canvas.width = size.width; canvas.height = size.height;
      }
      gl.viewport(0, 0, size.width, size.height);
      gl.uniform2f(resolution, size.width, size.height);
    };
    resize();
    return {
      resize, release,
      draw: (seconds, point) => {
        gl.uniform1f(time, seconds);
        gl.uniform2f(pointer, point.x, point.y);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
    };
  } catch (error) { release(); throw error; }
}

/** Homepage-only, opt-out decorative atmosphere. Every pause gate cancels RAF. */
export function AmbientField({ path, search }: { path: string; search?: string }) {
  const enabled = useEffectsEnabled();
  const field = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const currentSearch = search ?? (typeof window === 'undefined' ? '' : window.location.search);
  const eligible = ambientAllowed(path, currentSearch);

  useEffect(() => {
    const root = field.current;
    const surface = canvas.current;
    if (!root) return;
    root.dataset.ambientStatus = 'still';
    if (!eligible || !enabled || !surface) return;

    let graphics: Graphics | undefined;
    let disposed = false;
    let contextLost = false;
    let inViewport = false;
    let routePath = path, routeSearch = currentSearch;
    let raf = 0;
    let last = 0, elapsed = 0;
    let pointing = false;
    let hero: Element | null = null;
    let observer: IntersectionObserver | undefined;
    let discovery: MutationObserver | undefined;
    const point = { x: 0, y: 0 }, target = { x: 0, y: 0 };
    const disposers: Array<() => void> = [];
    // The opaque preloader/intro covers the field: drawing under it only steals frames.
    // Once uncovered, hold the painted still for a moment: the headline entrance goes first.
    let releaseAt = 0, handoffTimer = 0;
    const coveredNow = () => document.documentElement.classList.contains('dt-booting') || document.documentElement.classList.contains('dt-intro-lock');
    const covered = () => {
      if (coveredNow()) { releaseAt = -1; return true; }
      if (releaseAt === -1) {
        releaseAt = performance.now() + 700;
        handoffTimer = window.setTimeout(() => { handoffTimer = 0; reconcile(); }, 720);
      }
      return releaseAt > 0 && performance.now() < releaseAt;
    };
    const canRun = () => !disposed && ambientCanRun({
      eligible: ambientAllowed(routePath, routeSearch), effects: readEffectsEnabled(),
      visible: !document.hidden && !covered(), inViewport, contextLost,
    });
    const pointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      target.x = (event.clientX / Math.max(1, window.innerWidth) - .5) * 2;
      target.y = (.5 - event.clientY / Math.max(1, window.innerHeight)) * 2;
    };
    let fine: MediaQueryList | undefined;
    try { fine = window.matchMedia('(hover: hover) and (pointer: fine)'); } catch { /* static pointer */ }
    const syncPointer = (active: boolean) => {
      const wanted = active && !!fine?.matches && window.innerWidth >= 900;
      if (wanted === pointing) return;
      pointing = wanted;
      if (pointing) window.addEventListener('pointermove', pointerMove, { passive: true });
      else { window.removeEventListener('pointermove', pointerMove); target.x = 0; target.y = 0; }
    };
    const pause = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0; last = 0;
      syncPointer(false);
      if (!disposed && !contextLost) root.dataset.ambientStatus = 'still';
    };
    const teardown = () => {
      if (disposed) return;
      pause();
      disposed = true;
      observer?.disconnect();
      discovery?.disconnect();
      disposers.splice(0).forEach((dispose) => dispose());
      graphics?.release();
      graphics = undefined;
    };
    const fallback = () => {
      contextLost = true;
      root.dataset.ambientStatus = 'fallback';
      root.dataset.ambientPainted = 'false';
      teardown();
    };
    const frame = (now: number) => {
      raf = 0;
      if (!canRun()) { pause(); return; }
      if (!last || now - last >= 1000 / 30 - .5) {
        const delta = last ? Math.min(now - last, 66.67) : 0;
        elapsed += delta / 1000;
        last = now;
        point.x += (target.x - point.x) * .035;
        point.y += (target.y - point.y) * .035;
        try { graphics!.draw(elapsed, point); }
        catch { fallback(); return; }
        root.dataset.ambientFrames = String(Number(root.dataset.ambientFrames ?? 0) + 1);
        root.dataset.ambientPainted = 'true';
      }
      raf = requestAnimationFrame(frame);
    };
    const reconcile = () => {
      if (disposed) return;
      if (!canRun()) { pause(); return; }
      if (!graphics) {
        try { graphics = createGraphics(surface); }
        catch { fallback(); return; }
      }
      syncPointer(true);
      root.dataset.ambientStatus = 'running';
      if (!raf) raf = requestAnimationFrame(frame);
    };
    const onLost = (event: Event) => {
      // Remain on the static fallback, rather than cycling a broken GPU context.
      event.preventDefault();
      fallback();
    };
    const checkViewport = () => {
      if (hero && !observer) {
        const bounds = hero.getBoundingClientRect();
        inViewport = bounds.bottom > 0 && bounds.top < window.innerHeight && bounds.right > 0 && bounds.left < window.innerWidth;
      }
      reconcile();
    };
    const onResize = () => { graphics?.resize(); checkViewport(); };
    const onLocation = () => {
      routePath = window.location.pathname;
      routeSearch = window.location.search;
      reconcile();
    };
    const bindHero = () => {
      hero = document.querySelector('.dt-landing .dt-hero');
      if (!hero) return;
      discovery?.disconnect();
      if (typeof IntersectionObserver !== 'undefined') {
        observer = new IntersectionObserver((entries) => {
          inViewport = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio > 0);
          reconcile();
        }, { threshold: 0 });
        observer.observe(hero);
      } else checkViewport();
    };
    surface.addEventListener('webglcontextlost', onLost);
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('popstate', onLocation);
    document.addEventListener('visibilitychange', reconcile);
    // Passive fallback for older engines without IntersectionObserver; no scroll RAF.
    if (typeof IntersectionObserver === 'undefined') window.addEventListener('scroll', checkViewport, { passive: true });
    if (fine?.addEventListener) fine.addEventListener('change', reconcile);
    else fine?.addListener?.(reconcile);
    disposers.push(
      () => surface.removeEventListener('webglcontextlost', onLost),
      () => window.removeEventListener('resize', onResize),
      () => window.removeEventListener('popstate', onLocation),
      () => document.removeEventListener('visibilitychange', reconcile),
      () => window.removeEventListener('scroll', checkViewport),
      () => { if (fine?.removeEventListener) fine.removeEventListener('change', reconcile); else fine?.removeListener?.(reconcile); },
      subscribeEffects(reconcile),
      () => window.clearTimeout(handoffTimer),
    );
    // Compile and paint one frame behind the preloader, so the hand-off never compiles a shader.
    if (coveredNow()) {
      try {
        graphics = createGraphics(surface);
        graphics.draw(0, point);
        root.dataset.ambientPainted = 'true';
      } catch { fallback(); }
    }
    let classes: MutationObserver | undefined;
    if (typeof MutationObserver !== 'undefined') {
      classes = new MutationObserver(reconcile);
      classes.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      disposers.push(() => classes?.disconnect());
    }
    bindHero();
    if (!disposed && !hero && typeof MutationObserver !== 'undefined') {
      discovery = new MutationObserver(bindHero);
      discovery.observe(root.parentElement ?? document.body, { childList: true, subtree: true });
    }
    return teardown;
  }, [path, currentSearch, eligible, enabled]);

  if (!eligible) return null;
  return <div ref={field} className="dt-ambient-field" aria-hidden="true" data-ambient-status="still" data-ambient-frames="0">
    {enabled && <canvas ref={canvas} aria-hidden="true" />}
  </div>;
}
