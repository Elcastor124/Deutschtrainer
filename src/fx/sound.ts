// Sonidos sintetizados con WebAudio (sin archivos). Se pueden silenciar con M.
// Paleta sonora de «aparato»: clics de tecla, pitidos cuadrados, golpes graves y ruido filtrado.
let ac: AudioContext | null = null;
let out: AudioNode | null = null;
let enabled = false;
export const setSound = (v: boolean) => { enabled = v; };

function ctx(): AudioContext | null {
  if (!enabled) return null;
  try {
    if (!ac) {
      ac = new AudioContext();
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 6;
      const master = ac.createGain();
      master.gain.value = 0.9;
      comp.connect(master).connect(ac.destination);
      out = comp;
    }
    if (ac.state === 'suspended') void ac.resume();
    return ac;
  } catch { return null; }
}

function tone(freq: number, dur: number, type: OscillatorType = 'square', gain = 0.06, at = 0, slide?: number, attack = 0.004) {
  const c = ctx();
  if (!c || !out) return;
  const t = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.03);
}

function noise(dur: number, gain = 0.05, at = 0, filter: BiquadFilterType = 'highpass', f0 = 900, f1?: number, q = 0.7) {
  const c = ctx();
  if (!c || !out) return;
  const t = c.currentTime + at;
  const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = c.createBufferSource();
  const g = c.createGain();
  const f = c.createBiquadFilter();
  f.type = filter;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.buffer = buf;
  s.connect(f).connect(g).connect(out);
  s.start(t);
}

/** Golpe grave (bombo sintético). */
function thump(at = 0, gain = 0.25, from = 140, to = 42, dur = 0.28) { tone(from, dur, 'sine', gain, at, to, 0.002); }

export const sfx = {
  /** Clic de tecla física. */
  key: () => { noise(0.025, 0.05, 0, 'bandpass', 3200, undefined, 2); tone(1800, 0.02, 'square', 0.015); },
  /** Respuesta bloqueada. */
  lock: () => { tone(980, 0.05, 'square', 0.04); tone(660, 0.09, 'square', 0.04, 0.05); noise(0.03, 0.04, 0, 'bandpass', 2500, undefined, 3); },
  tick: (urgency = 0) => tone(1100 + urgency * 140, 0.045, 'square', 0.03),
  good: () => {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'square', 0.045, i * 0.065));
    tone(2093, 0.25, 'triangle', 0.025, 0.26);
  },
  bad: () => { tone(196, 0.32, 'sawtooth', 0.05, 0, 98); tone(207, 0.32, 'sawtooth', 0.04, 0, 103); noise(0.15, 0.04, 0, 'lowpass', 600); },
  item: () => { tone(440, 0.08, 'triangle', 0.07); tone(880, 0.12, 'triangle', 0.06, 0.07); tone(1320, 0.16, 'triangle', 0.05, 0.14); },
  whoosh: () => noise(0.45, 0.07, 0, 'bandpass', 300, 3200, 1.2),
  slam: () => { thump(0, 0.3); noise(0.18, 0.08, 0, 'lowpass', 2400, 300); },
  alarm: () => { tone(520, 0.12, 'square', 0.06); tone(520, 0.12, 'square', 0.06, 0.18); tone(780, 0.16, 'square', 0.05, 0.36); },
  steal: () => { tone(1600, 0.35, 'square', 0.04, 0, 180); noise(0.3, 0.03, 0.05, 'bandpass', 1800, 400, 4); },
  shield: () => { [440, 660, 880].forEach((f) => tone(f, 0.6, 'triangle', 0.035, 0, f * 1.01)); noise(0.4, 0.02, 0, 'highpass', 4000); },
  double: () => { [784, 1175, 1568].forEach((f, i) => tone(f, 0.12, 'square', 0.04, i * 0.06)); [784, 1175, 1568].forEach((f, i) => tone(f * 2, 0.1, 'triangle', 0.02, 0.2 + i * 0.05)); },
  glitch: () => { for (let i = 0; i < 9; i++) tone(200 + Math.random() * 1800, 0.03, 'square', 0.035, i * 0.035); },
  rewind: () => { tone(1800, 0.5, 'sawtooth', 0.025, 0, 120); noise(0.5, 0.03, 0, 'bandpass', 3000, 400, 2); },
  shuffle: () => { for (let i = 0; i < 6; i++) noise(0.05, 0.05, i * 0.07, 'bandpass', 2000 + i * 300, undefined, 3); },
  bc: () => { tone(55, 1.4, 'sawtooth', 0.08, 0, 40); tone(110, 1.2, 'square', 0.03, 0.1, 82); thump(0, 0.3, 90, 30, 0.6); },
  burn: () => { noise(2.2, 0.08, 0, 'lowpass', 1200, 300); noise(1.8, 0.03, 0.2, 'highpass', 5000); },
  heartbeat: () => { thump(0, 0.22, 90, 40, 0.18); thump(0.2, 0.16, 80, 38, 0.16); },
  next: () => { tone(880, 0.05, 'square', 0.035); tone(1320, 0.05, 'square', 0.025, 0.05); },
  /** Golpe al cofre (n = 0, 1, 2…): cada vez más agudo. */
  chestTap: (n: number) => { thump(0, 0.18, 160 + n * 30, 60); noise(0.08, 0.06, 0, 'bandpass', 1400 + n * 500, undefined, 2); tone(300 + n * 120, 0.07, 'square', 0.03); },
  chestOpen: (tier: string) => {
    thump(0, 0.3, 120, 40, 0.4);
    noise(0.6, 0.06, 0, 'highpass', 2000, 8000);
    const base = tier === 'gold' ? 784 : tier === 'silver' ? 659 : tier === 'black' ? 220 : 523;
    [1, 1.25, 1.5, 2, 2.5].forEach((m, i) => tone(base * m, 0.22, tier === 'black' ? 'sawtooth' : 'square', 0.04, 0.12 + i * 0.07));
  },
  coin: () => { tone(1568, 0.05, 'square', 0.035); tone(2093, 0.12, 'square', 0.03, 0.05); },
  star: () => { tone(1319, 0.08, 'triangle', 0.04); tone(1976, 0.18, 'triangle', 0.035, 0.07); },
  pull: () => { noise(0.22, 0.07, 0, 'bandpass', 900, 300, 2); tone(140, 0.12, 'triangle', 0.05, 0.05, 90); },
  fall: () => { for (let i = 0; i < 10; i++) { thump(i * 0.07, 0.16, 120 - i * 6, 40, 0.2); noise(0.12, 0.05, i * 0.07, 'bandpass', 600 + Math.random() * 900, undefined, 2); } },
  fanfare: () => {
    const seq = [523, 523, 523, 659, 784, 659, 784, 1047];
    seq.forEach((f, i) => tone(f, i === seq.length - 1 ? 0.6 : 0.14, 'square', 0.045, i * 0.13));
    thump(0, 0.2); thump(0.91, 0.25);
  },
  type: () => noise(0.015, 0.025, 0, 'bandpass', 4200, undefined, 3),
};
