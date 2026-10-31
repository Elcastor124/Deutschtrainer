// /curso — Ruta del curso como camino vertical: cada Lektion abre con un banner y sus pasos son bloques 3D
// unidos por una línea gris que se enciende en rojo neón al completar. Crece hacia abajo: escala a cualquier nº de clases.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { COURSE, STEP_META, nextStep, overallProgress, unitProgress, unitStatus, type CourseStep, type CourseUnit } from '../course.ts';
import { TOPICS } from '../../shared/rules.ts';
import { followLearningLink } from '../components/LearningNav.tsx';
import { ProgressRing } from '../brand/ProgressRing.tsx';
import { useCourseProgress } from '../brand/progress.ts';
import { KlausFigure } from '../klaus/KlausFigure.tsx';
import { useKlausSkin } from '../klaus/skin-client.ts';
import '../course-path.css';

const STATUS_LABEL = { done: 'Completada', current: 'Ahora', started: 'Empezada', todo: 'Pendiente' } as const;
const W = 420;          // ancho lógico del camino
const AMP = 92;         // amplitud del zigzag
const STEP_GAP = 116;   // distancia vertical entre bloques
const BANNER = 178;     // alto reservado para el banner de cada Lektion

type Node = { kind: 'banner'; unit: CourseUnit; y: number } | { kind: 'step'; unit: CourseUnit; step: CourseStep; x: number; y: number; k: number };

/** Posiciones del camino (puras: se calculan una vez). */
function layout(): { nodes: Node[]; height: number } {
  const nodes: Node[] = [];
  let y = 0, k = 0;
  for (const unit of COURSE) {
    nodes.push({ kind: 'banner', unit, y });
    y += BANNER;
    for (const step of unit.steps) {
      nodes.push({ kind: 'step', unit, step, k, x: W / 2 + Math.sin(k * 0.95) * AMP, y: y + 36 });
      y += STEP_GAP; k++;
    }
    y += 26;
  }
  return { nodes, height: y + 40 };
}
const PATH = layout();
const STEPS = PATH.nodes.filter((n): n is Extract<Node, { kind: 'step' }> => n.kind === 'step');

export function Course() {
  const { done, toggle } = useCourseProgress();
  const next = nextStep(done);
  const overall = overallProgress(done);
  const [sel, setSel] = useState<string | null>(() => next?.step.id ?? null);
  const focusUnit = COURSE.find((u) => u.steps.some((s) => s.id === sel)) ?? next?.unit ?? COURSE[0];
  const root = useRef<HTMLDivElement>(null);
  // Al marcar hecho el paso abierto, se abre solo el siguiente recomendado.
  const lastNext = useRef(next?.step.id);
  useEffect(() => {
    if (next && sel === lastNext.current && next.step.id !== sel) setSel(next.step.id);
    lastNext.current = next?.step.id;
  }, [next?.step.id]);

  const reveal = (id: string, smooth = true) => {
    setSel(id);
    const el = root.current?.querySelector(`[data-step="${id}"]`);
    el?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
  };
  useEffect(() => {
    const hash = (location.hash ?? '').slice(1);
    const unit = COURSE.find((u) => u.id === hash);
    const target = unit ? (unit.steps.find((s) => !done.has(s.id)) ?? unit.steps[0]).id : next?.step.id;
    if (target) { const t = setTimeout(() => reveal(target, false), 80); return () => clearTimeout(t); }
  }, []);
  useEffect(() => {
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') setSel(null); };
    addEventListener('keydown', close);
    return () => removeEventListener('keydown', close);
  }, []);

  return (
    <main className="dt-page cp-page">
      <div className="cp-layout">
        <section className="cp-main" aria-labelledby="cp-title">
          <header className="cp-head">
            <p className="dt-eyebrow">Dein Kurs · A1 → B1</p>
            <h1 id="cp-title">Tu curso<b className="dt-punkt">.</b></h1>
          </header>
          <div className="cp-track" ref={root} style={{ height: PATH.height }}>
            <PathLines done={done} />
            {PATH.nodes.map((n) => n.kind === 'banner'
              ? <Banner key={n.unit.id} unit={n.unit} y={n.y} done={done} />
              : <Tile key={n.step.id} n={n} done={done} next={next?.step.id} open={sel === n.step.id} onOpen={() => setSel(sel === n.step.id ? null : n.step.id)} onToggle={toggle} />)}
            {next && <Mascot at={STEPS.find((s) => s.step.id === next.step.id)!} />}
          </div>
        </section>

        <aside className="cp-side" aria-label="Tu progreso">
          <div className="cp-card">
            <div className="cp-progress">
              <ProgressRing pct={overall.pct} size={84} stroke={7} label={`Curso completado al ${overall.pct}%`}><b className="dotnum">{overall.pct}</b><small>%</small></ProgressRing>
              <div>
                <p className="cp-mono">{overall.done}/{overall.total} pasos</p>
                {next
                  ? <button type="button" className="cp-next" onClick={() => reveal(next.step.id)}>Siguiente: Lektion {next.unit.n} · {next.step.title} ↓</button>
                  : <p className="cp-mono">Kurs geschafft!</p>}
              </div>
            </div>
          </div>
          <UnitCard unit={focusUnit} done={done} />
          <a className="cp-lib" href="/biblioteca" onClick={followLearningLink}><span className="dotnum">▤</span><span><b>Biblioteca</b><small>Todas las presentaciones y PDF</small></span><i aria-hidden="true">→</i></a>
        </aside>
      </div>
    </main>
  );
}

/** Línea del camino: gris; los tramos ya recorridos se encienden en rojo neón. */
function PathLines({ done }: { done: ReadonlySet<string> }) {
  const seg = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const my = (a.y + b.y) / 2;
    return `M${a.x} ${a.y + 30}C${a.x} ${my},${b.x} ${my},${b.x} ${b.y + 30}`;
  };
  return (
    <svg className="cp-lines" viewBox={`0 0 ${W} ${PATH.height}`} preserveAspectRatio="none" height={PATH.height} aria-hidden="true" focusable="false">
      <defs><filter id="cp-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
      {STEPS.slice(1).map((b, i) => {
        const a = STEPS[i];
        const lit = done.has(a.step.id) && done.has(b.step.id);
        const half = done.has(a.step.id) && !lit;
        return <path key={b.step.id} d={seg(a, b)} className={lit ? 'lit' : half ? 'half' : ''} filter={lit ? 'url(#cp-glow)' : undefined} />;
      })}
    </svg>
  );
}

function Banner({ unit, y, done }: { unit: CourseUnit; y: number; done: ReadonlySet<string> }) {
  const st = unitStatus(unit, done);
  const p = unitProgress(unit, done);
  return (
    <header className={`cp-banner s-${st}${unit.exam ? ' is-exam' : ''}`} id={unit.id} style={{ top: y }}>
      <span className="cp-banner-n dotnum" aria-hidden="true">{unit.exam ? 'B1' : String(unit.n).padStart(2, '0')}</span>
      <div className="cp-banner-t">
        <p className="dt-eyebrow">{unit.exam ? 'Final' : `Lektion ${unit.n}`} · {unit.level} <span className={`dt-status s-${st}`}>{STATUS_LABEL[st]}</span></p>
        <h2>{unit.title}</h2>
        <p className="cp-de" lang="de">«{unit.de}»</p>
      </div>
      <span className="cp-banner-p cp-mono" aria-label={`${p.done} de ${p.total} pasos`}>{p.done}/{p.total}</span>
    </header>
  );
}

function Tile({ n, done, next, open, onOpen, onToggle }: { n: Extract<Node, { kind: 'step' }>; done: ReadonlySet<string>; next?: string; open: boolean; onOpen: () => void; onToggle: (id: string, on?: boolean) => void }) {
  const { step, unit } = n;
  const isDone = done.has(step.id), isNext = next === step.id;
  const ext = (x: { external?: boolean }) => (x.external ? { target: '_blank', rel: 'noopener noreferrer' } : {});
  const cbId = `step-${step.id.replace(':', '-')}`;
  const pct = (n.x / W) * 100;
  return (<>
    <div className={`cp-node${isDone ? ' is-done' : ''}${isNext ? ' is-next' : ''}${open ? ' is-open' : ''}`} style={{ left: `${pct}%`, top: n.y } as CSSProperties} data-step={step.id}>
      {isNext && <span className="cp-tag" aria-hidden="true">{done.size ? 'Sigue' : 'Empieza'}</span>}
      <button type="button" className={`cp-tile k-${step.kind}`} aria-expanded={open} aria-controls={`${cbId}-pop`} onClick={onOpen}>
        <span className="cp-face"><span className="dotnum" aria-hidden="true">{isDone ? '✓' : STEP_META[step.kind].icon}</span></span>
        <span className="sr">Lektion {unit.n}: {step.title}{isDone ? ' (hecho)' : ''}</span>
      </button>
      <span className="cp-cap" aria-hidden="true">{step.title}</span>
    </div>
      {open && (
        <div className={`cp-pop cg-step${isNext ? ' is-next' : ''}`} id={`${cbId}-pop`} role="dialog" aria-label={`${step.title} · Lektion ${unit.n}`} style={{ left: `clamp(6px, calc(${pct}% - 150px), calc(100% - 306px))`, top: n.y + 112 } as CSSProperties}>
          <p className="cp-mono">Lektion {unit.n} · {step.de}{isNext && <span className="dt-next-badge">Siguiente</span>}</p>
          <h3>{step.title}</h3>
          {step.kind === 'repaso' && unit.goals.length
            ? <ul className="cp-goals" aria-label="Ich kann…">{unit.goals.map((g) => <li key={g}>{g}</li>)}</ul>
            : <p>{step.desc}</p>}
          <div className="cp-pop-actions">
            <a className="dt-btn dt-btn-primary sm" href={step.primary.href} onClick={followLearningLink} {...ext(step.primary)}><span className="dt-btn-label">{step.primary.label} →</span></a>
            {step.extra.map((x) => <a key={x.href + x.label} className="dt-link" href={x.href} onClick={followLearningLink} {...ext(x)}>{x.label}</a>)}
          </div>
          <label className="dt-check" htmlFor={cbId}>
            <input id={cbId} type="checkbox" checked={isDone} onChange={(e) => onToggle(step.id, e.target.checked)} />
            <span className="dt-check-box" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3.5 8.5 6.5 11.5 12.5 4.5" /></svg></span>
            <span className="dt-check-label">{isDone ? 'Hecho' : 'Marcar hecho'}<span className="sr">: Lektion {unit.n}, {step.title}</span></span>
          </label>
        </div>
      )}
  </>);
}

/** Klaus (con la skin del alumno) espera junto al siguiente paso. */
function Mascot({ at }: { at: Extract<Node, { kind: 'step' }> }) {
  const look = useKlausSkin();
  const side = at.x > W / 2 ? -1 : 1;
  return <div className="cp-klaus" style={{ left: `${((W / 2 + side * (AMP + 70)) / W) * 100}%`, top: at.y - 30 } as CSSProperties} aria-hidden="true"><KlausFigure reaction="waving" look={look} /></div>;
}

function UnitCard({ unit, done }: { unit: CourseUnit; done: ReadonlySet<string> }) {
  const p = unitProgress(unit, done);
  const practice = unit.steps.find((s) => s.kind === 'practicar');
  return (
    <section className="cp-card cp-unit" aria-labelledby="cp-unit-t">
      <p className="dt-eyebrow">{unit.exam ? 'Final' : `Lektion ${unit.n}`} · {unit.level} · {p.done}/{p.total}</p>
      <h2 id="cp-unit-t">{unit.title}</h2>
      <p className="cp-sum">{unit.summary}</p>
      <ul className="cp-topics" aria-label="Temas">{unit.topics.map((t) => <li key={t}><b lang="de">{TOPICS[t].de}</b><span>{TOPICS[t].es}</span></li>)}</ul>
      {practice && <a className="dt-btn dt-btn-ghost sm" href={practice.primary.href} onClick={followLearningLink}><span className="dt-btn-label">Practicar esta Lektion →</span></a>}
    </section>
  );
}
