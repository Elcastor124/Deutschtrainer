// /juegos — página propia de los juegos de clase (BlackCard, Wort-Jenga, Boxeo). Mismas tarjetas que antes en la portada.
import type { CSSProperties } from 'react';
import { followLearningLink } from '../components/LearningNav.tsx';
import { GAMES, GameArt } from './Landing.tsx';

export function Games() {
  return (
    <main className="dt-page dt-games-page">
      <section className="dt-section dt-games" id="juegos" aria-labelledby="games-title" tabIndex={-1}>
        <header className="dt-section-head">
          <p className="dt-eyebrow">Spiele · juegos de clase</p>
          <h1 id="games-title">Juegos<b className="dt-punkt">.</b></h1>
          <p>Los juegos son multijugador: el profesor abre la sala y entras con tu nombre y el código.</p>
        </header>
        <div className="dt-games-grid">
          {GAMES.map((g, i) => (
            <a key={g.id} className={`dt-game g-${g.id}`} href={g.href} onClick={followLearningLink} style={{ '--d': `${i * 90}ms` } as CSSProperties}>
              <GameArt id={g.id} />
              <span className="dt-game-tag">{g.tag}</span>
              <h3>{g.label}</h3>
              <p className="dt-game-de">{g.de}</p>
              <p>{g.text}</p>
              <span className="dt-game-cta">Jugar <span aria-hidden="true">→</span></span>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
