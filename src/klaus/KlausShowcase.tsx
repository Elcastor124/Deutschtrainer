import { useState } from 'react';
import { KlausPanel, type KlausModel } from './KlausCompanion.tsx';
import { KlausComments, REACTION_LABELS } from './comments.ts';
import type { KlausReaction } from './events.ts';

const STATES: KlausReaction[] = ['waving', 'idle', 'thinking', 'correct', 'support', 'streak3', 'streak5', 'streak10', 'complete'];

/** Internal preview only. Does not construct Net, load solutions, award scores or submit answers. */
export default function KlausShowcase() {
  const [comments] = useState(() => new KlausComments());
  const [sequence, setSequence] = useState(0);
  const [model, setModel] = useState<KlausModel>(() => ({ reaction: 'waving', comment: comments.next('waving'), id: 'preview:0', streak: 0, announce: false }));
  const demonstrate = (reaction: KlausReaction) => {
    const next = sequence + 1;
    setSequence(next);
    setModel({ reaction, comment: comments.next(reaction), id: `preview:${next}`, announce: true,
      streak: reaction === 'streak3' ? 3 : reaction === 'streak5' ? 5 : reaction === 'streak10' ? 10 : 0 });
  };
  return <main className="klaus-showcase" data-klaus-showcase="">
    <header><p className="klaus-wordmark">DEUTSCHTRAINER // CHARACTER LAB</p><h1>Klaus · Vista previa</h1>
      <p>Ensayo de las reacciones del compañero. No cambia tu práctica, tu racha ni tus puntos.</p>
    </header>
    <KlausPanel model={model} />
    <section className="klaus-demo-controls" aria-label="Demostrar reacciones de Klaus">
      {STATES.map((state) => <button key={state} type="button" className="btn" data-klaus-demo={state} aria-pressed={model.reaction === state} onClick={() => demonstrate(state)}>{REACTION_LABELS[state]}</button>)}
    </section>
    <p className="klaus-preview-note">Original de línea · gafas Professor al pensar y animar · Feuer con cinco seguidas · corona Royal con diez y al terminar. Son reacciones visuales, no recompensas ni compras.</p>
    <p className="klaus-preview-note">Pulsa otra vez un estado para oír otro comentario. El sonido empieza desactivado y las preferencias son las mismas que en práctica. También se respeta el movimiento reducido del sistema.</p>
  </main>;
}
