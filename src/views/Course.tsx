import { useEffect, useRef, type CSSProperties } from 'react';
import { COURSE, nextStep, overallProgress, unitProgress, unitStatus, type CourseStep, type CourseUnit } from '../course.ts';
import { TOPICS } from '../../shared/rules.ts';
import { followLearningLink } from '../components/LearningNav.tsx';
import { MagneticLink } from '../brand/MagneticLink.tsx';
import { ProgressRing } from '../brand/ProgressRing.tsx';
import { useCourseProgress } from '../brand/progress.ts';
import { useReveal } from '../brand/motion.ts';

const STATUS_LABEL = { done: 'Completada', current: 'Ahora', started: 'Empezada', todo: 'Pendiente' } as const;

export function Course() {
  const root = useRef<HTMLElement>(null);
  const { done, toggle } = useCourseProgress();
  useReveal(root, []);
  const next = nextStep(done);
  const overall = overallProgress(done);
  useEffect(() => {
    const id = location.hash.slice(1);
    if (!id) return;
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <main className="dt-page dt-course" ref={root}>
      <header className="dt-page-head">
        <div>
          <p className="dt-eyebrow">Dein Kurs · A1 → B1</p>
          <h1>Tu curso<b className="dt-punkt">.</b></h1>
          <p className="dt-lead">Las Lektionen van en orden. Dentro de cada una, sigue los pasos <b>1 → 4</b> y márcalos al terminar. El progreso se guarda en este dispositivo.</p>
        </div>
        <div className="dt-course-summary">
          <ProgressRing pct={overall.pct} size={112} stroke={8} label={`Curso completado al ${overall.pct}%`}><b className="dotnum">{overall.pct}</b><small>%</small></ProgressRing>
          <div>
            <p className="dt-eyebrow">{overall.done} de {overall.total} pasos</p>
            {next ? <>
              <p className="dt-next-label">Siguiente paso recomendado</p>
              <a className="dt-next-link" href={`#${next.unit.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(next.unit.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
                Lektion {next.unit.n} · {next.step.title} <span aria-hidden="true">↓</span>
              </a>
            </> : <p className="dt-next-label">Kurs geschafft! Todo completado.</p>}
          </div>
        </div>
      </header>

      <ol className="dt-units">
        {COURSE.map((u) => <UnitCard key={u.id} unit={u} done={done} next={next?.step.id} onToggle={toggle} />)}
      </ol>

      <aside className="dt-course-foot" data-reveal>
        <p>¿Buscas un material suelto? Todas las presentaciones y PDF están en la <a href="/tema/1" onClick={followLearningLink}>biblioteca de materiales</a>.</p>
      </aside>
    </main>
  );
}

function UnitCard({ unit, done, next, onToggle }: { unit: CourseUnit; done: ReadonlySet<string>; next?: string; onToggle: (id: string, on?: boolean) => void }) {
  const st = unitStatus(unit, done);
  const p = unitProgress(unit, done);
  return (
    <li className={`dt-unit is-${st}${unit.exam ? ' is-exam' : ''}`} id={unit.id} data-reveal aria-labelledby={`${unit.id}-t`}>
      <div className="dt-unit-rail" aria-hidden="true"><span className="dotnum">{unit.exam ? 'B1' : String(unit.n).padStart(2, '0')}</span></div>
      <div className="dt-unit-body">
        <header className="dt-unit-head">
          <div className="dt-unit-titles">
            <p className="dt-eyebrow">{unit.exam ? 'Final' : `Lektion ${unit.n}`} · {unit.level} <span className={`dt-status s-${st}`}>{STATUS_LABEL[st]}</span></p>
            <h2 id={`${unit.id}-t`}>{unit.title}</h2>
            <p className="dt-unit-de" lang="de">«{unit.de}»</p>
            <p className="dt-unit-sum">{unit.summary}</p>
            <ul className="dt-topics" aria-label="Temas">{unit.topics.map((t) => <li key={t} lang="de">{TOPICS[t].de}</li>)}</ul>
          </div>
          <ProgressRing pct={p.pct} size={64} stroke={5} label={`Lektion ${unit.n}: ${p.done} de ${p.total} pasos`}><b>{p.done}</b><small>/{p.total}</small></ProgressRing>
        </header>
        <ol className="dt-steps">
          {unit.steps.map((s) => <StepRow key={s.id} step={s} unit={unit} isDone={done.has(s.id)} isNext={next === s.id} onToggle={onToggle} />)}
        </ol>
      </div>
    </li>
  );
}

function StepRow({ step, unit, isDone, isNext, onToggle }: { step: CourseStep; unit: CourseUnit; isDone: boolean; isNext: boolean; onToggle: (id: string, on?: boolean) => void }) {
  const cbId = `step-${step.id.replace(':', '-')}`;
  return (
    <li className={`dt-step k-${step.kind}${isDone ? ' is-done' : ''}${isNext ? ' is-next' : ''}`} style={{ '--n': step.n } as CSSProperties}>
      <span className="dt-step-n dotnum" aria-hidden="true">{step.n}</span>
      <div className="dt-step-text">
        <h3>{step.title} <span className="dt-step-de" lang="de">· {step.de}</span>{isNext && <span className="dt-next-badge">Siguiente</span>}</h3>
        <p>{step.kind === 'repaso' && unit.goals.length ? <>Puedo… {unit.goals.join(' · ')}</> : step.desc}</p>
        <div className="dt-step-links">
          {isNext
            ? <MagneticLink href={step.primary.href} external={step.primary.external}>{step.primary.label} <span aria-hidden="true">→</span></MagneticLink>
            : <a className="dt-btn dt-btn-ghost sm" href={step.primary.href} onClick={followLearningLink} {...(step.primary.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}><span className="dt-btn-label">{step.primary.label}</span></a>}
          {step.extra.map((x) => (
            <a key={x.href + x.label} className="dt-link" href={x.href} onClick={followLearningLink} {...(x.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{x.label}</a>
          ))}
        </div>
      </div>
      <label className="dt-check" htmlFor={cbId}>
        <input id={cbId} type="checkbox" checked={isDone} onChange={(e) => onToggle(step.id, e.target.checked)} />
        <span className="dt-check-box" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3.5 8.5 6.5 11.5 12.5 4.5" /></svg></span>
        <span className="dt-check-label">{isDone ? 'Hecho' : 'Marcar hecho'}<span className="sr">: Lektion {unit.n}, paso {step.n}, {step.title}</span></span>
      </label>
    </li>
  );
}
