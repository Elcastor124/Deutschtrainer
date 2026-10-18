import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { PLAN_MIN } from '../../shared/rules.ts';
import { VOCAB, isNoun } from '../../shared/vocab.ts';
import { sfx } from '../fx/sound.ts';
import { navigate, store } from '../util.ts';

const WORDS = VOCAB.filter((v) => isNoun(v.de) || v.de.length <= 14);

/** Pantalla de puntos: una palabra alemana cada pocos segundos, con su artículo en rojo. */
function Matrix() {
  const [i, setI] = useState(() => Math.floor(Math.random() * WORDS.length));
  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 7) % WORDS.length), 2600);
    return () => clearInterval(id);
  }, []);
  const w = WORDS[i];
  const m = /^(der|die|das) (.*)$/.exec(w.de);
  const chars = [...(m ? m[2] : w.de)];
  return (
    <div className="matrix" aria-live="off">
      <div>
        <div className="matrix-word" key={i} lang="de">
          {m && <span className="art" style={{ '--i': 0 } as CSSProperties}>{m[1]}&nbsp;</span>}
          {chars.map((c, k) => <span key={k} style={{ '--i': k + 1 } as CSSProperties}>{c === ' ' ? ' ' : c}</span>)}
        </div>
        <div className="matrix-es" key={`es${i}`}>{w.es}</div>
      </div>
      <div className="matrix-meta">
        <span>Wort {String(i + 1).padStart(3, '0')}/{WORDS.length}</span>
        <span>A1–A2 · {PLAN_MIN} min</span>
      </div>
    </div>
  );
}

export function Home() {
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('sala')?.toUpperCase() ?? '');
  const [name, setName] = useState(() => store.get('bc:name') ?? '');
  const last = store.get('bc:last-teacher');
  const join = (e: FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!c || !name.trim()) return;
    sfx.lock();
    store.set('bc:name', name.trim());
    navigate(`/p/${c}`);
  };
  const ticker = VOCAB.filter((v) => isNoun(v.de)).slice(0, 40);
  return (
    <div className="home">
      <h1 className="home-title">DEUTSCH TRAINER<b>// BLACKCARD</b></h1>
      <Matrix />
      <p className="home-sub">Una clase de alemán convertida en partida: lectura, vocabulario, gramática y frases. Cada respuesta suma, los cofres dan objetos para atacar o defenderse, y la BlackCard lo arriesga todo. Después del juego, a escribir.</p>
      <div className="home-grid">
        <section className="panel home-card">
          <h2><span className="idx">01</span>Profesor</h2>
          <p>Crea una sala y proyecta tu pantalla. Los alumnos entran con el código.</p>
          <button className="btn primary lg" onClick={() => { sfx.lock(); navigate('/t/new'); }}>Crear sala</button>
          {last && <button className="btn" onClick={() => navigate(`/t/${last}`)}>Volver a la sala {last}</button>}
        </section>
        <form className="panel home-card" onSubmit={join}>
          <h2><span className="idx">02</span>Alumno</h2>
          <p>Escribe el código que ves en el proyector y tu nombre.</p>
          <input className="field big dotnum" style={{ letterSpacing: '0.2em', textTransform: 'uppercase' }} placeholder="CÓDIGO" maxLength={5}
            value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} aria-label="Código de sala" autoComplete="off" />
          <input className="field" placeholder="Tu nombre" maxLength={16} value={name} onChange={(e) => setName(e.target.value)} aria-label="Tu nombre" />
          <button className="btn primary lg" disabled={!code.trim() || !name.trim()}>Entrar en la sala</button>
        </form>
        <section className="panel home-card">
          <h2><span className="idx">03</span>Práctica en casa</h2>
          <p>Juega solo, sin tiempo. Primero salen las palabras y frases que fallaste en clase.</p>
          <button className="btn lg" onClick={() => navigate('/practica')}>Practicar</button>
        </section>
      </div>
      <div className="ticker" aria-hidden="true">
        <div className="ticker-track">
          {[...ticker, ...ticker].map((v, k) => <span key={k}><b>{v.de}</b>{v.es}</span>)}
        </div>
      </div>
    </div>
  );
}
