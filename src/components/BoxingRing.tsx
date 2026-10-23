import { useEffect, useId, useRef } from 'react';
import type { BoxingFighter, BoxingMove, BoxingResolution } from '../../shared/boxing.ts';

type AnimationMove = BoxingMove | 'recover' | 'idle';
type Point = [number, number];
export function boxingPose(move: AnimationMove, progress: number, time: number) {
  const power = Math.sin(Math.PI * Math.max(0, Math.min(1, (progress - .08) / .78)));
  const breath = Math.sin(time * .003) * 1.5;
  const pose = { frontHand: [60, -130 + breath] as Point, backHand: [8, -137 + breath] as Point, frontElbow: [45, -88] as Point, backElbow: [-25, -95] as Point, lean: 0, x: 0, y: breath, twist: 0 };
  if (move === 'jab') { pose.frontHand = [60 + 138 * power, -145]; pose.frontElbow = [53 + 70 * power, -104 - 32 * power]; pose.x = 25 * power; }
  if (move === 'cross') { pose.backHand = [8 + 192 * power, -139]; pose.backElbow = [-25 + 134 * power, -95 - 40 * power]; pose.twist = -14 * power; pose.x = 25 * power; }
  if (move === 'hook') { pose.frontHand = [60 + 120 * power, -130 - 25 * power]; pose.frontElbow = [45 + 80 * power, -88 - 72 * power]; pose.twist = 13 * power; pose.x = 38 * power; }
  if (move === 'guard') { pose.frontHand = [60 - 22 * power, -130 - 30 * power]; pose.backHand = [8 + 12 * power, -137 - 19 * power]; }
  if (move === 'dodge') { pose.lean = -28 * power; pose.x = -22 * power; pose.y += 21 * power; }
  if (move === 'recover') { pose.frontHand[1] += 24 * power; pose.backHand[1] += 20 * power; pose.y += 3 * power; }
  return pose;
}
export function resolutionKey(result?: BoxingResolution) {
  return result ? `${result.exchange}:${result.fighters.map((fighter) => `${fighter.id}:${fighter.move}:${fighter.damageDealt}:${fighter.damageTaken}`).join('|')}` : '';
}
const labels: Record<AnimationMove, string> = { idle: 'En guardia', recover: 'Recupera energía', jab: 'Jab', cross: 'Directo', hook: 'Crochet', guard: 'Defensa', dodge: 'Esquiva' };

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

function Fighter({ index, palette }: { index: number; palette: string }) {
  return <g data-fighter={index} className={`bx-fighter bx-fighter-${index}`} transform={`translate(${index ? 635 : 365} 339) scale(${index ? -1.12 : 1.12} 1.12)`}>
    <ellipse cx="2" cy="7" rx="66" ry="11" fill="#000" opacity=".5" />
    <g data-body="">
      <path data-left-leg="" d="M-14-66 L-40-29 L-48-5" fill="none" stroke="#25313c" strokeWidth="23" strokeLinecap="round" />
      <path data-right-leg="" d="M20-65 L39-36 L53-5" fill="none" stroke="#364451" strokeWidth="24" strokeLinecap="round" />
      <path data-left-shoe="" d="M-53-10 Q-64-3-59 2 L-29 2 L-31-8Z" fill="#c8c9c9" />
      <path data-right-shoe="" d="M46-10 L62-4 Q75-1 69 4 L43 4 L38-6Z" fill="#e4e1da" />
      <g data-torso="">
        <path data-back-arm="" d="M-16-122 Q-25-95 8-137" fill="none" stroke="#ad775c" strokeWidth="17" strokeLinecap="round" strokeLinejoin="round" />
        <g data-back-glove="" transform="translate(8 -137)"><rect x="-10" y="-8" width="17" height="21" rx="5" fill="#e4ddd4" /><ellipse cx="7" cy="-4" rx="18" ry="16" fill={`url(#${palette})`} /><path d="M0-13 Q12-18 20-9" fill="none" stroke="#fff" opacity=".24" strokeWidth="3" /></g>
        <path d="M-21-127 Q-3-142 26-129 Q42-114 30-79 L25-61 L-23-61 L-29-100Z" fill={`url(#${palette}-vest)`} />
        <path d="M-15-126 L-9-77 M20-127 L22-87" stroke="#fff" opacity=".1" strokeWidth="3" fill="none" />
        <path d="M-24-67 L28-67 L31-47 Q14-43 1-51 Q-17-43-26-49Z" fill={`url(#${palette})`} /><path d="M-24-64 L29-64" stroke="#eee7dc" strokeWidth="6" />
        <path d="M2-135 L3-149 L25-151 L30-134Z" fill="#bd896b" />
        <g data-head="">
          <path d="M-2-170 Q12-186 31-171 L34-155 L39-149 L31-145 Q25-132 9-140 L2-151Z" fill="#d6a282" />
          <path d="M-3-163 Q-8-181 10-185 Q29-186 34-173 L31-166 L22-173 L10-171 L4-158Z" fill="#171b22" />
          <path d="M28-158 L32-158 M28-144 L21-144" stroke="#6a493f" strokeWidth="2" />
          <ellipse cx="3" cy="-155" rx="4" ry="6" fill="#bd896b" />
        </g>
        <path data-front-arm="" d="M22-119 Q45-88 60-130" fill="none" stroke="#d6a282" strokeWidth="19" strokeLinecap="round" strokeLinejoin="round" />
        <g data-front-glove="" transform="translate(60 -130)"><rect x="-12" y="-2" width="17" height="22" rx="5" fill="#e4ddd4" /><ellipse cx="5" cy="-6" rx="20" ry="17" fill={`url(#${palette})`} /><path d="M-6-15 Q6-24 19-13" fill="none" stroke="#fff" opacity=".32" strokeWidth="3" /></g>
      </g>
    </g>
    <g data-spark="" transform="translate(14 -166)" opacity="0" stroke="#ffd893" strokeLinecap="round">
      {Array.from({ length: 10 }, (_, i) => <line key={i} x1={Math.cos(i * Math.PI / 5) * 23} y1={Math.sin(i * Math.PI / 5) * 23} x2={Math.cos(i * Math.PI / 5) * (34 + i % 3 * 6)} y2={Math.sin(i * Math.PI / 5) * (34 + i % 3 * 6)} strokeWidth={i % 2 ? 2 : 3} />)}
    </g>
  </g>;
}

export function BoxingRing({ fighters, result, paused = false, sound = false }: { fighters: BoxingFighter[]; result?: BoxingResolution; paused?: boolean; sound?: boolean }) {
  const id = useId().replace(/:/g, '');
  const svgRef = useRef<SVGSVGElement>(null);
  const active = useRef<{ result: BoxingResolution; started: number } | null>(null);
  const seen = useRef(new Set<string>());
  const fighterIds = useRef<string[]>([]);
  fighterIds.current = fighters.map((fighter) => fighter.id);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
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
    const nodes = [0, 1].map((index) => {
      const group = svg.querySelector<SVGGElement>(`[data-fighter="${index}"]`)!;
      return { group, body: group.querySelector('[data-body]')!, torso: group.querySelector('[data-torso]')!, frontArm: group.querySelector('[data-front-arm]')!, backArm: group.querySelector('[data-back-arm]')!, frontGlove: group.querySelector('[data-front-glove]')!, backGlove: group.querySelector('[data-back-glove]')!, spark: group.querySelector('[data-spark]')!, leftLeg: group.querySelector('[data-left-leg]')!, rightLeg: group.querySelector('[data-right-leg]')!, leftShoe: group.querySelector('[data-left-shoe]')!, rightShoe: group.querySelector('[data-right-shoe]')! };
    });
    const camera = svg.querySelector('[data-camera]')!;
    let frame = 0;
    const render = (time: number) => {
      const event = active.current;
      const elapsed = event ? time - event.started : 9999;
      const playing = elapsed < 1750 && !pausedRef.current && !reduced;
      nodes.forEach((node, index) => {
        const fighter = event?.result.fighters.find((item) => item.id === fighterIds.current[index]);
        const move = playing ? fighter?.move ?? 'idle' : 'idle';
        const pose = boxingPose(move, Math.min(1, elapsed / 1500), pausedRef.current || reduced ? 0 : time + index * 900);
        node.group.setAttribute('data-move', move);
        node.body.setAttribute('transform', `translate(${pose.x} ${pose.y})`);
        const step = !playing && !pausedRef.current && !reduced ? Math.sin(time * .0025 + index * 2) * 3 : 0;
        node.leftLeg.setAttribute('d', `M-14-66 L${-40 + step}-29 L${-48 + step}-5`);
        node.rightLeg.setAttribute('d', `M20-65 L${39 - step}-36 L${53 - step}-5`);
        node.leftShoe.setAttribute('transform', `translate(${step} 0)`);
        node.rightShoe.setAttribute('transform', `translate(${-step} 0)`);
        node.torso.setAttribute('transform', `rotate(${pose.lean + pose.twist} 0 -66)`);
        node.frontArm.setAttribute('d', `M22-119 Q${pose.frontElbow.join(' ')} ${pose.frontHand.join(' ')}`);
        node.backArm.setAttribute('d', `M-16-122 Q${pose.backElbow.join(' ')} ${pose.backHand.join(' ')}`);
        node.frontGlove.setAttribute('transform', `translate(${pose.frontHand.join(' ')}) rotate(${move === 'hook' ? -35 : -9})`);
        node.backGlove.setAttribute('transform', `translate(${pose.backHand.join(' ')}) rotate(-12)`);
        const hit = playing && !!fighter?.damageTaken && elapsed > 550 && elapsed < 850;
        node.spark.setAttribute('opacity', hit ? String(Math.sin((elapsed - 550) / 300 * Math.PI)) : '0');
        node.spark.setAttribute('transform', `translate(14 -166) scale(${.8 + (elapsed - 550) / 500})`);
      });
      const impact = playing && event?.result.fighters.some((fighter) => fighter.damageTaken > 0) && elapsed > 550 && elapsed < 780;
      camera.setAttribute('transform', impact ? `translate(${Math.sin(elapsed * .14) * 2.2} ${Math.cos(elapsed * .12) * 1.6})` : 'translate(0 0)');
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(frame); media.removeEventListener('change', change); };
  }, []);

  return <div className={`bx-ring${paused ? ' is-paused' : ''}`}>
    <div className="bx-ring-top"><span><i /> DEUTSCH BOXCLUB</span><span>{paused ? 'PAUSA' : 'WISSEN SCHLÄGT TEMPO'}</span></div>
    <svg ref={svgRef} viewBox="0 0 1000 430" role="img" aria-label="Ring de boxeo con dos púgiles articulados. Los movimientos muestran el resultado del intercambio.">
      <defs>
        <linearGradient id={`${id}-floor`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#242a32" /><stop offset="1" stopColor="#15191f" /></linearGradient>
        <radialGradient id={`${id}-halo`}><stop stopColor="#6d788c" stopOpacity=".2" /><stop offset="1" stopColor="#0c0e12" stopOpacity="0" /></radialGradient>
        <linearGradient id={`${id}-beam`} x1="0" x2="0" y1="0" y2="1"><stop stopColor="#d8e5ff" stopOpacity=".09" /><stop offset="1" stopColor="#d8e5ff" stopOpacity="0" /></linearGradient>
        {['red', 'blue'].map((color) => <g key={color}>
          <linearGradient id={`${id}-${color}`} x1="0" x2="1"><stop stopColor={color === 'red' ? '#9c242a' : '#285d91'} /><stop offset=".6" stopColor={color === 'red' ? '#ff5e54' : '#75b8e4'} /><stop offset="1" stopColor={color === 'red' ? '#bf3035' : '#3b6f9e'} /></linearGradient>
          <linearGradient id={`${id}-${color}-vest`} x1="0" x2="1"><stop stopColor={color === 'red' ? '#51282c' : '#23394f'} /><stop offset=".6" stopColor={color === 'red' ? '#a44344' : '#4a7695'} /><stop offset="1" stopColor={color === 'red' ? '#6b292e' : '#2a455e'} /></linearGradient>
        </g>)}
      </defs>
      <rect width="1000" height="430" fill={`url(#${id}-halo)`} />
      <path d="M240-10 L60 330 L460 330Z M760-10 L540 330 L940 330Z" fill={`url(#${id}-beam)`} />
      <path d="M135 41 H865 M160 32 V50 M200 32 V50 M240 32 V50 M760 32 V50 M800 32 V50 M840 32 V50" stroke="#272d35" strokeWidth="4" />
      <g fill="#e4e9f0" opacity=".65">{[240, 310, 690, 760].map((x) => <rect key={x} x={x} y="39" width="23" height="5" rx="2" />)}</g>
      <text x="500" y="110" textAnchor="middle" fill="#e7e3dc" opacity=".11" fontSize="44" fontWeight="800" letterSpacing="13">BOXCLUB</text>
      <g data-camera="">
        <path d="M175 232 L825 232 L958 365 L42 365Z" fill={`url(#${id}-floor)`} stroke="#434951" strokeWidth="2" />
        <path d="M42 365 H958 L947 389 H53Z" fill="#0b0d11" stroke="#242830" />
        <path d="M175 232 L825 232 M219 246 L780 246 M262 260 L737 260" stroke="#ffffff" opacity=".025" />
        <ellipse cx="500" cy="323" rx="230" ry="36" fill="none" stroke="#626b76" opacity=".12" strokeWidth="2" />
        <text x="500" y="341" textAnchor="middle" fill="#777c83" opacity=".25" fontSize="17" fontWeight="700" letterSpacing="9">DEUTSCH / A1—A2</text>
        {[0, 1, 2].map((level) => <g key={`back-${level}`} fill="none" strokeWidth="3">
          <path d={`M175 ${158 + level * 25} Q500 ${169 + level * 25} 825 ${158 + level * 25}`} stroke={level === 1 ? '#a7a6a2' : '#7e3134'} />
          <path d={`M175 ${158 + level * 25} L42 ${255 + level * 32} M825 ${158 + level * 25} L958 ${255 + level * 32}`} stroke={level === 1 ? '#a7a6a2' : '#993e41'} />
        </g>)}
        <path d="M175 152 V244 M825 152 V244" stroke="#373d46" strokeWidth="12" />
        <path d="M175 161 V204" stroke="#ba4948" strokeWidth="20" strokeLinecap="round" /><path d="M825 161 V204" stroke="#5b87ad" strokeWidth="20" strokeLinecap="round" />
        <Fighter index={0} palette={`${id}-red`} /><Fighter index={1} palette={`${id}-blue`} />
        {[0, 1, 2].map((level) => <path key={`front-${level}`} d={`M42 ${255 + level * 32} Q500 ${273 + level * 32} 958 ${255 + level * 32}`} fill="none" stroke={level === 1 ? '#c1bdb6' : '#c65452'} strokeWidth={level === 1 ? 3 : 4} opacity={level === 2 ? .85 : .65} />)}
        <path d="M42 243 V383 M958 243 V383" stroke="#393e47" strokeWidth="14" />
        <path d="M42 251 V310" stroke="#ac393d" strokeWidth="23" strokeLinecap="round" /><path d="M958 251 V310" stroke="#3b6d9e" strokeWidth="23" strokeLinecap="round" />
      </g>
    </svg>
    <div className="bx-ring-captions">{[0, 1].map((index) => {
      const fighter = fighters[index];
      const event = result?.fighters.find((item) => item.id === fighter?.id);
      return <div key={index} className={index ? 'blue' : 'red'}><span>{fighter?.name ?? `Esquina ${index ? 'azul' : 'roja'}`}</span><b>{event ? `${labels[event.move]}${event.damageTaken ? ` · −${event.damageTaken} HP` : ''}` : fighter ? 'En guardia' : 'Esperando rival'}</b></div>;
    })}</div>
  </div>;
}
