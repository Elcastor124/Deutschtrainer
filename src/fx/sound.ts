// Sonidos sintetizados con WebAudio (sin archivos). Se pueden silenciar con M.
let ac: AudioContext | null = null;
let enabled = false;
export const setSound = (v: boolean) => { enabled = v; };

function ctx(): AudioContext | null {
  if (!enabled) return null;
  try {
    ac ??= new AudioContext();
    if (ac.state === 'suspended') void ac.resume();
    return ac;
  } catch { return null; }
}

function tone(freq: number, dur: number, type: OscillatorType = 'square', gain = 0.06, at = 0, slide?: number) {
  const c = ctx();
  if (!c) return;
  const t = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, gain = 0.05) {
  const c = ctx();
  if (!c) return;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) * (Math.random() < 0.08 ? 1 : 0.35);
  const s = c.createBufferSource();
  const g = c.createGain();
  const f = c.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 900;
  g.gain.value = gain;
  s.buffer = buf;
  s.connect(f).connect(g).connect(c.destination);
  s.start();
}

export const sfx = {
  tick: () => tone(1200, 0.05, 'square', 0.03),
  good: () => { tone(660, 0.09, 'square', 0.05); tone(990, 0.14, 'square', 0.05, 0.08); },
  bad: () => tone(180, 0.25, 'sawtooth', 0.05, 0, 110),
  item: () => { tone(440, 0.08, 'triangle', 0.07); tone(880, 0.12, 'triangle', 0.06, 0.07); tone(1320, 0.16, 'triangle', 0.05, 0.14); },
  alarm: () => { tone(520, 0.12, 'square', 0.06); tone(520, 0.12, 'square', 0.06, 0.18); },
  bc: () => { tone(55, 1.4, 'sawtooth', 0.08, 0, 40); tone(110, 1.2, 'square', 0.03, 0.1, 82); },
  burn: () => noise(2.2, 0.08),
  next: () => tone(880, 0.06, 'square', 0.04),
};
