import { followLearningLink } from '../components/LearningNav.tsx';

export const STUDY_TOPICS = [
  { title: 'Nebensätze', description: 'Conecta ideas con weil, obwohl, dass y wenn. Coloca el verbo al final.' },
  { title: 'Perfekt', description: 'Cuenta lo que has hecho: haben o sein + Partizip II.' },
  { title: 'Dativ', description: 'Repasa artículos, preposiciones y situaciones del día a día.' },
  { title: 'Vocabulario', description: 'Aprende palabras con su artículo y úsalas en contexto.' },
];

export function Explore() {
  return (
    <main className="home learning-home">
      <header className="stack">
        <p className="learning-eyebrow">TU ESPACIO DE ALEMÁN · A1–A2</p>
        <h1 className="home-title">Explorar<b>// a tu ritmo</b></h1>
        <p className="home-sub">Entiende, practica y vuelve a intentarlo. Todo el material preparado de la clase, en un mismo lugar.</p>
      </header>
      <section className="panel learning-feature" aria-labelledby="tema-title">
        <div className="stack">
          <span className="learning-eyebrow">RUTA DE APRENDIZAJE · DISPONIBLE</span>
          <h2 id="tema-title">Tema 1</h2>
          <p>Nebensätze, Perfekt, Dativ y vocabulario: de las explicaciones a la práctica.</p>
          <div className="chips">{STUDY_TOPICS.map((topic) => <span className="badge" key={topic.title}>{topic.title}</span>)}</div>
        </div>
        <div className="stack">
          <a className="btn signal lg" href="/tema/1" onClick={followLearningLink}>Explorar Tema 1 →</a>
          <a className="btn" href="/practica?tema=1" onClick={followLearningLink}>Ir a la práctica</a>
        </div>
      </section>
      <section className="learning-grid" aria-label="Qué quieres hacer">
        <article className="panel home-card">
          <span className="learning-eyebrow">01 · COMPRENDER</span>
          <h2>Presentaciones y apuntes</h2>
          <p>Abre las explicaciones de clase y repasa los ejemplos antes de practicar.</p>
          <a className="btn" href="/tema/1" onClick={followLearningLink}>Ver materiales</a>
        </article>
        <article className="panel home-card">
          <span className="learning-eyebrow">02 · ENTRENAR</span>
          <h2>Práctica individual</h2>
          <p>Todo el banco de preguntas, filtros por contenido y repaso de errores. Puedes continuar una sesión pendiente.</p>
          <a className="btn" href="/practica?tema=1" onClick={followLearningLink}>Practicar Tema 1</a>
        </article>
        <article className="panel home-card">
          <span className="learning-eyebrow">03 · COMPARTIR</span>
          <h2>Juego y talleres en clase</h2>
          <p>Entra en una sala para el juego, la escritura, las escenas y Wort-Jenga con tu profesor.</p>
          <a className="btn" href="/jugar" onClick={followLearningLink}>Jugar en clase</a>
        </article>
      </section>
    </main>
  );
}
