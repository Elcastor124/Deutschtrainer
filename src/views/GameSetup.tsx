// /jugar (BlackCard) y /jenga (Wort-Jenga): el profesor elige temas y crea la sala; los alumnos entran con el código.
import { useState, type FormEvent } from 'react';
import { PLAN_MIN, blockDef } from '../../shared/rules.ts';
import type { GameStart, Topic } from '../../shared/types.ts';
import { sfx } from '../fx/sound.ts';
import { navigate, store } from '../util.ts';
import { topicsFromQuery } from './Practice.tsx';
import '../gamesetup.css';
import { TopicPicker } from '../components/TopicPicker.tsx';
import { KlausCompanion } from '../klaus/KlausCompanion.tsx';

/** URL del profesor que crea la sala con esos temas y ese juego (la lee teacherHello). */
export function setupTarget(mode: GameStart, topics: Topic[]): string {
  const q = new URLSearchParams();
  if (mode === 'jenga') q.set('juego', 'jenga');
  if (topics.length) q.set('temas', topics.join(','));
  const s = q.toString().replace(/%2C/g, ',');
  return `/t/new${s ? `?${s}` : ''}`;
}

const COPY: Record<GameStart, { title: string; sub: string; lead: string; create: string }> = {
  blackcard: {
    title: 'BLACKCARD', sub: 'juego de clase',
    lead: `Quiz por rondas con cofres, objetos y la BlackCard (${PLAN_MIN} min con el plan completo). Elige temas para que las rondas se centren en ellos; sin marcar, se usa todo el banco.`,
    create: 'Crear sala',
  },
  jenga: {
    title: 'WORT-JENGA', sub: 'la torre de preguntas',
    lead: `${blockDef('jenga')?.brief.join(' ') ?? ''} La sala empieza directamente en el Jenga, sin el resto de la clase.`,
    create: 'Crear sala de Wort-Jenga',
  },
};

export function GameSetup({ mode }: { mode: 'blackcard' | 'jenga' }) {
  const search = typeof location !== 'undefined' ? location.search : '';
  const [topics, setTopics] = useState<Topic[]>(() => topicsFromQuery(search));
  const [code, setCode] = useState(() => new URLSearchParams(search).get('sala')?.toUpperCase() ?? '');
  const [name, setName] = useState(() => store.get('bc:name') ?? '');
  const last = store.get('bc:last-teacher');
  const c = COPY[mode];
  const join = (e: FormEvent) => {
    e.preventDefault();
    const k = code.trim().toUpperCase();
    if (!k || !name.trim()) return;
    sfx.lock();
    store.set('bc:name', name.trim());
    navigate(`/p/${k}`);
  };
  return (
    <div className="setup-stage game-setup" data-mode={mode}>
      <div className="setup-main">
        <header className="setup-head">
          <h1>{c.title} <b>// {c.sub}</b></h1>
          <p>{c.lead}</p>
        </header>
        <section className="panel stack" aria-labelledby="gs-teacher">
          <h2 id="gs-teacher" className="sr">Profesor</h2>
          <TopicPicker value={topics} onChange={setTopics} exclude={mode === 'jenga' ? ['lesen'] : []} />
          <div className="setup-go">
            <button className="btn primary lg" onClick={() => { sfx.lock(); navigate(setupTarget(mode, topics)); }}>{c.create} →</button>
            {last && <button className="btn" onClick={() => navigate(`/t/${last}`)}>Volver a la sala {last}</button>}
            <span className="libre-note">Para el profesor: crea la sala y proyecta el código.</span>
          </div>
        </section>
        <div className="setup-row">
          <form className="panel" onSubmit={join} aria-labelledby="gs-student">
            <h2 id="gs-student">¿Eres alumno? Entra con el código</h2>
            <div className="setup-bar">
              <input className="field dotnum" style={{ flex: '0 1 140px', letterSpacing: '0.2em', textTransform: 'uppercase' }} placeholder="CÓDIGO" maxLength={5}
                value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} aria-label="Código de sala" autoComplete="off" />
              <input className="field" style={{ flex: '1 1 140px' }} placeholder="Tu nombre" maxLength={16} value={name} onChange={(e) => setName(e.target.value)} aria-label="Tu nombre" />
              <button className="btn primary" disabled={!code.trim() || !name.trim()}>Entrar en la sala</button>
            </div>
          </form>
          <section className="panel">
            <h2>{mode === 'jenga' ? 'Otros juegos' : 'Sin profesor'}</h2>
            <div className="setup-links">
              {mode === 'jenga'
                ? <button className="btn" onClick={() => navigate(`/jugar${topics.length ? `?temas=${topics.join(',')}` : ''}`)}>BlackCard por temas</button>
                : <>
                  <button className="btn" onClick={() => navigate(`/practica?tema=1${topics.length ? `&temas=${topics.join(',')}` : ''}`)}>Practicar</button>
                  <button className="btn" onClick={() => navigate(`/jenga${topics.length ? `?temas=${topics.join(',')}` : ''}`)}>Wort-Jenga directo</button>
                </>}
              <a className="btn ghost" href="/libre" onClick={(e) => { e.preventDefault(); navigate('/libre'); }}>Modo libre</a>
            </div>
          </section>
        </div>
      </div>
      <aside className="setup-side"><KlausCompanion /></aside>
    </div>
  );
}
