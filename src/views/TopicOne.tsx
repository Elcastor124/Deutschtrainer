import { PLAN } from '../../shared/rules.ts';
import { followLearningLink } from '../components/LearningNav.tsx';
import { STUDY_TOPICS } from './Explore.tsx';
import { Presentations } from '../components/Presentations.tsx';
import { BoxingActivity } from '../components/BoxingActivity.tsx';

export function TopicOne() {
  return (
    <main className="home learning-home">
      <header className="stack">
        <a className="learning-back" href="/" onClick={followLearningLink}>← Explorar</a>
        <p className="learning-eyebrow">RUTA DE ESTUDIO · A1–A2</p>
        <h1 className="home-title">Tema 1<b>// entender y usar</b></h1>
        <p className="home-sub">Nebensätze, Perfekt, Dativ y vocabulario. Revisa las explicaciones y entrena con todo el banco de preguntas preparado.</p>
      </header>
      <section className="stack learning-section" aria-labelledby="path-title">
        <h2 id="path-title">Ruta de estudio</h2>
        <ol className="learning-path">
          <li><b>01 · Comprende</b><span>Repasa los bloques y sus presentaciones.</span></li>
          <li><b>02 · Practica</b><span>Responde sin límite de tiempo; filtra o combina todos los contenidos.</span></li>
          <li><b>03 · Aplica</b><span>Lleva lo aprendido al juego y a los talleres en una sala de clase.</span></li>
        </ol>
      </section>
      <section className="learning-grid learning-topics" aria-label="Contenidos de Tema 1">
        {STUDY_TOPICS.map((topic) => <article className="panel home-card" key={topic.title}><h2 lang="de">{topic.title}</h2><p>{topic.description}</p></article>)}
      </section>
      <Presentations />
      <BoxingActivity />
      <section className="panel learning-feature" aria-labelledby="practice-title">
        <div className="stack">
          <h2 id="practice-title">Practica Tema 1</h2>
          <p>Todo el banco de preguntas está disponible: gramática, vocabulario, comprensión y construcción de frases. Puedes elegir contenidos, repasar errores o continuar tu sesión.</p>
          <p className="small dim">La práctica individual y las salas necesitan conexión con el servidor.</p>
        </div>
        <a className="btn signal lg" href="/practica?tema=1" onClick={followLearningLink}>Empezar a practicar →</a>
      </section>
      <section className="panel learning-feature" aria-labelledby="personal-workshop-title">
        <div className="stack"><h2 id="personal-workshop-title">Taller personal</h2><p>Practica reescritura, historias con palabras dadas, escritura libre y ensayo de escenas con los materiales originales. Borradores locales y listas de autoevaluación, sin notas automáticas.</p></div>
        <a className="btn signal lg" href="/tema/1/taller" onClick={followLearningLink}>Practicar escritura y escenas →</a>
      </section>
      <section className="stack learning-section" aria-labelledby="workshops-title">
        <h2 id="workshops-title">Actividades en clase</h2>
        <p className="home-sub">Las versiones multijugador de estos talleres requieren una sala y la coordinación del profesor. Para ensayar por tu cuenta, utiliza el taller personal de arriba.</p>
        <div className="learning-grid">{PLAN.filter((block) => block.kind === 'task').map((block) => (
          <article className="panel home-card" key={block.id}>
            <span className="learning-eyebrow">TALLER EN SALA · {block.min} MIN</span>
            <h3>{block.name}</h3><p>{block.sub}</p><p>{block.brief[0]}</p>
            <a className="btn" href="/jugar" onClick={followLearningLink}>Entrar en una sala</a>
          </article>
        ))}</div>
      </section>
    </main>
  );
}
