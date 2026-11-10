import type { CSSProperties } from 'react';
import type { KlausReaction } from './events.ts';
import './klaus.css';
import type { KlausSkinDef } from '../../shared/klaus-skins.ts';

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
export function KlausFigureSvg({ reaction = 'idle', reducedMotion = false, skin = reactionSkin(reaction), look }: {
  reaction?: KlausReaction; reducedMotion?: boolean; skin?: KlausSkin;
  /** Skin de colección del alumno (colores, brillo y emblema). Sin ella, el Klaus original. */
  look?: KlausSkinDef;
}) {
  const custom = look && look.id !== 'default';
  const style = custom ? { color: look.line, '--klaus-accent': look.accent, '--klaus-secondary': look.secondary, filter: look.glow ? `drop-shadow(0 0 4px ${look.accent})` : undefined } as CSSProperties : undefined;
  const celebrating = ['correct', 'streak3', 'streak5', 'streak10', 'complete'].includes(reaction);
  const waving = reaction === 'waving' || reaction === 'complete';
  return <svg className="klaus-figure" viewBox="-14 -14 190 139" aria-hidden="true" focusable="false"
    data-klaus-figure="" data-klaus-reaction={reaction} data-klaus-skin={skin} data-klaus-motion={reducedMotion ? 'reduced' : 'full'} data-klaus-look={look?.id ?? 'default'} style={style}>
    {custom && <ellipse className="klaus-aura" cx="60" cy="62" rx="64" ry="52" fill={look.secondary} opacity=".1" />}
    <ellipse className="klaus-shadow" cx="60" cy="112" rx="41" ry="2.8" />
    {custom && look.emoji && <text className="klaus-emblem" x="128" y="20" fontSize="22" textAnchor="middle">{look.emoji}</text>}
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
        {waving && <g data-klaus-paw="" className="klaus-paw-position" transform="translate(90.5 73.5) scale(1 1.2)">
          {/* Misma pata que el motor Canvas: nace bajo la mejilla derecha; unidades isótropas (compensa scale(1.2 1)). */}
          <g className="klaus-paw" strokeWidth=".88">
            <path d="M-2.3 0C-2.5 -4.5 -2.7 -9 -3.2 -13.2C-6.4 -14.6 -7.2 -19.6 -4.6 -22.2C-2.4 -24.4 2.4 -24.4 4.6 -22.2C7.2 -19.6 6.4 -14.6 3.2 -13.2C2.7 -9 2.5 -4.5 2.3 0Z" fill="#101112" stroke="none" />
            <path d="M-2.3 0C-2.5 -4.5 -2.7 -9 -3.2 -13.2C-6.4 -14.6 -7.2 -19.6 -4.6 -22.2C-2.4 -24.4 2.4 -24.4 4.6 -22.2C7.2 -19.6 6.4 -14.6 3.2 -13.2C2.7 -9 2.5 -4.5 2.3 0" />
            <g fill="currentColor" stroke="none">
              <ellipse data-klaus-toe="" cx="-4" cy="-19.4" rx=".82" ry="1.02" />
              <ellipse data-klaus-toe="" cx="-1.4" cy="-21.3" rx=".86" ry="1.08" />
              <ellipse data-klaus-toe="" cx="1.4" cy="-21.3" rx=".86" ry="1.08" />
              <ellipse data-klaus-toe="" cx="4" cy="-19.4" rx=".82" ry="1.02" />
              <path data-klaus-pad="" d="M0 -18.3C1.2 -19.2 2.9 -18.5 2.6 -16.8C2.4 -15.5 1.1 -15.1 0 -15.1C-1.1 -15.1 -2.4 -15.5 -2.6 -16.8C-2.9 -18.5 -1.2 -19.2 0 -18.3Z" />
            </g>
            <path className="klaus-paw-echo" d="M8.5 -21.5A9.2 9.2 0 0 1 8.9 -15.4M11.2 -22.6A12 12 0 0 1 11.7 -14.6" opacity=".45" strokeWidth=".5" />
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
