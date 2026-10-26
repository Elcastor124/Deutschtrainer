import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { playBlackCard } from '../src/fx/blackcard3d.ts';

// Real scene/resources; only the GPU and browser scheduling boundary are fake.
const gpu = vi.hoisted(() => ({ created: 0, draws: 0, disposed: 0, lost: 0, removed: 0 }));
vi.mock('three', async (original) => ({
  ...await original<typeof import('three')>(),
  WebGLRenderer: class {
    domElement = { remove: () => { gpu.removed++; } };
    constructor() { gpu.created++; }
    setPixelRatio() {}
    setSize() {}
    getDrawingBufferSize(target: { set: (x: number, y: number) => unknown }) { return target.set(800, 600); }
    render() { gpu.draws++; }
    dispose() { gpu.disposed++; }
    forceContextLoss() { gpu.lost++; }
  },
}));

let pending: Map<number, FrameRequestCallback>;
let nextId: number;
let listeners: Set<EventListenerOrEventListenerObject>;
const canvas = () => ({ getContext: () => new Proxy({}, {
  get: (_target, name) => name === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {},
  set: () => true,
}) });
const host = { clientWidth: 800, clientHeight: 600, appendChild: vi.fn() } as unknown as HTMLElement;

beforeEach(() => {
  Object.assign(gpu, { created: 0, draws: 0, disposed: 0, lost: 0, removed: 0 });
  pending = new Map(); nextId = 0; listeners = new Set();
  vi.stubGlobal('devicePixelRatio', 1);
  vi.stubGlobal('requestAnimationFrame', (frame: FrameRequestCallback) => { pending.set(++nextId, frame); return nextId; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => pending.delete(id));
  vi.stubGlobal('addEventListener', (name: string, listener: EventListenerOrEventListenerObject) => { if (name === 'resize') listeners.add(listener); });
  vi.stubGlobal('removeEventListener', (name: string, listener: EventListenerOrEventListenerObject) => { if (name === 'resize') listeners.delete(listener); });
  vi.stubGlobal('document', { fonts: { load: () => Promise.resolve([]) }, createElement: canvas });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('BlackCard abort contract', () => {
  it('does not start font loads or allocate anything for an already aborted signal', async () => {
    const fonts = vi.spyOn(document.fonts, 'load');
    const controller = new AbortController(); controller.abort();
    await playBlackCard(host, { mode: 'activate', signal: controller.signal });
    expect(fonts).not.toHaveBeenCalled();
    expect(gpu.created).toBe(0);
    expect(pending.size).toBe(0);
  });

  it('settles abort while fonts are unresolved, without creating late resources', async () => {
    let releaseFonts!: () => void;
    const fonts = new Promise<void>((resolve) => { releaseFonts = resolve; });
    document.fonts.load = vi.fn(() => fonts) as unknown as FontFaceSet['load'];
    const controller = new AbortController();
    let settled = false;
    const options = { mode: 'burn' as const, signal: controller.signal };
    const done = playBlackCard(host, options).then(() => { settled = true; });
    controller.abort();
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(settled, 'abort must not wait for a stalled font/network request').toBe(true);
    releaseFonts();
    await done;
    expect(gpu.created).toBe(0);
    expect(pending.size).toBe(0);
    expect(listeners.size).toBe(0);
  });

  it('cancels active RAF and releases every shared resource/context once', async () => {
    const resources = new Map<object, number>();
    for (const prototype of [THREE.BufferGeometry.prototype, THREE.Material.prototype, THREE.Texture.prototype]) {
      vi.spyOn(prototype, 'dispose').mockImplementation(function (this: object) {
        resources.set(this, (resources.get(this) ?? 0) + 1);
      });
    }
    const controller = new AbortController();
    const options = { mode: 'activate' as const, signal: controller.signal };
    const done = playBlackCard(host, options);
    await vi.waitFor(() => expect(pending.size).toBe(1));
    const [id, frame] = [...pending][0]; pending.delete(id); frame(performance.now() + 16);
    expect(gpu.draws).toBe(1);
    controller.abort(); controller.abort();
    expect(pending.size, 'abort must synchronously cancel the queued frame').toBe(0);
    expect(gpu.disposed).toBe(1);
    expect(gpu.lost).toBe(1);
    expect(gpu.removed).toBe(1);
    expect(listeners.size).toBe(0);
    expect(resources.size).toBe(10); // 3 geometries + 4 materials + 3 textures.
    expect([...resources.values()]).toEqual(Array(10).fill(1));
    // An already dequeued browser callback must also remain inert after abort.
    frame(performance.now() + 32);
    expect(gpu.draws).toBe(1);
    await done;
    expect(gpu.disposed).toBe(1);
  });

  it('releases partial setup before propagating a real canvas failure', async () => {
    const textureDispose = vi.spyOn(THREE.Texture.prototype, 'dispose');
    vi.spyOn(document, 'createElement').mockImplementation(() => { throw new Error('canvas unavailable'); });
    await expect(playBlackCard(host, { mode: 'activate' })).rejects.toThrow('canvas unavailable');
    expect(textureDispose).toHaveBeenCalledTimes(1); // Already-owned burn field.
    expect(gpu.disposed).toBe(1);
    expect(gpu.lost).toBe(1);
    expect(gpu.removed).toBe(1);
    expect(pending.size).toBe(0);
    expect(listeners.size).toBe(0);
  });

  it('keeps the enabled cinematic and releases it once on normal completion', async () => {
    const done = playBlackCard(host, { mode: 'activate' });
    await vi.waitFor(() => expect(pending.size).toBe(1));
    const [id, frame] = [...pending][0]; pending.delete(id); frame(performance.now() + 2600);
    await done;
    expect(gpu.draws).toBe(1);
    expect(gpu.disposed).toBe(1);
    expect(gpu.lost).toBe(1);
    expect(gpu.removed).toBe(1);
    expect(pending.size).toBe(0);
    expect(listeners.size).toBe(0);
  });
});
