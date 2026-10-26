/** Pure guardrails shared by the renderer and its focused tests. */
export function ambientAllowed(path: string, search = ''): boolean {
  return path === '/' && !new URLSearchParams(search).has('sala');
}

export function ambientCanRun(state: {
  eligible: boolean;
  effects: boolean;
  visible: boolean;
  inViewport: boolean;
  contextLost: boolean;
}): boolean {
  return state.eligible && state.effects && state.visible && state.inViewport && !state.contextLost;
}

/** Soft fields do not need a retina-sized buffer. Upper bound: 460,800 pixels. */
export function ambientBufferSize(width: number, height: number, dpr = 1) {
  const safe = (value: number) => Number.isFinite(value) && value > 0 ? value : 1;
  const w = safe(width), h = safe(height);
  const density = Math.min(safe(dpr), 1.25) * 0.48;
  const scale = Math.min(density, 960 / w, 640 / h, Math.sqrt(460800 / (w * h)));
  return { width: Math.max(1, Math.floor(w * scale)), height: Math.max(1, Math.floor(h * scale)) };
}
