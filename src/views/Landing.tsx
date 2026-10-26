import { useEffect, useRef, type CSSProperties } from 'react';
import { COURSE, GAME_INFO, STEP_META, nextStep, overallProgress, unitProgress, unitStatus } from '../course.ts';
import { followLearningLink } from '../components/LearningNav.tsx';
import { Hero3D } from '../brand/Hero3D.tsx';
import { Wordmark } from '../brand/Logo.tsx';
import { IntroReplayButton } from '../brand/Intro.tsx';
import { MagneticLink } from '../brand/MagneticLink.tsx';
import { ProgressRing } from '../brand/ProgressRing.tsx';
import { WeeklyPointsSlot } from '../brand/WeeklyPointsSlot.tsx';
import { useCourseProgress } from '../brand/progress.ts';
import { useReveal, useScrollVar } from '../brand/motion.ts';
import { useEffectsEnabled } from '../brand/effects.ts';
import '../brand/editorial.css';

const FLOW = (['ver', 'practicar', 'jugar', 'repaso'] as const).map((k, i) => ({ k, n: i + 1, ...STEP_META[k] }));
const FLOW_TEXT: Record<(typeof FLOW)[number]['k'], string> = {
  ver: 'Abre la presentación de la Lektion y recorre los ejemplos con calma.',
  practicar: 'Preguntas sin reloj de los temas de esa clase. Los fallos vuelven a salir.',
  jugar: 'Wort-Jenga, BlackCard o Boxen Arena: lo aprendido, en juego con tu clase.',
  repaso: 'Comprueba tus «Ich kann…» y marca la Lektion como completada.',
};

const GAMES = [
  { id: 'jenga', ...GAME_INFO.jenga, de: 'Bau den Turm', text: 'Saca un bloque, responde bien y la torre aguanta. Elige los temas de la clase.', tag: 'Multijugador · temas a elegir' },
  { id: 'jugar', ...GAME_INFO.jugar, de: 'Das Klassenspiel', text: 'El quiz de clase con cartas negras, cofres y podio. El profesor abre la sala.', tag: 'Sala de clase · código' },
  { id: 'boxeo', ...GAME_INFO.boxeo, de: 'Repaso de Dativ y Akkusativ', text: 'Combate de repaso: dos jugadores responden casos y Wo/Wohin; acertar desbloquea golpes.', tag: '1 contra 1 · casos' },
] as const;

/** Arm the visible headline only after the actual intro overlay has left the DOM.
 * Content is visible by default; only the short, explicitly armed entrance adds motion.
 */
export function watchEditorialEntrance(root: HTMLElement, effectsEnabled: boolean): () => void {
  root.dataset.editorialEnter = 'static';
  const doc = root.ownerDocument;
  const win = doc.defaultView;
  if (!win || !effectsEnabled || typeof win.MutationObserver !== 'function' || typeof win.requestAnimationFrame !== 'function') return () => {};
  let frame = 0;
  let stopped = false;
  const blocked = () => doc.hidden || doc.documentElement.classList.contains('dt-intro-lock') || !!doc.querySelector('[data-intro]');
  const detach = () => {
    win.cancelAnimationFrame(frame);
    observer.disconnect();
    doc.removeEventListener('visibilitychange', sync);
  };
  const sync = () => {
    if (stopped) return;
    if (blocked()) {
      win.cancelAnimationFrame(frame);
      frame = 0;
      root.dataset.editorialEnter = 'waiting';
      return;
    }
    if (frame) return;
    // Give Intro's mount effects and the browser a frame to establish their lock.
    frame = win.requestAnimationFrame(() => {
      frame = win.requestAnimationFrame(() => {
        frame = 0;
        if (blocked() || stopped) { sync(); return; }
        root.dataset.editorialEnter = 'play';
        stopped = true;
        detach();
      });
    });
  };
  const observer = new win.MutationObserver(sync);
  observer.observe(doc.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  doc.addEventListener('visibilitychange', sync);
  sync();
  return () => { stopped = true; detach(); root.dataset.editorialEnter = 'static'; };
}

/** Touch browsers do not consistently apply :active to links. Keep a local,
 * passive pointer signal; never capture the pointer or prevent a scrolling gesture. */
export function bindEditorialPress(root: HTMLElement, effectsEnabled: boolean): () => void {
  const doc = root.ownerDocument, win = doc.defaultView;
  if (!win || !effectsEnabled) return () => {};
  let pressed: HTMLElement | null = null;
  const clear = () => { if (pressed) delete pressed.dataset.editorialPressed; pressed = null; };
  const press = (event: PointerEvent) => {
    if (event.button !== 0 || event.isPrimary === false) return;
    const target = (event.target as Element | null)?.closest?.<HTMLElement>('.dt-btn, .dt-card, .dt-game, .dt-rail-item a');
    if (!target || !root.contains(target)) return;
    clear();
    pressed = target;
    pressed.dataset.editorialPressed = 'true';
  };
  root.addEventListener('pointerdown', press, { passive: true });
  root.addEventListener('pointerleave', clear, { passive: true });
  win.addEventListener('pointerup', clear, { passive: true });
  win.addEventListener('pointercancel', clear, { passive: true });
  win.addEventListener('blur', clear);
  doc.addEventListener('visibilitychange', clear);
  return () => {
    clear();
    root.removeEventListener('pointerdown', press);
    root.removeEventListener('pointerleave', clear);
    win.removeEventListener('pointerup', clear);
    win.removeEventListener('pointercancel', clear);
    win.removeEventListener('blur', clear);
    doc.removeEventListener('visibilitychange', clear);
  };
}

export function Landing() {
  const root = useRef<HTMLElement>(null);
  const effectsEnabled = useEffectsEnabled();
  const { done } = useCourseProgress();
  useReveal(root, []);
  useScrollVar(root);
  useEffect(() => {
    if (!root.current) return;
    const stopEntrance = watchEditorialEntrance(root.current, effectsEnabled);
    const stopPress = bindEditorialPress(root.current, effectsEnabled);
    return () => { stopEntrance(); stopPress(); };
  }, [effectsEnabled]);
  const next = nextStep(done);
  const overall = overallProgress(done);
  const started = overall.done > 0;
  const cta = next ? { href: '/curso#' + next.unit.id, label: started ? `Continuar · Lektion ${next.unit.n}` : 'Empezar el curso' } : { href: '/curso', label: 'Ver mi curso completo' };

  return (
    <main className="dt-landing dt-editorial" data-editorial-enter="static" ref={root}>
      {/* ── Hero ── */}
      <section className="dt-hero" aria-labelledby="hero-title">
        <div className="dt-hero-copy">
          <p className="dt-eyebrow" data-editorial-support style={{ '--d': '0ms' } as CSSProperties}><span className="dt-led" /> A1 → B1 · Deutsch für dich</p>
          <h1 id="hero-title" className="dt-hero-title">
            <span className="dt-editorial-line">
              <span className="dt-editorial-mask"><span data-editorial-word style={{ '--word': 0 } as CSSProperties}>Aprende</span></span>{' '}
              <span className="dt-editorial-mask"><span data-editorial-word style={{ '--word': 1 } as CSSProperties}>alemán</span></span>
            </span>{' '}
            <span className="dt-editorial-line dt-editorial-underlined">
              <span className="dt-editorial-mask"><span data-editorial-word style={{ '--word': 2 } as CSSProperties}>paso</span></span>{' '}
              <span className="dt-editorial-mask"><span data-editorial-word style={{ '--word': 3 } as CSSProperties}>a</span></span>{' '}
              <span className="dt-editorial-mask"><span data-editorial-word style={{ '--word': 4 } as CSSProperties}>paso<b className="dt-punkt">.</b></span></span>
            </span>{' '}
            <span className="dt-editorial-line dt-hero-de" lang="de">
              <span className="dt-editorial-mask"><span data-editorial-word style={{ '--word': 5 } as CSSProperties}>Schritt</span></span>{' '}
              <span className="dt-editorial-mask"><span data-editorial-word style={{ '--word': 6 } as CSSProperties}>für</span></span>{' '}
              <span className="dt-editorial-mask"><span data-editorial-word style={{ '--word': 7 } as CSSProperties}>Schritt.</span></span>
            </span>
          </h1>
          <p className="dt-hero-sub" data-editorial-support style={{ '--d': '300ms' } as CSSProperties}>
            {COURSE.length - 1} Lektionen en orden y un examen final. En cada clase sigues siempre el mismo camino: <b>ver</b>, <b>practicar</b>, <b>jugar</b> y <b>repasar</b>.
          </p>
          <div className="dt-hero-cta" data-editorial-support style={{ '--d': '400ms' } as CSSProperties}>
            <MagneticLink href={cta.href}>{cta.label} <span aria-hidden="true">→</span></MagneticLink>
            <MagneticLink href="/practica" variant="ghost">Practicar ahora</MagneticLink>
          </div>
          <ul className="dt-hero-facts" data-editorial-support style={{ '--d': '500ms' } as CSSProperties} aria-label="El curso en datos">
            <li><b className="dotnum">{COURSE.length - 1}</b><span>Lektionen</span></li>
            <li><b className="dotnum">4</b><span>pasos por clase</span></li>
            <li><b className="dotnum">3</b><span>juegos</span></li>
          </ul>
        </div>
        <div className="dt-hero-visual"><Hero3D /></div>
      </section>

      {/* ── Continúa donde lo dejaste ── */}
      <section className="dt-resume" aria-labelledby="resume-title" data-reveal>
        <div className="dt-resume-main">
          <ProgressRing pct={overall.pct} size={92} stroke={7} label={`Curso completado al ${overall.pct}%`}>
            <b className="dotnum">{overall.pct}</b><small>%</small>
          </ProgressRing>
          <div className="dt-resume-text">
            <p className="dt-eyebrow">{started ? 'Continúa donde lo dejaste' : 'Tu primer paso'}</p>
            {next ? <>
              <h2 id="resume-title">Lektion {next.unit.n} · {next.unit.title}</h2>
              <p><span className="dt-step-pill">{next.step.n}/{next.unit.steps.length} · {next.step.title}</span> <span className="dim" lang="de">{next.step.de}</span></p>
            </> : <>
              <h2 id="resume-title">Kurs geschafft! Has completado el curso.</h2>
              <p className="dim">Repite cualquier Lektion o practica lo que quieras.</p>
            </>}
          </div>
          <div className="dt-resume-actions">
            {next && <MagneticLink href={next.step.primary.href} external={next.step.primary.external}>{next.step.primary.label} <span aria-hidden="true">→</span></MagneticLink>}
            <a className="dt-link" href="/curso" onClick={followLearningLink}>Ver todo el curso</a>
          </div>
        </div>
        <aside className="dt-resume-points" aria-label="Puntos de la semana"><WeeklyPointsSlot compact /></aside>
      </section>

      {/* ── Cómo es cada clase ── */}
      <section className="dt-section" aria-labelledby="flow-title">
        <header className="dt-section-head" data-reveal>
          <p className="dt-eyebrow">So läuft jede Stunde</p>
          <h2 id="flow-title">Cada clase, el mismo camino<b className="dt-punkt">.</b></h2>
          <p>Sin perderte entre presentaciones: abre la Lektion que toca y sigue los cuatro pasos.</p>
        </header>
        <ol className="dt-flow">
          {FLOW.map((s) => (
            <li key={s.k} className={`dt-flow-step k-${s.k}`} data-reveal style={{ '--d': `${s.n * 90}ms` } as CSSProperties}>
              <span className="dt-flow-n dotnum">0{s.n}</span>
              <h3>{s.title}</h3>
              <p className="dt-flow-de" lang="de">{s.de}</p>
              <p>{FLOW_TEXT[s.k]}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Ruta ── */}
      <section className="dt-section" aria-labelledby="route-title">
        <header className="dt-section-head row-head" data-reveal>
          <div>
            <p className="dt-eyebrow">Dein Weg · tu ruta</p>
            <h2 id="route-title">De «Hallo» al examen<b className="dt-punkt">.</b></h2>
          </div>
          <MagneticLink href="/curso" variant="ghost">Abrir el curso <span aria-hidden="true">→</span></MagneticLink>
        </header>
        <ol className="dt-rail" data-reveal>
          {COURSE.map((u) => {
            const st = unitStatus(u, done), p = unitProgress(u, done);
            return (
              <li key={u.id} className={`dt-rail-item is-${st}`}>
                <a href={`/curso#${u.id}`} onClick={followLearningLink} aria-label={`Lektion ${u.n}: ${u.title}. ${p.done} de ${p.total} pasos.`}>
                  <span className="dt-rail-n dotnum">{u.exam ? 'B1' : String(u.n).padStart(2, '0')}</span>
                  <span className="dt-rail-title">{u.title.split(' · ')[0]}</span>
                  <span className="dt-rail-bar" style={{ '--p': `${p.pct}%` } as CSSProperties} aria-hidden="true" />
                  {st === 'current' && <span className="dt-rail-now">Ahora</span>}
                </a>
              </li>
            );
          })}
        </ol>
      </section>

      {/* ── Accesos ── */}
      <section className="dt-section" aria-labelledby="access-title">
        <header className="dt-section-head" data-reveal>
          <p className="dt-eyebrow">Schnellzugriff</p>
          <h2 id="access-title">¿Qué quieres hacer hoy?</h2>
        </header>
        <div className="dt-access">
          <a className="dt-card dt-card-course" href="/curso" onClick={followLearningLink} data-reveal>
            <span className="dt-card-k">01 · Kurs</span>
            <h3>Curso</h3>
            <p>Las {COURSE.length - 1} Lektionen en orden, con tu progreso y el siguiente paso marcado.</p>
            <span className="dt-card-go" aria-hidden="true">→</span>
          </a>
          <a className="dt-card dt-card-practice" href="/practica" onClick={followLearningLink} data-reveal style={{ '--d': '80ms' } as CSSProperties}>
            <span className="dt-card-k">02 · Üben</span>
            <h3>Practicar</h3>
            <p>Todo el banco de preguntas sin tiempo; elige temas o repasa tus errores.</p>
            <span className="dt-card-go" aria-hidden="true">→</span>
          </a>
          <a className="dt-card dt-card-road" href="/road-to-b1" onClick={followLearningLink} data-reveal style={{ '--d': '160ms' } as CSSProperties}>
            <span className="dt-card-k">03 · Prüfung</span>
            <h3>Road to B1</h3>
            <p>Simulacro de 105 minutos: lectura, dictado y audición, guiado por el profesor.</p>
            <span className="dt-card-go" aria-hidden="true">→</span>
          </a>
        </div>
      </section>

      <section className="dt-section dt-games" id="juegos" aria-labelledby="games-title" tabIndex={-1}>
        <header className="dt-section-head" data-reveal>
          <p className="dt-eyebrow">Spiele · juegos de clase</p>
          <h2 id="games-title">Juega con lo que aprendes<b className="dt-punkt">.</b></h2>
          <p>Los juegos son multijugador: el profesor abre la sala y entras con tu nombre y el código.</p>
        </header>
        <div className="dt-games-grid">
          {GAMES.map((g, i) => (
            <a key={g.id} className={`dt-game g-${g.id}`} href={g.href} onClick={followLearningLink} data-reveal style={{ '--d': `${i * 90}ms` } as CSSProperties}>
              <GameArt id={g.id} />
              <span className="dt-game-tag">{g.tag}</span>
              <h3>{g.label}</h3>
              <p className="dt-game-de">{g.de}</p>
              <p>{g.text}</p>
              <span className="dt-game-cta">Jugar <span aria-hidden="true">→</span></span>
            </a>
          ))}
        </div>
      </section>

      <footer className="dt-footer" data-reveal>
        <Wordmark height={54} className="dt-footer-mark" />
        <p lang="de">Viel Spaß beim Lernen.</p>
        <IntroReplayButton />
        <nav className="dt-footer-links" aria-label="Pie de página">
          <a href="/curso" onClick={followLearningLink}>Curso</a>
          <a href="/tema/1" onClick={followLearningLink}>Biblioteca de materiales</a>
          <a href="/tema/1/taller" onClick={followLearningLink}>Taller de escritura</a>
          <a href="/profesor" onClick={followLearningLink}>Profesor</a>
        </nav>
      </footer>
    </main>
  );
}

/** Ilustraciones de juego dibujadas en código (SVG), en los colores de marca. */
function GameArt({ id }: { id: 'jenga' | 'jugar' | 'boxeo' }) {
  if (id === 'jenga') return (
    // Torre de Jenga vista de frente: capas alternas (un bloque largo / tres testas); un bloque dorado sale.
    <svg className="dt-game-art" viewBox="0 0 120 70" aria-hidden="true">
      <path d="M30 64 H90" stroke="#3a3a36" strokeWidth="1.5" strokeLinecap="round" />
      {[0, 1, 2, 3, 4, 5].map((r) => {
        const y = 52 - r * 9.4;
        if (r % 2 === 0) return <rect key={r} x="42" y={y} width="36" height="8.6" rx="1.6" fill={r === 4 ? '#2b2b28' : '#232321'} stroke="#3d3d38" strokeWidth="0.8" />;
        return [0, 2].map((c) => <rect key={`${r}${c}`} x={42 + c * 12.1} y={y} width="11.8" height="8.6" rx="1.6" fill="#1c1c1a" stroke="#3d3d38" strokeWidth="0.8" />)
          .concat(r === 3 ? [] : [<rect key={`${r}1`} x={54.1} y={y} width="11.8" height="8.6" rx="1.6" fill="#1c1c1a" stroke="#3d3d38" strokeWidth="0.8" />]);
      })}
      <rect x="54.1" y={52 - 3 * 9.4} width="11.8" height="8.6" rx="1.6" fill="#0A0A0A" opacity="0.65" />
      <g className="pull"><rect x="76" y={52 - 3 * 9.4 - 2} width="26" height="8.6" rx="1.6" fill="#E9B949" stroke="#A87C1E" strokeWidth="0.8" transform="rotate(-8 89 28)" /><text x="89" y={52 - 3 * 9.4 + 3.6} textAnchor="middle" className="t blk" transform="rotate(-8 89 28)">das</text></g>
      <circle cx="96" cy="12" r="2.4" fill="#FF3832" />
    </svg>
  );
  if (id === 'jugar') return (
    <svg className="dt-game-art" viewBox="0 0 120 90" aria-hidden="true">
      <rect x="22" y="14" width="40" height="56" rx="6" fill="#1d1d1b" stroke="#3a3a36" transform="rotate(-10 42 42)" />
      <rect x="54" y="12" width="40" height="56" rx="6" fill="#0A0A0A" stroke="#FF3832" strokeWidth="1.5" transform="rotate(8 74 40)" className="card" />
      <g transform="rotate(8 74 40)" fill="#FF3832">{[0, 1, 2, 3, 4].map((i) => <circle key={i} cx={66 + (i % 3) * 8} cy={32 + Math.floor(i / 3) * 8} r="2.4" />)}</g>
      <circle cx="74" cy="58" r="3" fill="#E9B949" transform="rotate(8 74 40)" />
    </svg>
  );
  // Pareja de guantes enfrentados: cuff con ribete crema, puño más ancho que el cuff, pulgar pegado al lateral.
  return (
    <svg className="dt-game-art" viewBox="0 0 120 70" aria-hidden="true">
      {[0, 1, 2].map((i) => <path key={i} d={`M8 ${24 + i * 12} H112`} stroke={i === 1 ? '#FF3832' : '#2a2a27'} strokeWidth="1.6" />)}
      <g className="glove l"><Glove fill="#FF3832" deep="#B3201B" /></g>
      <g transform="translate(120 0) scale(-1 1)"><g className="glove r"><Glove fill="#E9B949" deep="#A87C1E" /></g></g>
      <path d="M58 30 L62 34 M62 30 L58 34" stroke="#F2F1EE" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

/** Guante de boxeo mirando a la derecha, en la caja 10..56 × 12..60. */
function Glove({ fill, deep }: { fill: string; deep: string }) {
  return <g stroke="#0A0A0A" strokeWidth="1.6" strokeLinejoin="round">
    {/* cuff */}
    <path d="M12 30 C12 27 14 26 17 26 L27 26 L27 52 L17 52 C14 52 12 51 12 48 Z" fill={deep} />
    <path d="M24 26 L29 26 L29 52 L24 52 Z" fill="#F2F1EE" />
    <path d="M15 33 L22 37 M22 33 L15 37 M15 41 L22 45 M22 41 L15 45" stroke="#F2F1EE" strokeWidth="1.1" />
    {/* puño */}
    <path d="M28 22 C30 13 44 10 51 16 C57 21 57 33 54 41 C51 49 43 53 35 52 L29 52 L28 22 Z" fill={fill} />
    {/* nudillos */}
    <path d="M45 15.5 C49 19 51 25 51 31" fill="none" stroke={deep} strokeWidth="1.3" strokeLinecap="round" />
    {/* pulgar a lo largo del lateral, punta hacia delante */}
    <path d="M31 40 C35 36 45 36 49 40 C51 43 49 47 45 47 L33 47 C30 47 29 43 31 40 Z" fill={fill} />
    <path d="M33 43 C38 41.5 43 41.5 46 43" fill="none" stroke={deep} strokeWidth="1.2" strokeLinecap="round" />
  </g>;
}
