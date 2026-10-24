// /jugar (BlackCard) y /jenga (Wort-Jenga): el profesor elige temas y crea la sala; los alumnos entran con el código.
import { useState, type FormEvent } from 'react';
import { PLAN_MIN, TOPICS, blockDef } from '../../shared/rules.ts';
import type { GameStart, Topic } from '../../shared/types.ts';
import { sfx } from '../fx/sound.ts';
import { navigate, store } from '../util.ts';
import { topicsFromQuery } from './Practice.tsx';
import '../gamesetup.css';

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
  const toggle = (t: Topic) => setTopics((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]));
  // En el Jenga no hay preguntas de lectura (necesitan el texto delante).
  const list = (Object.keys(TOPICS) as Topic[]).filter((t) => mode !== 'jenga' || t !== 'lesen');
  const join = (e: FormEvent) => {
    e.preventDefault();
    const k = code.trim().toUpperCase();
    if (!k || !name.trim()) return;
    sfx.lock();
    store.set('bc:name', name.trim());
    navigate(`/p/${k}`);
  };
  return (
    <div className="home game-setup" data-mode={mode}>
      <h1 className="home-title">{c.title}<b>// {c.sub}</b></h1>
      <p className="home-sub">{c.lead}</p>
      <div className="home-grid">
        <section className="panel home-card" aria-labelledby="gs-teacher">
          <h2 id="gs-teacher"><span className="idx">01</span>Profesor</h2>
          <fieldset className="gs-topics">
            <legend>Temas <span className="dim">({topics.length ? `${topics.length} elegido${topics.length > 1 ? 's' : ''}` : 'sin marcar = todos'})</span></legend>
            <div className="chips">
              {list.map((t) => (
                <button key={t} type="button" className={`btn sm${topics.includes(t) ? ' on' : ''}`} aria-pressed={topics.includes(t)} title={TOPICS[t].es} onClick={() => toggle(t)}>{TOPICS[t].de}</button>
              ))}
            </div>
            {topics.length > 0 && <button type="button" className="btn ghost sm" onClick={() => setTopics([])}>Quitar temas</button>}
          </fieldset>
          <button className="btn primary lg" onClick={() => { sfx.lock(); navigate(setupTarget(mode, topics)); }}>{c.create}</button>
          {last && <button className="btn" onClick={() => navigate(`/t/${last}`)}>Volver a la sala {last}</button>}
        </section>
        <form className="panel home-card" onSubmit={join} aria-labelledby="gs-student">
          <h2 id="gs-student"><span className="idx">02</span>Alumno</h2>
          <p>Escribe el código que ves en el proyector y tu nombre.</p>
          <input className="field big dotnum" style={{ letterSpacing: '0.2em', textTransform: 'uppercase' }} placeholder="CÓDIGO" maxLength={5}
            value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} aria-label="Código de sala" autoComplete="off" />
          <input className="field" placeholder="Tu nombre" maxLength={16} value={name} onChange={(e) => setName(e.target.value)} aria-label="Tu nombre" />
          <button className="btn primary lg" disabled={!code.trim() || !name.trim()}>Entrar en la sala</button>
        </form>
        <section className="panel home-card">
          <h2><span className="idx">03</span>{mode === 'jenga' ? 'Otros juegos' : 'Práctica en casa'}</h2>
          {mode === 'jenga' ? (
            <>
              <p>¿Prefieres el quiz por rondas con cofres y objetos?</p>
              <button className="btn lg" onClick={() => navigate(`/jugar${topics.length ? `?temas=${topics.join(',')}` : ''}`)}>BlackCard por temas</button>
            </>
          ) : (
            <>
              <p>Practica a tu ritmo, sin tiempo. Cada sesión trae preguntas nuevas y repasa tus errores.</p>
              <button className="btn lg" onClick={() => navigate(`/practica?tema=1${topics.length ? `&temas=${topics.join(',')}` : ''}`)}>Practicar</button>
              <button className="btn" onClick={() => navigate(`/jenga${topics.length ? `?temas=${topics.join(',')}` : ''}`)}>Wort-Jenga directo</button>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
