// /examenes (y /road-to-b1) — Exámenes de práctica: un bloque por simulacro. Se hacen solos, sin sala;
// el modo de clase con profesor sigue disponible para cada uno.
import { navigate } from '../util.ts';
import '../road-solo.css';

const EXAMS = [
  { n: 1, level: 'A1 / A2', title: 'Die erste Prüfung', href: '/examenes/a1-a2', room: '/road-to-b1/level-1', parts: ['Lesen 30', 'Hören 10', 'Diktat 10'], min: 105, ready: true },
  { n: 2, level: 'A2 / B1', title: 'Próximamente', href: '', room: '', parts: ['Lesen', 'Hören', 'Schreiben'], min: 0, ready: false },
  { n: 3, level: 'B1', title: 'Próximamente', href: '', room: '', parts: ['Lesen', 'Hören', 'Schreiben', 'Sprechen'], min: 0, ready: false },
];
const go = (path: string) => (e: { preventDefault: () => void }) => { e.preventDefault(); navigate(path); };

export function ExamHub() {
  return (
    <main className="dt-page rs-page">
      <header className="rs-head">
        <div>
          <p className="dt-eyebrow">Road to B1 · Prüfungen</p>
          <h1>Exámenes de práctica<b className="dt-punkt">.</b></h1>
          <p className="rs-lead">Simulacros completos para hacer a tu ritmo, sin sala. Corrige lo que lleves cuando quieras y termina para ver tu nota.</p>
        </div>
      </header>
      <ol className="ex-grid">
        {EXAMS.map((x) => (
          <li key={x.n} className={`ex-block${x.ready ? '' : ' is-soon'}`}>
            <span className="ex-n dotnum" aria-hidden="true">{x.n}</span>
            <span className="ex-arrow" aria-hidden="true">→</span>
            <div className="ex-body">
              <p className="ex-level dotnum">{x.level}</p>
              <h2>{x.title}</h2>
              <ul className="ex-parts">{x.parts.map((p) => <li key={p}>{p}</li>)}</ul>
              {x.ready ? <>
                <p className="ex-meta">{x.min} min orientativos · 50 puntos · nota sobre 10</p>
                <div className="ex-actions">
                  <a className="dt-btn dt-btn-primary" href={x.href} onClick={go(x.href)}><span className="dt-btn-label">Empezar el simulacro →</span></a>
                  <a className="dt-link" href={x.room} onClick={go(x.room)}>En clase con profesor</a>
                </div>
              </> : <p className="ex-meta">En preparación</p>}
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}
