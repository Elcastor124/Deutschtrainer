// /curso — Ruta del curso como globo 3D (CSS 3D, sin WebGL): cada Lektion es un nodo en la órbita del planeta;
// al elegir una, el globo gira hasta ponerla delante y el panel muestra lo esencial: presentación, práctica y repaso.
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { COURSE, nextStep, overallProgress, unitProgress, unitStatus, type CourseStep, type CourseUnit } from '../course.ts';
import { TOPICS } from '../../shared/rules.ts';
import { followLearningLink } from '../components/LearningNav.tsx';
import { ProgressRing } from '../brand/ProgressRing.tsx';
import { useCourseProgress } from '../brand/progress.ts';
import '../course-globe.css';

const STATUS_LABEL = { done: 'Completada', current: 'Ahora', started: 'Empezada', todo: 'Pendiente' } as const;
const STEP = 360 / COURSE.length;
const TILT = 16;
const code = (u: CourseUnit) => (u.exam ? 'B1' : String(u.n).padStart(2, '0'));
const shortTitle = (u: CourseUnit) => u.title.split(' · ')[0];

function initialIndex(nextUnit?: string): number {
  const hash = typeof location !== 'undefined' ? (location.hash ?? '').slice(1) : '';
  const byHash = COURSE.findIndex((u) => u.id === hash);
  if (byHash >= 0) return byHash;
  const byNext = COURSE.findIndex((u) => u.id === nextUnit);
  return byNext >= 0 ? byNext : 0;
}

export function Course() {
  const { done, toggle } = useCourseProgress();
  const next = nextStep(done);
  const overall = overallProgress(done);
  const [sel, setSel] = useState(() => initialIndex(next?.unit.id));
  const unit = COURSE[sel];
  const choose = (i: number) => {
    const n = (i + COURSE.length) % COURSE.length;
    setSel(n);
    try { history.replaceState(null, '', `#${COURSE[n].id}`); } catch { /* sin historial (SSR/tests) */ }
  };

  return (
    <main className="dt-page cg-page">
      <header className="cg-head">
        <div>
          <p className="dt-eyebrow">Dein Kurs · A1 → B1</p>
          <h1>Tu curso<b className="dt-punkt">.</b></h1>
        </div>
        <div className="cg-summary">
          <ProgressRing pct={overall.pct} size={76} stroke={6} label={`Curso completado al ${overall.pct}%`}><b className="dotnum">{overall.pct}</b><small>%</small></ProgressRing>
          <div>
            <p className="cg-mono">{overall.done}/{overall.total} pasos</p>
            {next
              ? <button type="button" className="cg-next" onClick={() => choose(COURSE.indexOf(next.unit))}>Siguiente: Lektion {next.unit.n} · {next.step.title} →</button>
              : <p className="cg-mono">Kurs geschafft!</p>}
          </div>
          <a className="dt-btn dt-btn-ghost sm" href="/biblioteca" onClick={followLearningLink}><span className="dt-btn-label">Biblioteca</span></a>
        </div>
      </header>

      <div className="cg-layout">
        <section className="cg-globe-col" aria-label="Mapa del curso">
          <Globe sel={sel} done={done} onSelect={choose} />
          <ol className="cg-rail" aria-label="Lektionen">
            {COURSE.map((u, i) => {
              const st = unitStatus(u, done);
              return <li key={u.id}>
                <button type="button" className={`cg-chip s-${st}${i === sel ? ' on' : ''}`} aria-current={i === sel ? 'step' : undefined} onClick={() => choose(i)}>
                  <b className="dotnum">{code(u)}</b><span>{shortTitle(u)}</span>
                </button>
              </li>;
            })}
          </ol>
        </section>
        <UnitPanel key={unit.id} unit={unit} done={done} next={next?.step.id} onToggle={toggle} onPrev={() => choose(sel - 1)} onNext={() => choose(sel + 1)} />
      </div>
    </main>
  );
}

function Globe({ sel, done, onSelect }: { sel: number; done: ReadonlySet<string>; onSelect: (i: number) => void }) {
  // Rotación acumulada (no se normaliza) para que el globo gire siempre por el camino corto.
  const [rot, setRot] = useState(() => -sel * STEP);
  const [drag, setDrag] = useState<{ x: number; rot: number } | null>(null);
  const [live, setLive] = useState<number | null>(null);
  const moved = useRef(false);
  useEffect(() => {
    setRot((r) => { const target = -sel * STEP; const d = ((((target - r) % 360) + 540) % 360) - 180; return r + d; });
  }, [sel]);
  const angle = live ?? rot;

  const down = (e: PointerEvent<HTMLDivElement>) => { if (e.button !== 0) return; moved.current = false; setDrag({ x: e.clientX, rot: angle }); };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 4 && !moved.current) { moved.current = true; e.currentTarget.setPointerCapture(e.pointerId); }
    if (moved.current) setLive(drag.rot + dx * 0.35);
  };
  const up = () => {
    if (drag && moved.current && live !== null) {
      const i = Math.round(-live / STEP);
      setRot(live); setLive(null);
      onSelect(((i % COURSE.length) + COURSE.length) % COURSE.length);
    }
    setDrag(null);
  };
  const key = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); onSelect(sel + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); onSelect(sel - 1); }
  };

  return (
    <div className={`cg-stage${live !== null ? ' is-drag' : ''}`} tabIndex={0} role="group" aria-roledescription="globo" aria-label="Globo del curso: usa las flechas para cambiar de Lektion"
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key}>
      <div className="cg-stars" aria-hidden="true" />
      <div className="cg-world" style={{ '--rot': `${angle}deg`, '--tilt': `${-TILT}deg` } as CSSProperties}>
        <div className="cg-planet" aria-hidden="true" />
        {[0, 30, 60, 90, 120, 150].map((d) => <i key={`m${d}`} className="cg-mer" style={{ '--d': `${d}deg` } as CSSProperties} />)}
        {[-60, -30, 30, 60].map((l) => <i key={`p${l}`} className="cg-par" style={{ '--lat': `${l}deg`, '--c': Math.cos((l * Math.PI) / 180), '--s': Math.sin((l * Math.PI) / 180) } as CSSProperties} />)}
        <i className="cg-orbit" />
        {COURSE.map((u, i) => {
          const a = i * STEP;
          const facing = Math.cos(((a + angle) * Math.PI) / 180); // 1 = de frente, -1 = detrás
          const st = unitStatus(u, done);
          const p = unitProgress(u, done);
          return (
            <button key={u.id} type="button" tabIndex={-1} aria-hidden="true"
              className={`cg-node s-${st}${i === sel ? ' on' : ''}${facing < -0.15 ? ' back' : ''}`}
              style={{ '--a': `${a}deg`, '--face': `${-(a + angle)}deg`, '--depth': (facing + 1) / 2, zIndex: Math.round((facing + 1) * 50) } as CSSProperties}
              onClick={() => { if (!moved.current) onSelect(i); }}>
              <span className="cg-node-dot"><b className="dotnum">{code(u)}</b></span>
              <span className="cg-node-label">{shortTitle(u)}<small>{p.done}/{p.total}</small></span>
            </button>
          );
        })}
      </div>
      <p className="cg-hint" aria-hidden="true">Arrastra o usa ← →</p>
    </div>
  );
}

function UnitPanel({ unit, done, next, onToggle, onPrev, onNext }: { unit: CourseUnit; done: ReadonlySet<string>; next?: string; onToggle: (id: string, on?: boolean) => void; onPrev: () => void; onNext: () => void }) {
  const st = unitStatus(unit, done);
  const p = unitProgress(unit, done);
  return (
    <article className={`cg-panel s-${st}`} id={unit.id} aria-labelledby={`${unit.id}-t`}>
      <header className="cg-panel-head">
        <span className="cg-big dotnum" aria-hidden="true">{code(unit)}</span>
        <div className="cg-titles">
          <p className="dt-eyebrow">{unit.exam ? 'Final' : `Lektion ${unit.n}`} · {unit.level} <span className={`dt-status s-${st}`}>{STATUS_LABEL[st]}</span></p>
          <h2 id={`${unit.id}-t`}>{unit.title}</h2>
          <p className="cg-de" lang="de">«{unit.de}»</p>
        </div>
        <ProgressRing pct={p.pct} size={58} stroke={5} label={`${p.done} de ${p.total} pasos`}><b>{p.done}</b><small>/{p.total}</small></ProgressRing>
      </header>
      <p className="cg-sum">{unit.summary}</p>
      <ul className="cg-topics" aria-label="Temas">{unit.topics.map((t) => <li key={t}><b lang="de">{TOPICS[t].de}</b><span>{TOPICS[t].es}</span></li>)}</ul>
      <ol className="cg-steps">
        {unit.steps.map((s) => <StepTile key={s.id} step={s} unit={unit} isDone={done.has(s.id)} isNext={next === s.id} onToggle={onToggle} />)}
      </ol>
      <nav className="cg-pager" aria-label="Cambiar de Lektion">
        <button type="button" className="dt-btn dt-btn-ghost sm" onClick={onPrev}><span className="dt-btn-label">← Anterior</span></button>
        <button type="button" className="dt-btn dt-btn-ghost sm" onClick={onNext}><span className="dt-btn-label">Siguiente Lektion →</span></button>
      </nav>
    </article>
  );
}

function StepTile({ step, unit, isDone, isNext, onToggle }: { step: CourseStep; unit: CourseUnit; isDone: boolean; isNext: boolean; onToggle: (id: string, on?: boolean) => void }) {
  const cbId = `step-${step.id.replace(':', '-')}`;
  const ext = (x: { external?: boolean }) => (x.external ? { target: '_blank', rel: 'noopener noreferrer' } : {});
  return (
    <li className={`cg-step k-${step.kind}${isDone ? ' is-done' : ''}${isNext ? ' is-next' : ''}`}>
      <div className="cg-step-top">
        <span className="cg-step-n dotnum" aria-hidden="true">{String(step.n).padStart(2, '0')}</span>
        <h3>{step.title} <span lang="de">· {step.de}</span></h3>
        {isNext && <span className="dt-next-badge">Siguiente</span>}
      </div>
      {step.kind === 'repaso' && unit.goals.length
        ? <ul className="cg-goals" aria-label="Ich kann…">{unit.goals.map((g) => <li key={g}>{g}</li>)}</ul>
        : <p>{step.desc}</p>}
      <div className="cg-step-actions">
        <a className={`dt-btn ${isNext || step.kind === 'ver' ? 'dt-btn-primary' : 'dt-btn-ghost'} sm`} href={step.primary.href} onClick={followLearningLink} {...ext(step.primary)}><span className="dt-btn-label">{step.primary.label} →</span></a>
        {step.extra.map((x) => <a key={x.href + x.label} className="dt-link" href={x.href} onClick={followLearningLink} {...ext(x)}>{x.label}</a>)}
        <label className="dt-check" htmlFor={cbId}>
          <input id={cbId} type="checkbox" checked={isDone} onChange={(e) => onToggle(step.id, e.target.checked)} />
          <span className="dt-check-box" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3.5 8.5 6.5 11.5 12.5 4.5" /></svg></span>
          <span className="dt-check-label">{isDone ? 'Hecho' : 'Marcar hecho'}<span className="sr">: Lektion {unit.n}, {step.title}</span></span>
        </label>
      </div>
    </li>
  );
}
