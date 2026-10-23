import { followLearningLink } from './LearningNav.tsx';

/** Same-origin link: the game uses the web's own server, never a separate HTML. */
export function BoxingActivity() {
  return <section className="panel learning-feature" aria-labelledby="boxing-title">
    <div className="stack">
      <span className="learning-eyebrow">JUEGO DE REPASO · A1–A2 · MULTIJUGADOR</span>
      <h2 id="boxing-title">Repaso de Dativ y Akkusativ</h2>
      <p><b>Boxen Arena:</b> dos jugadores responden ejercicios de artículos, pronombres, preposiciones y Wo/Wohin. Acertar desbloquea jab, directo, crochet, defensa o esquiva.</p>
      <p className="small dim">El profesor crea la sala y cada alumno entra con su nombre y el código. El combate se abre dentro de esta misma web.</p>
    </div>
    <a className="btn signal lg" href="/boxeo" onClick={followLearningLink}>Jugar al repaso de casos →</a>
  </section>;
}
