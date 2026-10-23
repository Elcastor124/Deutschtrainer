import { useEffect, useId, useRef, type CSSProperties } from 'react';
import type { BoxingFighter, BoxingMove, BoxingResolution } from '../../shared/boxing.ts';

export type AnimationMove = BoxingMove | 'recover' | 'idle' | 'victory' | 'down' | 'slump';
type Point = [number, number];
export interface BoxingPose { frontHand: Point; backHand: Point; frontElbow: Point; backElbow: Point; lean: number; x: number; y: number; twist: number; headTilt: number; gloveTurn: number }

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeInOut = (t: number) => t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
const easeOutBack = (t: number) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2;
/** Anticipation (pull back) → explosive strike with slight overshoot → hold on contact → follow-through back to guard. */
export function strikeCurve(progress: number) {
  const p = clamp01(progress);
  if (p < .2) return -.22 * easeOut(p / .2);
  if (p < .36) return -.22 + 1.22 * easeOutBack((p - .2) / .16);
  if (p < .56) return 1;
  return 1 - easeInOut((p - .56) / .44);
}
/** Defensive moves rise quickly, hold through the impact window and settle back. */
export function defenseCurve(progress: number) {
  const p = clamp01(progress);
  if (p < .22) return easeOut(p / .22);
  if (p < .7) return 1;
  return 1 - easeInOut((p - .7) / .3);
}

export function boxingPose(move: AnimationMove, progress: number, time: number): BoxingPose {
  const breath = Math.sin(time * .004) * 2;
  const bounce = time ? -Math.abs(Math.sin(time * .0045)) * 4 : 0;
  const pose: BoxingPose = { frontHand: [50, -140 + breath], backHand: [16, -146 + breath], frontElbow: [36, -100], backElbow: [-14, -102], lean: 0, x: 0, y: bounce, twist: 0, headTilt: 0, gloveTurn: -9 };
  const k = strikeCurve(progress);
  const d = defenseCurve(progress);
  if (move === 'jab') { pose.frontHand = [50 + 150 * k, -140 - 6 * k]; pose.frontElbow = [36 + 82 * k, -100 - 40 * k]; pose.x = 24 * k; pose.twist = 5 * k; pose.y = bounce * (1 - Math.abs(k)); }
  if (move === 'cross') { pose.backHand = [16 + 192 * k, -146 + 3 * k]; pose.backElbow = [-14 + 124 * k, -102 - 40 * k]; pose.frontHand = [50 - 14 * Math.max(0, k), -146]; pose.twist = 11 * k; pose.x = 28 * k; pose.y = bounce * (1 - Math.abs(k)); }
  if (move === 'hook') {
    const arc = Math.sin(Math.PI * clamp01(k));
    pose.frontHand = [50 + 150 * k, -140 - 14 * k - 24 * arc]; pose.frontElbow = [36 + 76 * k, -100 - 74 * k]; pose.twist = 17 * k; pose.x = 34 * k; pose.gloveTurn = -9 - 32 * k; pose.y = bounce * (1 - Math.abs(k));
  }
  if (move === 'guard') { pose.frontHand = [50 - 18 * d, -140 - 24 * d]; pose.backHand = [16 + 20 * d, -146 - 18 * d]; pose.frontElbow = [36 - 6 * d, -104]; pose.backElbow = [-14 + 14 * d, -106]; pose.y += 6 * d; pose.lean = 5 * d; pose.headTilt = 8 * d; }
  if (move === 'dodge') { pose.lean = -30 * d; pose.x = -26 * d; pose.y += 20 * d; pose.headTilt = -6 * d; }
  if (move === 'recover') { pose.frontHand = [44, -110 + breath * 2]; pose.backHand = [8, -114 + breath * 2]; pose.frontHand[1] += 6 * d; pose.lean = -4 - 3 * d; pose.headTilt = -6 * d; pose.y += 4 * d; }
  if (move === 'victory') {
    const lift = easeOut(clamp01(progress));
    const hop = time ? -Math.abs(Math.sin(time * .006)) * 10 * lift : 0;
    pose.frontHand = [50 - 22 * lift, -140 - 92 * lift]; pose.backHand = [16 - 22 * lift, -146 - 86 * lift]; pose.frontElbow = [36 + 6 * lift, -100 - 70 * lift]; pose.backElbow = [-14 - 8 * lift, -102 - 64 * lift];
    pose.y = hop; pose.lean = -6 * lift; pose.headTilt = -12 * lift; pose.gloveTurn = -9 - 70 * lift;
  }
  if (move === 'down') {
    const fall = easeInOut(clamp01(progress));
    pose.y = 56 * fall; pose.x = -34 * fall; pose.lean = -34 * fall; pose.headTilt = -22 * fall;
    pose.frontHand = [50 - 4 * fall, -140 + 70 * fall]; pose.backHand = [16 - 10 * fall, -146 + 74 * fall]; pose.frontElbow = [36, -100 + 30 * fall]; pose.backElbow = [-14, -102 + 30 * fall];
  }
  if (move === 'slump') {
    const s = easeOut(clamp01(progress));
    pose.y = 8 * s; pose.lean = 12 * s; pose.headTilt = 16 * s;
    pose.frontHand = [48, -140 + 46 * s]; pose.backHand = [14, -146 + 44 * s]; pose.frontElbow = [34, -100 + 14 * s]; pose.backElbow = [-14, -102 + 14 * s];
  }
  return pose;
}

export function resolutionKey(result?: BoxingResolution) {
  return result ? `${result.exchange}:${result.fighters.map((fighter) => `${fighter.id}:${fighter.move}:${fighter.damageDealt}:${fighter.damageTaken}`).join('|')}` : '';
}
const labels: Record<AnimationMove, string> = { idle: 'En guardia', recover: 'Recupera energía', jab: 'Jab', cross: 'Directo', hook: 'Crochet', guard: 'Defensa', dodge: 'Esquiva', victory: 'Victoria', down: 'K.O.', slump: 'Agotado' };

/** Geometry shared by the first server/static render and every animation frame. */
function geometry(pose: BoxingPose, step: number) {
  const hipB: Point = [-8 + pose.x, -66 + pose.y], hipF: Point = [18 + pose.x, -66 + pose.y];
  const footB: Point = [-46 + step, -9], footF: Point = [56 - step, -9];
  const bend = 9 + Math.max(0, pose.y) * .55;
  const knee = (hip: Point, foot: Point): Point => [(hip[0] + foot[0]) / 2 + bend, (hip[1] + foot[1]) / 2 - 2];
  const kB = knee(hipB, footB), kF = knee(hipF, footF);
  return {
    backLeg: `M${hipB.join(' ')} L${kB.join(' ')} L${footB.join(' ')}`,
    frontLeg: `M${hipF.join(' ')} L${kF.join(' ')} L${footF.join(' ')}`,
    backShoe: `translate(${footB.join(' ')})`, frontShoe: `translate(${footF.join(' ')})`,
    upper: `translate(${pose.x} ${pose.y})`,
    torso: `rotate(${pose.lean + pose.twist} 4 -66)`,
    head: `rotate(${pose.headTilt} 18 -146)`,
    frontArm: `M24 -122 Q${pose.frontElbow.join(' ')} ${pose.frontHand.join(' ')}`,
    backArm: `M-12 -124 Q${pose.backElbow.join(' ')} ${pose.backHand.join(' ')}`,
    frontGlove: `translate(${pose.frontHand.join(' ')}) rotate(${pose.gloveTurn})`,
    backGlove: `translate(${pose.backHand.join(' ')}) rotate(-14)`,
  };
}

let audio: AudioContext | undefined;
function impactSound(damage: boolean) {
  try {
    audio ??= new AudioContext();
    void audio.resume();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(damage ? 145 : 340, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(damage ? 48 : 220, audio.currentTime + .14);
    gain.gain.setValueAtTime(.055, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .18);
    oscillator.connect(gain); gain.connect(audio.destination);
    oscillator.start(); oscillator.stop(audio.currentTime + .2);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  } catch { /* El sonido nunca bloquea una partida. */ }
}

// Stage layout (viewBox 1000×500).
const FLOOR = 438, SCALE = 1.6, CORNER_X = [322, 678];
const HEAD_Y = FLOOR - 165 * SCALE;
const DMG_X = [CORNER_X[0] - 112, CORNER_X[1] + 112];
const OUTLINE = '#08090c';
const DURATION = 1750, IMPACT = 580;
const skins = [{ base: '#d9a07a', shade: '#a8714f' }, { base: '#a86d4b', shade: '#7c4b31' }];
function seeded(seed: number) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
const rand = seeded(7);
const crowd = Array.from({ length: 64 }, (_, i) => { const row = i % 3; return { x: (i * 157 + row * 40) % 1040 - 20, y: 214 + row * 26 + rand() * 6, r: 13 + row * 2 + rand() * 4, tone: ['#16171d', '#1b1c23', '#20212a'][row] }; });
const bokeh = Array.from({ length: 26 }, () => ({ x: rand() * 1000, y: 30 + rand() * 170, r: 2 + rand() * 7, delay: -rand() * 6, hue: rand() > .7 ? '#ffb27a' : rand() > .5 ? '#9fc8ff' : '#fff1d8' }));
const flashes = Array.from({ length: 7 }, (_, i) => ({ x: 60 + rand() * 880, y: 200 + rand() * 80, delay: i * 1.7 + rand() * 2 }));
const confetti = Array.from({ length: 46 }, (_, i) => ({ x: rand() * 100, delay: rand() * 1.6, dur: 2.6 + rand() * 2.2, rot: rand() * 720 - 360, color: ['#ff6a5c', '#8cc4e8', '#ffd36e', '#f4efe6', '#9be0b4'][i % 5], w: 6 + rand() * 6 }));

function Fighter({ index, id, pose }: { index: number; id: string; pose: BoxingPose }) {
  const g = geometry(pose, 0);
  const corner = index ? 'blue' : 'red';
  const skin = skins[index];
  const flip = index ? -1 : 1;
  const leg = (key: string, d: string, shade: boolean) => <g data-leg={key} fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} stroke={OUTLINE} strokeWidth="27" /><path d={d} stroke={shade ? skin.shade : skin.base} strokeWidth="21" /><path d={d} stroke="#fff" strokeOpacity=".16" strokeWidth="4" transform="translate(-4 0)" />
  </g>;
  const shoe = (key: string, transform: string) => <g data-shoe={key} transform={transform}>
    <path d="M-15 -14 L12 -14 Q30 -10 31 2 L31 8 L-16 8 Z" fill="#14161c" stroke={OUTLINE} strokeWidth="2.5" strokeLinejoin="round" />
    <path d="M-15 -8 L14 -8" stroke={`url(#${id}-${corner})`} strokeWidth="4" /><path d="M-16 5 L31 5" stroke="#e9e4da" strokeWidth="3" />
  </g>;
  const arm = (key: string, d: string, shade: boolean) => <g data-arm={key} fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} stroke={OUTLINE} strokeWidth="24" /><path d={d} stroke={shade ? skin.shade : skin.base} strokeWidth="18" /><path d={d} stroke="#fff" strokeOpacity=".2" strokeWidth="4" transform="translate(0 -4)" />
  </g>;
  const glove = (key: string, transform: string, back: boolean) => <g data-glove={key} transform={transform}>
    <rect x="-20" y="-11" width="16" height="24" rx="5" fill="#f1ece3" stroke={OUTLINE} strokeWidth="2.5" />
    <path d="M-14 -6 L-10 8" stroke="#bdb6ab" strokeWidth="2" />
    <ellipse cx="8" cy="0" rx={back ? 19 : 21} ry={back ? 17 : 19} fill={`url(#${id}-${corner}-glove)`} stroke={OUTLINE} strokeWidth="3" />
    <ellipse cx="-1" cy="11" rx="8" ry="6" fill={`url(#${id}-${corner}-glove)`} stroke={OUTLINE} strokeWidth="2.5" />
    <path d="M-2 -11 Q8 -18 20 -9" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="4" strokeLinecap="round" />
  </g>;
  return <g data-fighter={index} data-move="idle" className={`bx-fighter bx-fighter-${index}`} transform={`translate(${CORNER_X[index]} ${FLOOR}) scale(${flip * SCALE} ${SCALE})`}>
    <ellipse data-shadow="" cx="6" cy="0" rx="74" ry="11" fill="#000" opacity=".55" />
    <g data-body="">
      {[1, 2].map((ghost) => <use key={ghost} data-ghost={ghost} href={`#${id}-up${index}`} opacity="0" />)}
      {leg('back', g.backLeg, true)}{shoe('back', g.backShoe)}
      {leg('front', g.frontLeg, false)}{shoe('front', g.frontShoe)}
      <g data-upper="" id={`${id}-up${index}`} transform={g.upper}>
        <g data-hips="">
          <path d="M-28 -80 L34 -80 L42 -36 Q24 -32 13 -36 L6 -52 L-2 -36 Q-18 -32 -34 -38 Z" fill={`url(#${id}-${corner})`} stroke={OUTLINE} strokeWidth="3" strokeLinejoin="round" />
          <path d="M-28 -78 L34 -78" stroke="#f4efe6" strokeWidth="7" /><path d="M-28 -78 L34 -78" stroke={OUTLINE} strokeWidth="1" transform="translate(0 4)" opacity=".4" />
          <path d="M36 -70 L41 -38" stroke="#f4efe6" strokeWidth="4" opacity=".85" /><path d="M-30 -70 L-33 -40" stroke="#f4efe6" strokeWidth="3" opacity=".5" />
        </g>
        <g data-torso="" transform={g.torso}>
          {arm('back', g.backArm, true)}
          {glove('back', g.backGlove, true)}
          <path d="M-22 -132 Q-2 -148 30 -135 Q46 -118 34 -86 L30 -76 L-24 -76 L-30 -106 Z" fill={`url(#${id}-${corner}-vest)`} stroke={OUTLINE} strokeWidth="3" strokeLinejoin="round" />
          <path d="M-12 -128 Q4 -134 24 -128" fill="none" stroke="#fff" strokeOpacity=".22" strokeWidth="3" strokeLinecap="round" />
          <path d="M8 -118 Q18 -104 10 -88" fill="none" stroke="#000" strokeOpacity=".25" strokeWidth="3" strokeLinecap="round" />
          <path d="M-8 -114 L-4 -106 L4 -106 L-2 -100 L0 -92 L-8 -97 L-16 -92 L-14 -100 L-20 -106 L-12 -106 Z" fill="#f4efe6" fillOpacity=".75" />
          <g data-head="" transform={g.head}>
            <path d="M8 -150 L28 -150 L26 -130 L10 -130 Z" fill={skin.shade} stroke={OUTLINE} strokeWidth="2.5" />
            <ellipse cx="20" cy="-164" rx="20" ry="22" fill={`url(#${id}-skin${index})`} stroke={OUTLINE} strokeWidth="3" />
            <path d="M38 -166 Q44 -160 39 -156" fill={skin.base} stroke={OUTLINE} strokeWidth="2.5" strokeLinejoin="round" />
            <path d="M-2 -166 Q-2 -192 22 -191 Q42 -190 42 -172 L38 -170 Q30 -180 18 -179 Q8 -178 6 -164 L8 -148 Q-4 -150 -2 -166 Z" fill={`url(#${id}-${corner}-glove)`} stroke={OUTLINE} strokeWidth="3" strokeLinejoin="round" />
            <path d="M6 -186 Q20 -192 34 -184" fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth="3" strokeLinecap="round" />
            <path d="M28 -170 L36 -172" stroke={OUTLINE} strokeWidth="3" strokeLinecap="round" />
            <ellipse cx="32" cy="-165" rx="2.6" ry="3.2" fill={OUTLINE} />
            <path d="M26 -151 L38 -152" stroke="#f4efe6" strokeWidth="4" strokeLinecap="round" />
            <ellipse cx="12" cy="-162" rx="5" ry="7" fill={skin.shade} stroke={OUTLINE} strokeWidth="2" />
          </g>
          {arm('front', g.frontArm, false)}
          {glove('front', g.frontGlove, false)}
        </g>
      </g>
    </g>
  </g>;
}

function Effects({ index, id }: { index: number; id: string }) {
  const x = CORNER_X[index] + (index ? -1 : 1) * 18 * SCALE;
  const tone = index ? '#9fd0f2' : '#ff8a7f';
  return <g data-fx={index} pointerEvents="none">
    <g data-flash="" transform={`translate(${x} ${HEAD_Y})`} opacity="0">
      <circle r="34" fill={`url(#${id}-burst)`} />
      {Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6 + .2; const r2 = 54 + (i % 3) * 14; return <path key={i} d={`M${Math.cos(a) * 26} ${Math.sin(a) * 26} L${Math.cos(a) * r2} ${Math.sin(a) * r2}`} stroke={i % 2 ? '#fff6dc' : '#ffcf6a'} strokeWidth={i % 2 ? 3 : 5} strokeLinecap="round" />; })}
      <path d="M-14 -4 L-4 -8 L0 -20 L6 -8 L18 -6 L8 2 L12 16 L0 8 L-12 14 L-6 2 Z" fill="#fff" />
    </g>
    <g data-shield="" transform={`translate(${CORNER_X[index] + (index ? -1 : 1) * 68 * SCALE} ${HEAD_Y + 22})`} opacity="0">
      <ellipse rx="34" ry="62" fill="none" stroke="#bfe6ff" strokeWidth="6" />
      <ellipse rx="24" ry="48" fill="#8ccfff" fillOpacity=".18" stroke="#fff" strokeWidth="2" strokeOpacity=".8" />
    </g>
    <text data-damage="" x={DMG_X[index]} y={HEAD_Y + 6} textAnchor="middle" className="bx-svg-damage" fill="#fff" stroke={OUTLINE} strokeWidth="6" paintOrder="stroke" opacity="0">−0</text>
    <text data-callout="" x={CORNER_X[index] + (index ? 40 : -40)} y={FLOOR - 70} textAnchor="middle" className="bx-svg-callout" fill={tone} stroke={OUTLINE} strokeWidth="7" paintOrder="stroke" opacity="0"> </text>
  </g>;
}

export function BoxingRing({ fighters, result, paused = false, sound = false, round, phase, winner }: { fighters: BoxingFighter[]; result?: BoxingResolution; paused?: boolean; sound?: boolean; round?: number; phase?: string; winner?: string }) {
  const id = useId().replace(/:/g, '');
  const svgRef = useRef<SVGSVGElement>(null);
  const active = useRef<{ result: BoxingResolution; started: number } | null>(null);
  const seen = useRef(new Set<string>());
  const latest = useRef({ fighters, winner, paused });
  latest.current = { fighters, winner, paused };
  const eventKey = resolutionKey(result);
  useEffect(() => {
    if (!result) { active.current = null; seen.current.clear(); return; }
    if (!eventKey || seen.current.has(eventKey)) return;
    seen.current.add(eventKey);
    active.current = { result, started: performance.now() };
    if (sound) {
      const timer = setTimeout(() => impactSound(result.fighters.some((fighter) => fighter.damageTaken > 0)), 600);
      return () => clearTimeout(timer);
    }
    // Snapshot objects change on every poll; only a genuinely new exchange animates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventKey]);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    let reduced = media.matches;
    const change = () => { reduced = media.matches; };
    media.addEventListener('change', change);
    const q = <T extends Element>(root: Element, selector: string) => root.querySelector<T>(selector)!;
    const nodes = [0, 1].map((index) => {
      const group = q<SVGGElement>(svg, `[data-fighter="${index}"]`);
      const fx = q<SVGGElement>(svg, `[data-fx="${index}"]`);
      return {
        group, shadow: q(group, '[data-shadow]'), upper: q(group, '[data-upper]'), torso: q(group, '[data-torso]'), head: q(group, '[data-head]'),
        frontArm: [...group.querySelectorAll('[data-arm="front"] path')], backArm: [...group.querySelectorAll('[data-arm="back"] path')],
        frontLeg: [...group.querySelectorAll('[data-leg="front"] path')], backLeg: [...group.querySelectorAll('[data-leg="back"] path')],
        frontShoe: q(group, '[data-shoe="front"]'), backShoe: q(group, '[data-shoe="back"]'), frontGlove: q(group, '[data-glove="front"]'), backGlove: q(group, '[data-glove="back"]'),
        ghosts: [...group.querySelectorAll('[data-ghost]')],
        flash: q(fx, '[data-flash]'), shield: q(fx, '[data-shield]'), damage: q<SVGTextElement>(fx, '[data-damage]'), callout: q<SVGTextElement>(fx, '[data-callout]'),
      };
    });
    const camera = q(svg, '[data-camera]');
    const whiteout = q(svg, '[data-whiteout]');
    const ko = q(svg, '[data-ko]');
    let frame = 0, pausedAt = 0, offset = 0;
    let endSince = 0;
    const set = (el: Element, name: string, value: string) => { if (el.getAttribute(name) !== value) el.setAttribute(name, value); };
    const render = (now: number) => {
      frame = requestAnimationFrame(render);
      const { fighters: roster, winner: champion, paused: isPaused } = latest.current;
      if (isPaused && !reduced) { pausedAt ||= now; return; }
      if (pausedAt) { offset += now - pausedAt; if (active.current) active.current.started += now - pausedAt; if (endSince) endSince += now - pausedAt; pausedAt = 0; }
      const time = reduced ? 0 : now - offset;
      const event = active.current;
      const elapsed = event && !reduced ? now - event.started : 99999;
      if (champion && !endSince) endSince = event && !reduced ? event.started : now - 99999;
      if (!champion) endSince = 0;
      let shake = 0, white = 0, koAlpha = 0;
      nodes.forEach((node, index) => {
        const fighter = roster[index];
        const outcome = event?.result.fighters.find((item) => item.id === fighter?.id);
        const playing = !!outcome && elapsed < DURATION;
        const knockedOut = (fighter?.hp ?? 100) <= 0;
        const endMove: AnimationMove | null = knockedOut ? 'down' : champion ? champion === 'draw' ? null : champion === fighter?.id ? 'victory' : 'slump' : null;
        const endAt = knockedOut && outcome?.damageTaken ? IMPACT + 240 : DURATION;
        let move: AnimationMove = playing ? outcome!.move : 'idle';
        let progress = Math.min(1, elapsed / (DURATION - 150));
        if (endMove && (elapsed >= endAt || reduced || !event)) { move = endMove; progress = reduced ? 1 : (now - (endSince || now) - (event ? endAt : 0)) / 750; }
        const pose = boxingPose(move, progress, time + index * 900);
        // Defender reaction, scaled by the damage that actually landed.
        const te = elapsed - IMPACT;
        const hitK = outcome && outcome.damageTaken > 0 && te > 0 && te < 760 ? (te < 70 ? te / 70 : (1 - (te - 70) / 690) ** 2) : 0;
        if (hitK && move !== 'down') {
          const weight = outcome!.blocked ? .35 : Math.max(.5, Math.min(1.2, outcome!.damageTaken / 13));
          pose.x -= 22 * hitK * weight; pose.lean -= 15 * hitK * weight; pose.headTilt -= 22 * hitK * weight;
        }
        if (move === 'down') { const t = clamp01(progress); pose.headTilt -= 6 * Math.sin(t * Math.PI); }
        const step = move === 'idle' && time ? Math.sin(time * .0026 + index * 2) * 4 : 0;
        const g = geometry(pose, step);
        set(node.group, 'data-move', move);
        set(node.upper, 'transform', g.upper); set(node.torso, 'transform', g.torso); set(node.head, 'transform', g.head);
        node.frontArm.forEach((path) => set(path, 'd', g.frontArm)); node.backArm.forEach((path) => set(path, 'd', g.backArm));
        node.frontLeg.forEach((path) => set(path, 'd', g.frontLeg)); node.backLeg.forEach((path) => set(path, 'd', g.backLeg));
        set(node.frontShoe, 'transform', g.frontShoe); set(node.backShoe, 'transform', g.backShoe);
        set(node.frontGlove, 'transform', g.frontGlove); set(node.backGlove, 'transform', g.backGlove);
        set(node.shadow, 'transform', `translate(${pose.x} 0) scale(${1 + Math.max(0, pose.y) / 120} 1)`);
        // Motion trail: strikes and slips leave two fading after-images.
        const speed = playing ? move === 'dodge' ? defenseCurve(progress) * (progress < .4 ? 1 : 0) : ['jab', 'cross', 'hook'].includes(move) && progress > .2 && progress < .42 ? 1 : 0 : 0;
        node.ghosts.forEach((ghost, i) => { set(ghost, 'opacity', speed ? String(.28 / (i + 1)) : '0'); set(ghost, 'transform', `translate(${(move === 'dodge' ? 16 : -18) * (i + 1)} 0)`); });
        // Impact flash / burst on the fighter who takes clean damage.
        const clean = !!outcome && outcome.damageTaken > 0 && !outcome.blocked;
        const flashK = clean && te > 0 && te < 260 ? 1 - te / 260 : 0;
        set(node.flash, 'opacity', flashK.toFixed(3));
        set(node.flash, 'transform', `translate(${CORNER_X[index] + (index ? -1 : 1) * (18 * SCALE + pose.x * SCALE)} ${HEAD_Y}) scale(${.55 + (1 - flashK) * .9 * Math.min(1.3, (outcome?.damageTaken ?? 8) / 12)})`);
        const shieldK = outcome?.blocked && te > -40 && te < 520 ? te < 60 ? 1 : 1 - (te - 60) / 460 : 0;
        set(node.shield, 'opacity', shieldK.toFixed(3));
        set(node.shield, 'transform', `translate(${CORNER_X[index] + (index ? -1 : 1) * 64 * SCALE} ${HEAD_Y + 26}) scale(${1 + (1 - shieldK) * .35})`);
        // Floating damage number and callout.
        const dmgK = outcome && outcome.damageTaken > 0 && te > 0 && te < 1200 ? te : -1;
        set(node.damage, 'opacity', dmgK < 0 ? '0' : String(dmgK < 900 ? 1 : 1 - (dmgK - 900) / 300));
        if (dmgK >= 0) { node.damage.textContent = `−${outcome!.damageTaken}`; set(node.damage, 'transform', `translate(0 ${-dmgK * .05}) translate(${DMG_X[index]} ${HEAD_Y}) scale(${dmgK < 120 ? 1.6 - dmgK / 200 : 1}) translate(${-DMG_X[index]} ${-HEAD_Y})`); }
        const callText = outcome?.blocked ? 'BLOCK!' : outcome?.dodged ? '¡ESQUIVA!' : outcome?.move === 'recover' ? '+ ENERGÍA' : outcome && outcome.damageTaken >= 16 ? '¡CROCHET!' : '';
        const callStart = outcome?.move === 'recover' ? 200 : IMPACT - 60;
        const ct = elapsed - callStart;
        const callK = callText && ct > 0 && ct < 1100 ? ct < 120 ? ct / 120 : ct > 850 ? 1 - (ct - 850) / 250 : 1 : 0;
        set(node.callout, 'opacity', callK.toFixed(3));
        if (callK) { if (node.callout.textContent !== callText) node.callout.textContent = callText; set(node.callout, 'class', `bx-svg-callout ${outcome?.move === 'recover' ? 'recover' : outcome?.blocked ? 'block' : outcome?.dodged ? 'dodge' : 'hit'}`); set(node.callout, 'transform', `translate(0 ${-Math.min(ct, 300) * .04})`); }
        if (clean && te > 0 && te < 340) shake = Math.max(shake, (outcome!.damageTaken / 16) * 10 * (1 - te / 340));
        if (clean && outcome!.damageTaken >= 12 && te > 0 && te < 140) white = Math.max(white, .22 * (1 - te / 140));
        if (knockedOut && outcome?.damageTaken) koAlpha = elapsed < IMPACT + 150 ? 0 : 1;
        else if (knockedOut && (reduced || !event)) koAlpha = 1;
      });
      const zoom = 1 + shake * .003;
      set(camera, 'transform', shake ? `translate(${(Math.sin(now * .09) * shake).toFixed(2)} ${(Math.cos(now * .077) * shake * .6).toFixed(2)}) translate(500 300) scale(${zoom}) translate(-500 -300)` : 'translate(0 0)');
      set(whiteout, 'opacity', white.toFixed(3));
      const kt = event ? elapsed - IMPACT - 150 : 9999;
      set(ko, 'opacity', String(koAlpha));
      set(ko, 'transform', koAlpha && kt < 260 && !reduced ? `translate(500 210) scale(${2.2 - 1.2 * easeOut(kt / 260)}) translate(-500 -210)` : 'translate(0 0)');
    };
    frame = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(frame); media.removeEventListener('change', change); };
  }, []);

  const idle = boxingPose('idle', 0, 0);
  const winnerIndex = winner && winner !== 'draw' ? fighters.findIndex((fighter) => fighter.id === winner) : -1;
  const champion = winnerIndex >= 0 ? fighters[winnerIndex] : undefined;
  const knockout = fighters.some((fighter) => fighter.hp <= 0);
  return <div className={`bx-ring${paused ? ' is-paused' : ''}${winner ? ' is-finished' : ''}`}>
    <div className="bx-ring-top"><span><i /> DEUTSCH BOXCLUB</span><span>{paused ? 'Ⅱ PAUSA' : 'WISSEN SCHLÄGT TEMPO'}</span></div>
    <svg ref={svgRef} viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Ring de boxeo con dos púgiles articulados. Los movimientos muestran el resultado del intercambio.">
      <defs>
        <radialGradient id={`${id}-burst`}><stop stopColor="#fff" /><stop offset=".45" stopColor="#ffe08a" stopOpacity=".9" /><stop offset="1" stopColor="#ff7a3c" stopOpacity="0" /></radialGradient>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#191a24" /><stop offset=".55" stopColor="#0d0e13" /><stop offset="1" stopColor="#07080b" /></linearGradient>
        <linearGradient id={`${id}-floor`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#3a4150" /><stop offset=".5" stopColor="#2a303c" /><stop offset="1" stopColor="#1a1e26" /></linearGradient>
        <radialGradient id={`${id}-pool`} cx=".5" cy=".5" r=".5"><stop stopColor="#fff4dc" stopOpacity=".34" /><stop offset=".6" stopColor="#fff4dc" stopOpacity=".08" /><stop offset="1" stopColor="#fff4dc" stopOpacity="0" /></radialGradient>
        <linearGradient id={`${id}-beam`} x1="0" x2="0" y1="0" y2="1"><stop stopColor="#fff2d6" stopOpacity=".2" /><stop offset="1" stopColor="#fff2d6" stopOpacity="0" /></linearGradient>
        <linearGradient id={`${id}-win`} x1="0" x2="0" y1="0" y2="1"><stop stopColor="#ffe3a0" stopOpacity=".55" /><stop offset="1" stopColor="#ffe3a0" stopOpacity="0" /></linearGradient>
        <linearGradient id={`${id}-apron`} x1="0" x2="0" y1="0" y2="1"><stop stopColor="#1d212b" /><stop offset="1" stopColor="#0c0e13" /></linearGradient>
        <linearGradient id={`${id}-post`} x1="0" x2="1"><stop stopColor="#4a505c" /><stop offset=".45" stopColor="#c9ced6" /><stop offset="1" stopColor="#3b404a" /></linearGradient>
        {skins.map((skin, i) => <radialGradient key={i} id={`${id}-skin${i}`} cx=".65" cy=".35" r=".8"><stop stopColor={skin.base} /><stop offset="1" stopColor={skin.shade} /></radialGradient>)}
        {(['red', 'blue'] as const).map((color) => { const c = color === 'red' ? ['#7d1419', '#e5383b', '#ff7d70'] : ['#163a63', '#2f78c0', '#8cc8f2']; return <g key={color}>
          <linearGradient id={`${id}-${color}`} x1="0" x2="1" y1="0" y2="1"><stop stopColor={c[2]} /><stop offset=".45" stopColor={c[1]} /><stop offset="1" stopColor={c[0]} /></linearGradient>
          <radialGradient id={`${id}-${color}-glove`} cx=".38" cy=".3" r=".75"><stop stopColor={c[2]} /><stop offset=".5" stopColor={c[1]} /><stop offset="1" stopColor={c[0]} /></radialGradient>
          <linearGradient id={`${id}-${color}-vest`} x1="0" x2="1"><stop stopColor={color === 'red' ? '#3a1519' : '#13253a'} /><stop offset=".55" stopColor={color === 'red' ? '#7e2329' : '#24507a'} /><stop offset="1" stopColor={color === 'red' ? '#4a1a1f' : '#172f49'} /></linearGradient>
        </g>; })}
      </defs>
      <rect width="1000" height="500" fill={`url(#${id}-bg)`} />
      <g className="bx-bokeh">{bokeh.map((b, i) => <circle key={i} cx={b.x} cy={b.y} r={b.r} fill={b.hue} style={{ animationDelay: `${b.delay}s` }} />)}</g>
      <path d="M60 22 H940" stroke="#2b2f39" strokeWidth="8" /><path d="M60 22 H940" stroke="#555b68" strokeWidth="1" strokeDasharray="6 10" />
      {[230, 400, 600, 770].map((x) => <g key={x}><rect x={x - 24} y="20" width="48" height="16" rx="3" fill="#2a2e38" stroke="#000" /><ellipse cx={x} cy="36" rx="18" ry="4" fill="#fff6e0" /></g>)}
      <path d="M206 36 L254 36 L420 420 L80 420Z M376 36 L424 36 L540 420 L300 420Z M576 36 L624 36 L700 420 L460 420Z M746 36 L794 36 L920 420 L580 420Z" fill={`url(#${id}-beam)`} className="bx-beams" />
      <g>{crowd.map((c, i) => <g key={i} fill={c.tone}><circle cx={c.x} cy={c.y} r={c.r} /><ellipse cx={c.x} cy={c.y + c.r * 2.1} rx={c.r * 1.9} ry={c.r * 1.4} /></g>)}</g>
      <g className="bx-flashes">{flashes.map((f, i) => <circle key={i} cx={f.x} cy={f.y} r="5" fill="#fff" style={{ animationDelay: `${f.delay}s` }} />)}</g>
      {winnerIndex >= 0 && <path className="bx-win-light" d={`M${CORNER_X[winnerIndex] - 30} 0 L${CORNER_X[winnerIndex] + 30} 0 L${CORNER_X[winnerIndex] + 150} ${FLOOR + 14} L${CORNER_X[winnerIndex] - 150} ${FLOOR + 14}Z`} fill={`url(#${id}-win)`} />}
      <g data-camera="">
        <path d="M190 300 L810 300 L962 456 L38 456Z" fill={`url(#${id}-floor)`} stroke="#5a6170" strokeWidth="2" />
        <ellipse cx="500" cy="396" rx="360" ry="64" fill={`url(#${id}-pool)`} />
        <g opacity=".55">
          <ellipse cx="500" cy="390" rx="150" ry="34" fill="none" stroke="#f4efe6" strokeOpacity=".22" strokeWidth="3" />
          <ellipse cx="500" cy="390" rx="132" ry="28" fill="#e5383b" fillOpacity=".1" />
          <text x="500" y="398" textAnchor="middle" fill="#f4efe6" fillOpacity=".3" fontSize="26" fontWeight="800" letterSpacing="8" transform="translate(500 398) scale(1 .62) translate(-500 -398)">BOXCLUB</text>
        </g>
        {winnerIndex >= 0 && <ellipse className="bx-win-pool" cx={CORNER_X[winnerIndex]} cy={FLOOR + 2} rx="130" ry="20" fill="#ffe3a0" fillOpacity=".22" />}
        <path d="M38 456 H962 L950 492 H50Z" fill={`url(#${id}-apron)`} stroke="#2b303b" />
        <text x="500" y="481" textAnchor="middle" fill="#ff6a5c" fontSize="15" fontWeight="800" letterSpacing="9" opacity=".8">DEUTSCH · A1—A2 · BOXCLUB</text>
        {[0, 1, 2].map((level) => <g key={`back-${level}`} fill="none" strokeLinecap="round">
          <path d={`M190 ${214 + level * 30} Q500 ${222 + level * 30} 810 ${214 + level * 30}`} stroke={level === 1 ? '#bdbab4' : '#a5383b'} strokeWidth="4" />
          <path d={`M190 ${214 + level * 30} L38 ${298 + level * 44} M810 ${214 + level * 30} L962 ${298 + level * 44}`} stroke={level === 1 ? '#d2cfc8' : '#c4474a'} strokeWidth="5" />
        </g>)}
        <rect x="183" y="196" width="14" height="112" rx="4" fill={`url(#${id}-post)`} /><rect x="803" y="196" width="14" height="112" rx="4" fill={`url(#${id}-post)`} />
        <rect x="178" y="206" width="24" height="76" rx="8" fill="#c33236" stroke={OUTLINE} strokeWidth="2" /><rect x="798" y="206" width="24" height="76" rx="8" fill="#2f6ea8" stroke={OUTLINE} strokeWidth="2" />
        <Fighter index={0} id={id} pose={idle} /><Fighter index={1} id={id} pose={idle} />
        {[0, 1, 2].map((level) => <g key={`front-${level}`} fill="none" strokeLinecap="round">
          <path d={`M38 ${298 + level * 44} Q500 ${320 + level * 44} 962 ${298 + level * 44}`} stroke="#000" strokeOpacity=".45" strokeWidth="9" transform="translate(0 6)" />
          <path d={`M38 ${298 + level * 44} Q500 ${320 + level * 44} 962 ${298 + level * 44}`} stroke={level === 1 ? '#e3dfd8' : '#d8474a'} strokeWidth="7" />
          <path d={`M38 ${296 + level * 44} Q500 ${318 + level * 44} 962 ${296 + level * 44}`} stroke="#fff" strokeOpacity=".3" strokeWidth="2" />
        </g>)}
        <rect x="28" y="270" width="20" height="200" rx="5" fill={`url(#${id}-post)`} /><rect x="952" y="270" width="20" height="200" rx="5" fill={`url(#${id}-post)`} />
        <rect x="22" y="284" width="32" height="112" rx="11" fill="#d33a3e" stroke={OUTLINE} strokeWidth="2.5" /><rect x="946" y="284" width="32" height="112" rx="11" fill="#3478b6" stroke={OUTLINE} strokeWidth="2.5" />
        <path d="M30 292 V386 M954 292 V386" stroke="#fff" strokeOpacity=".3" strokeWidth="4" strokeLinecap="round" />
        <Effects index={0} id={id} /><Effects index={1} id={id} />
      </g>
      <rect data-whiteout="" width="1000" height="500" fill="#fff" opacity="0" pointerEvents="none" />
      <g data-ko="" opacity="0" pointerEvents="none"><text x="500" y="236" textAnchor="middle" className="bx-svg-ko" stroke={OUTLINE} strokeWidth="12" paintOrder="stroke">K.O.!</text></g>
    </svg>
    {phase === 'question' && round ? <div className="bx-banner" key={`round-${round}`} aria-hidden="true"><small>NEUE FRAGE</small><b>RUNDE {round}</b></div> : null}
    {winner && <div className={`bx-finale ${winnerIndex === 1 ? 'blue' : winnerIndex === 0 ? 'red' : 'draw'}`} role="status"><small>{knockout ? 'K.O. · SIEG' : winner === 'draw' ? 'UNENTSCHIEDEN' : 'SIEG NACH PUNKTEN'}</small><b>{champion ? `¡${champion.name}!` : 'Empate'}</b></div>}
    {champion && <div className="bx-confetti" aria-hidden="true">{confetti.map((c, i) => <i key={i} style={{ left: `${c.x}%`, background: c.color, width: c.w, animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s`, '--rot': `${c.rot}deg` } as CSSProperties} />)}</div>}
    <div className="bx-ring-captions">{[0, 1].map((index) => {
      const fighter = fighters[index];
      const event = result?.fighters.find((item) => item.id === fighter?.id);
      return <div key={index} className={index ? 'blue' : 'red'}><span>{fighter?.name ?? `Esquina ${index ? 'azul' : 'roja'}`}</span><b>{event ? `${labels[event.move]}${event.blocked ? ' · bloquea' : event.dodged ? ' · esquiva' : ''}${event.damageTaken ? ` · −${event.damageTaken} HP` : ''}` : fighter ? 'En guardia' : 'Esperando rival'}</b></div>;
    })}</div>
  </div>;
}
