import { useState, type FormEvent } from 'react';
import { navigate, store } from '../util.ts';

export function Home() {
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('sala')?.toUpperCase() ?? '');
  const [name, setName] = useState(() => store.get('bc:name') ?? '');
  const last = store.get('bc:last-teacher');
  const join = (e: FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!c || !name.trim()) return;
    store.set('bc:name', name.trim());
    navigate(`/p/${c}`);
  };
  return (
    <div className="home">
      <h1 className="home-title">DEUTSCH TRAINER<b>// BLACKCARD</b></h1>
      <p className="home-sub">Quiz de alemán A1–A2 para una clase de 105 minutos: lectura, vocabulario, gramática y frases. Cada respuesta suma puntos, los objetos añaden estrategia y la BlackCard lo arriesga todo.</p>
      <div className="home-grid">
        <section className="panel home-card">
          <h2>Profesor</h2>
          <p>Crea una sala y proyecta tu pantalla. Los alumnos entran con el código.</p>
          <button className="btn primary lg" onClick={() => navigate('/t/new')}>Crear sala</button>
          {last && <button className="btn" onClick={() => navigate(`/t/${last}`)}>Volver a la sala {last}</button>}
        </section>
        <form className="panel home-card" onSubmit={join}>
          <h2>Alumno</h2>
          <p>Escribe el código que ves en el proyector y tu nombre.</p>
          <input className="field big dot" style={{ letterSpacing: '0.2em', textTransform: 'uppercase' }} placeholder="CÓDIGO" maxLength={5}
            value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} aria-label="Código de sala" autoComplete="off" />
          <input className="field" placeholder="Tu nombre" maxLength={16} value={name} onChange={(e) => setName(e.target.value)} aria-label="Tu nombre" />
          <button className="btn primary lg" disabled={!code.trim() || !name.trim()}>Entrar en la sala</button>
        </form>
        <section className="panel home-card">
          <h2>Práctica en casa</h2>
          <p>Juega solo, sin tiempo. Primero salen las palabras y frases que fallaste en clase.</p>
          <button className="btn lg" onClick={() => navigate('/practica')}>Practicar</button>
        </section>
      </div>
    </div>
  );
}
