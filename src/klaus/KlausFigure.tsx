import type { CSSProperties } from 'react';
import type { KlausReaction } from './events.ts';
import './klaus.css';

export type KlausSkin = 'original' | 'professor' | 'fire' | 'royal';
export function reactionSkin(reaction: KlausReaction): KlausSkin {
  return reaction === 'thinking' || reaction === 'support' ? 'professor'
    : reaction === 'streak5' ? 'fire' : reaction === 'streak10' || reaction === 'complete' ? 'royal' : 'original';
}

/**
 * Direct geometry port of the user's PySide6 renderer: _ear_points,
 * _paint_signature_lines and _paint_behavior_overlay (waving paw).
 * Keep the 1.20 signature-rect ratio. The extra right margin holds the real paw.
 * No filled cat head, pupil eyes, substitute font glyphs or replacement mouth.
 */
export function KlausFigure({ reaction = 'idle', reducedMotion = false, skin = reactionSkin(reaction) }: {
  reaction?: KlausReaction; reducedMotion?: boolean; skin?: KlausSkin;
}) {
  const celebrating = ['correct', 'streak3', 'streak5', 'streak10', 'complete'].includes(reaction);
  const waving = reaction === 'waving' || reaction === 'complete';
  return <svg className="klaus-figure" viewBox="-14 -14 190 139" aria-hidden="true" focusable="false"
    data-klaus-figure="" data-klaus-reaction={reaction} data-klaus-skin={skin} data-klaus-motion={reducedMotion ? 'reduced' : 'full'}>
    <ellipse className="klaus-shadow" cx="60" cy="112" rx="41" ry="2.8" />
    <g className="klaus-rig">
      <g transform="scale(1.2 1)" stroke="currentColor" strokeWidth="1.05" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {skin === 'fire' && <g className="klaus-fire" stroke="none" fill="var(--klaus-accent)">
          <path d="M10 89Q-2 72 10 54Q7 70 16 72Q12 56 21 47Q19 68 25 78Q30 95 16 100Z" />
          <path d="M90 89Q102 72 90 54Q93 70 84 72Q88 56 79 47Q81 68 75 78Q70 95 84 100Z" />
        </g>}
        <g className="klaus-signature" data-klaus-signature="">
          <polyline className="klaus-ear-left" points="20,35 31,8 42,35" strokeLinecap="butt" strokeLinejoin="miter" />
          <polyline className="klaus-ear-right" points="58,35 69,8 80,35" strokeLinecap="butt" strokeLinejoin="miter" />
          <path d="M45.5 35H54.5" />
          <path d="M15 41Q4 55 15 70" /><path d="M85 41Q96 55 85 70" />
          <g className="klaus-gaze">
            <g className="klaus-eye-open"><path d="M32.5 50.5L36.5 43L40.5 50.5" /><path d="M59.5 50.5L63.5 43L67.5 50.5" /></g>
            <g className="klaus-eye-shut"><path d="M33.3 49H39.7" /><path d="M60.3 49H66.7" /></g>
          </g>
          <circle cx="50" cy="62.5" r="1.05" fill="currentColor" stroke="none" />
          <g className="klaus-whiskers"><path d="M20 84L31 91L20 98" /><path d="M80 84L69 91L80 98" /></g>
          <path d="M44 85L47 100L50 90L53 100L56 85" />
        </g>
        {skin === 'professor' && <g className="klaus-accessory" stroke="#D8D8D8" strokeWidth=".65">
          <rect x="29.5" y="43" width="17.5" height="14" rx="1.8" /><rect x="53" y="43" width="17.5" height="14" rx="1.8" />
          <path d="M47 49.5H53M42 23L50 18L58 23L50 28Z" />
        </g>}
        {skin === 'royal' && <g data-klaus-crown="" className="klaus-crown" stroke="#FFF0A3" fill="#60450C">
          <path d="M25 29L29 12L40 22L50 7L60 22L71 12L75 29Z" />
          <path d="M26 29H74" stroke="#FFD54A" />
          <circle cx="37" cy="25" r="1.1" fill="#36D47A" /><circle cx="50" cy="25" r="1.1" fill="#F2C14E" /><circle cx="63" cy="25" r="1.1" fill="#36D47A" />
        </g>}
        {waving && <g data-klaus-paw="" className="klaus-paw-position" transform="translate(124 83)">
          <g className="klaus-paw" strokeWidth=".92">
            <path d="M-3.3 1C-3.5 -8 -3 -18 -2.4 -28M3.3 1C3.5 -8 3 -18 2.4 -28" />
            <g transform="translate(0 -33.3)">
              <path d="M-5.7 4.8C-8.2 1.8 -7.4 -3.8 -3.8 -5.2C-1.8 -7 1.8 -7 3.8 -5.2C7.4 -3.8 8.2 1.8 5.7 4.8C3 7.7 -3 7.7 -5.7 4.8Z" fill="#101112" strokeWidth=".66" />
              <g strokeWidth=".5">
                <ellipse data-klaus-toe="" cx="-4.1" cy="-5.6" rx="1.25" ry="1.65" transform="rotate(-22 -4.1 -5.6)" />
                <ellipse data-klaus-toe="" cx="-1.5" cy="-7.4" rx="1.3" ry="1.72" transform="rotate(-7 -1.5 -7.4)" />
                <ellipse data-klaus-toe="" cx="1.5" cy="-7.4" rx="1.3" ry="1.72" transform="rotate(7 1.5 -7.4)" />
                <ellipse data-klaus-toe="" cx="4.1" cy="-5.6" rx="1.25" ry="1.65" transform="rotate(22 4.1 -5.6)" />
                <path data-klaus-pad="" d="M-3.8 1.2C-4.2 -2.5 -1.8 -4.2 0 -3C1.8 -4.2 4.2 -2.5 3.8 1.2C3 4 -3 4 -3.8 1.2Z" />
              </g>
              <path className="klaus-paw-echo" d="M11 -9Q18 -4 12 1M15 -12Q25 -4 17 5" opacity=".3" strokeWidth=".5" />
            </g>
          </g>
        </g>}
        {reaction === 'thinking' && <g className="klaus-thought" fill="var(--klaus-accent)" stroke="none"><circle cx="91" cy="34" r="1" /><circle cx="97" cy="26" r="1.5" /><circle cx="105" cy="17" r="2" /></g>}
        {celebrating && !reducedMotion && <g data-klaus-burst="" className="klaus-burst" stroke="var(--klaus-accent)" strokeWidth="1.2">
          {[[-1, 25], [18, -3], [50, -8], [85, -3], [102, 25], [104, 69], [-4, 69], [10, 108], [90, 108]].map(([x, y], i) =>
            <g key={i} className="klaus-spark" style={{ '--spark-delay': `${i * 38}ms`, '--spark-x': `${(x - 50) * .16}px`, '--spark-y': `${(y - 50) * .16}px` } as CSSProperties}>
              <path d={`M${x - 2} ${y}h4M${x} ${y - 2}v4`} />
            </g>)}
        </g>}
      </g>
    </g>
  </svg>;
}
