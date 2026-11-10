// Pantalla de acceso de las tres pestañas de Klaus AI (Hablar, Escribir, Clase) cuando no hay sesión.
// Cada una enseña con una escena vectorial lo que pasa dentro; las escenas son decorativas (aria-hidden) y su
// animación de entrada se dibuja una sola vez. Con movimiento reducido o efectos en pausa se muestran ya dibujadas.
import type { CSSProperties, MouseEvent } from 'react';
import { navigate } from '../util.ts';
import { KlausFigure } from './KlausFigure.tsx';
import type { KlausSkinDef } from '../../shared/klaus-skins.ts';
import './klaus-gate.css';

export type GateKind = 'hablar' | 'escribir' | 'clase';

const go = (href: string) => (e: MouseEvent<HTMLAnchorElement>) => { e.preventDefault(); navigate(href); };
const d = (i: number) => ({ '--d': i } as CSSProperties);

/** Texto de la pantalla «Klaus es Plus» (con sesión, plan Free). El plan lo asigna el profesor en Teacher OS. */
export const PLUS_GATE = {
  title: 'Klaus es parte de Plus.',
  lead: 'Schreibt, Redet y Unterricht mit Klaus son del plan Plus. Pídele a tu profesor que lo active en tu cuenta; mientras tanto, la teoría, los ejercicios, los exámenes y los juegos siguen abiertos.',
};

export function KlausGate({ kind, className, title, lead, perks, back, look, plus = false }: {
  kind: GateKind; className: string; title: string; lead: string; perks: [string, string][]; back: string; look?: KlausSkinDef;
  /** Con sesión pero sin Plus: en vez de «entrar» invita a pedir Plus y a seguir con el curso. */
  plus?: boolean;
}) {
  return (
    <section className={`kg kg-${kind} ${className}${plus ? ' kg-plus' : ''}`} data-klaus-gate={kind} data-klaus-plus={plus ? 'required' : undefined}>
      <div className="kg-copy">
        <h2>{title}</h2>
        <p className="kg-lead">{lead}</p>
        <ol className="kg-perks">
          {perks.map(([k, v], i) => <li key={k} style={d(i)}><span className="kg-n">{String(i + 1).padStart(2, '0')}</span><span><b>{k}</b>{v}</span></li>)}
        </ol>
        {plus ? (
          <p className="kg-cta">
            <a className="btn primary" href="/curso" onClick={go('/curso')}>Seguir con el curso</a>
            <span className="kg-free">Plus · lo activa tu profesor</span>
          </p>
        ) : (
          <p className="kg-cta">
            <a className="btn primary" href={`/entrar?volver=${back}`} onClick={go(`/entrar?volver=${back}`)}>Iniciar sesión</a>
            <a className="btn" href="/registro" onClick={go('/registro')}>Crear cuenta</a>
            <span className="kg-free">Klaus · plan Plus</span>
          </p>
        )}
      </div>
      <div className="kg-stage" aria-hidden="true">
        {kind === 'hablar' ? <TalkScene /> : kind === 'escribir' ? <WriteScene /> : <ClassScene />}
        <div className="kg-klaus"><KlausFigure reaction="waving" look={look} /></div>
      </div>
    </section>
  );
}

/** Anillos finos que se dibujan alrededor de Klaus: el «escenario» de cada pestaña. */
function Rings({ cx, cy, color = 'kg-ring' }: { cx: number; cy: number; color?: string }) {
  return <g className={color}>{[64, 92, 124].map((r, i) => <circle key={r} className="kg-draw" pathLength={1} cx={cx} cy={cy} r={r} style={d(i * 0.35)} transform={`rotate(-90 ${cx} ${cy})`} />)}</g>;
}

/** Conversación: Klaus pregunta, el alumno contesta, Klaus corrige con la forma buena. Onda de voz bajo Klaus. */
function TalkScene() {
  const bars = [5, 12, 20, 10, 28, 16, 34, 22, 14, 26, 9, 18, 7];
  return (
    <svg className="kg-art" viewBox="0 0 520 380">
      <Rings cx={96} cy={252} />
      <g className="kg-bubble kg-in" style={d(0.6)}>
        <path className="kg-ink" d="M214 30h270a18 18 0 0 1 18 18v40a18 18 0 0 1-18 18H236l-30 26 8-26a18 18 0 0 1-18-18V48a18 18 0 0 1 18-18z" />
        <text x="232" y="60" className="kg-who">KLAUS</text>
        <text x="232" y="88" className="kg-de">Hallo! Wie heißt du?</text>
      </g>
      <g className="kg-typing" transform="translate(232 128)"><circle cx="0" cy="0" r="3" /><circle cx="12" cy="0" r="3" /><circle cx="24" cy="0" r="3" /></g>
      <g className="kg-bubble kg-in" style={d(1.3)}>
        <path className="kg-paper" d="M286 146h196a18 18 0 0 1 18 18v40a18 18 0 0 1-18 18h-2l6 20-26-20H286a18 18 0 0 1-18-18v-40a18 18 0 0 1 18-18z" />
        <text x="286" y="176" className="kg-who kg-dark">TÚ</text>
        <text x="286" y="204" className="kg-de kg-dark">Ich habe 15 Jahre.</text>
      </g>
      <g className="kg-fix kg-in" style={d(2)}>
        <path className="kg-rule" d="M286 266V340" />
        <text x="300" y="280" className="kg-tag">CORRECCIÓN</text>
        <text x="300" y="306" className="kg-wrong">Ich habe 15 Jahre</text>
        <path className="kg-strike kg-draw" pathLength={1} d="M298 301H434" style={d(2.6)} />
        <text x="300" y="334" className="kg-right">→ Ich bin 15 Jahre alt</text>
      </g>
      <g className="kg-wave" transform="translate(22 360)">
        {bars.map((h, i) => <rect key={i} x={i * 12.5} y={-h / 2} width="5" height={h} rx="2.5" style={d(i * 0.18)} />)}
      </g>
    </svg>
  );
}

/** Escritura: hoja con una carta en alemán; Klaus marca el error en rojo y propone la forma; un lápiz termina la línea. */
function WriteScene() {
  return (
    <svg className="kg-art" viewBox="0 0 520 380">
      <Rings cx={96} cy={262} />
      <g className="kg-in" style={d(0.4)}><g className="kg-sheet" transform="rotate(-2.5 350 190)">
        <rect className="kg-shadow" x="208" y="26" width="290" height="336" rx="6" />
        <rect className="kg-paper" x="200" y="18" width="290" height="336" rx="6" />
        <path className="kg-margin" d="M236 18V354" />
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => <path key={i} className="kg-ruled" d={`M220 ${88 + i * 30}H474`} />)}
        <text x="248" y="70" className="kg-hand">Liebe Oma,</text>
        <text x="248" y="112" className="kg-hand">ich wohne jetzt in Berlin.</text>
        <text x="248" y="148" className="kg-hand">Ich <tspan className="kg-hand-wrong">habe</tspan> 15 Jahre alt</text>
        <path className="kg-strike kg-draw" pathLength={1} d="M273 143.5H312" style={d(1.8)} />
        <text x="279" y="128" className="kg-insert kg-in" style={d(2.2)}>bin</text>
        <circle className="kg-margin-dot kg-in" cx="226" cy="143" r="4" style={d(1.8)} />
        <text x="248" y="178" className="kg-hand">und gehe gern ins Kino.</text>
        <path className="kg-line kg-draw" pathLength={1} d="M248 204H392" style={d(2.6)} />
        <g className="kg-note kg-in" style={d(2.4)}>
          <rect x="248" y="250" width="214" height="62" rx="8" />
          <text x="262" y="272" className="kg-tag">KLAUS · PISTA</text>
          <text x="262" y="296" className="kg-note-t">La edad va con «sein».</text>
        </g>
        <text x="248" y="338" className="kg-count">38 palabras · 1 corrección</text>
      </g></g>
      <g className="kg-pencil" style={d(2.6)}>
        <g transform="translate(394 206) rotate(18)">
          <path className="kg-pencil-body" d="M0 0l12 -7h70a7 7 0 0 1 7 7v14a7 7 0 0 1-7 7H12z" />
          <path className="kg-pencil-tip" d="M0 0l12 -7v28z" />
          <path className="kg-pencil-band" d="M68 -7v28M75 -7v28" />
        </g>
      </g>
    </svg>
  );
}

/** Clase: pizarra con la tabla Nominativ → Akkusativ; Klaus señala la casilla que cambia (der → den). */
function ClassScene() {
  const rows: [string, string, boolean][] = [['der Hund', 'den Hund', true], ['die Katze', 'die Katze', false], ['das Buch', 'das Buch', false], ['ein Apfel', 'einen Apfel', true]];
  return (
    <svg className="kg-art" viewBox="0 0 520 380">
      <Rings cx={92} cy={266} />
      <g className="kg-board kg-in" style={d(0.4)}>
        <rect className="kg-slate" x="196" y="22" width="310" height="266" rx="10" />
        <text x="218" y="56" className="kg-tag">AKKUSATIV · WEN ODER WAS?</text>
        <text x="218" y="92" className="kg-th">Nominativ</text>
        <text x="360" y="92" className="kg-th">Akkusativ</text>
        <path className="kg-chalk kg-draw" pathLength={1} d="M218 104H486" style={d(0.9)} />
        <rect className="kg-row kg-in" x="206" y="113" width="290" height="32" rx="7" style={d(2.4)} />
        {rows.map(([a, b, hot], i) => (
          <g key={a} className="kg-in" style={d(1.1 + i * 0.3)}>
            <text x="218" y={136 + i * 36} className="kg-td">{a}</text>
            <text x="360" y={136 + i * 36} className={hot ? 'kg-td kg-hot' : 'kg-td'}>{b}</text>
          </g>
        ))}
        <rect className="kg-cell kg-draw" pathLength={1} x="350" y="113" width="104" height="32" rx="7" style={d(2.5)} />
        <rect className="kg-cell kg-draw" pathLength={1} x="350" y="221" width="122" height="32" rx="7" style={d(2.8)} />
      </g>
      <path className="kg-pointer kg-draw" pathLength={1} d="M152 222C168 170 178 140 190 132" style={d(2.6)} />
      <circle className="kg-pointer-dot kg-in" cx="194" cy="130" r="4" style={d(3)} />
      <g className="kg-in" style={d(3)}><g className="kg-steps" transform="translate(218 316)">
        {Array.from({ length: 13 }, (_, i) => <rect key={i} x={i * 22} y="0" width="16" height="4" rx="2" className={i < 4 ? 'is-done' : ''} />)}
        <text x="0" y="28" className="kg-count kg-on-dark">Paso 4 de 13 · A1</text>
      </g></g>
    </svg>
  );
}
