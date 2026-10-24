import { followLearningLink } from './LearningNav.tsx';

export function RoadActivity() {
 return <section className="panel learning-feature" aria-labelledby="road-title">
  <div className="stack">
   <span className="learning-eyebrow">ROAD TO B1 · LEVEL 1 · 105 MIN</span>
   <h2 id="road-title" lang="de">Die erste Prüfung</h2>
   <p>Lectura, dictado y audición en una sesión guiada por el profesor. Respuestas guardadas, corrección por fases y resultados sobre 50 puntos.</p>
   <p className="small dim">Simulacro pedagógico original A1–A2 inspirado en formatos B1. No es un examen oficial ni una certificación Goethe.</p>
  </div>
  <a className="btn signal lg" href="/road-to-b1" onClick={followLearningLink}>Abrir Road to B1 →</a>
 </section>;
}
