import { useEffect, useState, type CSSProperties } from 'react';
import { CHESTS, PLAN, SOURCES, TOPICS, blockDef } from '../../shared/rules.ts';
import type { ErrorEntry, FinalPlayer, RoomView, Topic } from '../../shared/types.ts';
import { burst } from '../fx/particles.ts';
import { sfx } from '../fx/sound.ts';
import { Counter, Stars } from './bits.tsx';
import { CHEST_ROWS, DotGlyph } from './Glyph.tsx';
import { Leaderboard } from './Leaderboard.tsx';
import { Question } from './Question.tsx';
import { Reading } from './Reading.tsx';

/** Título que se enciende letra a letra, como una pantalla de puntos. */
export function DotTitle({ text, className = '' }: { text: string; className?: string }) {
  return (
    <h1 className={`dot-title ${className}`} aria-label={text}>
      {[...text].map((c, i) => <span key={i} aria-hidden="true" style={{ '--i': i } as CSSProperties}>{c === ' ' ? ' ' : c}</span>)}
    </h1>
  );
}

export function Intro({ view }: { view: RoomView }) {
  const def = blockDef(view.block);
  if (!def) return null;
  const i = PLAN.findIndex((b) => b.id === def.id);
  return (
    <section className={`intro act${def.act}`}>
      <div className="intro-idx">
        <span className="big-n">{String(i + 1).padStart(2, '0')}</span>
        <span>Akt {def.act === 1 ? 'I · das Spiel' : 'II · nach dem Spiel'}<br />{def.min} min</span>
      </div>
      <DotTitle text={def.name} />
      <p className="sub">{def.sub}</p>
      <ol className="brief">{def.brief.map((b, k) => <li key={b} style={{ '--i': k } as CSSProperties}>{b}</li>)}</ol>
      {def.id === 'lesen' && <div className="panel reading-panel"><Reading id={view.reading} /></div>}
    </section>
  );
}

const TIER_COLOR = { bronze: '#B9763F', silver: '#CFCFCB', gold: '#E9B949', black: '#FF3832' } as const;

export function RoundEnd({ view }: { view: RoomView }) {
  const re = view.roundEnd;
  const def = blockDef(re?.block ?? null);
  const next = PLAN[PLAN.findIndex((b) => b.id === re?.block) + 1];
  const task = def?.kind === 'task';
  return (
    <section className={`intro round-end act${def?.act ?? 1}`}>
      <div className="intro-idx"><span className="big-n">✓</span><span>Fin del bloque<br />{def?.name}</span></div>
      <div className="re-grid">
        <div className="panel"><Leaderboard players={view.players} me={view.me?.id} stars={task} /></div>
        {re && re.rewards.length > 0 && (
          <div className="panel stack">
            <b className="label">Recompensa de ronda: un cofre para cada uno</b>
            <div className="re-chests">
              {re.rewards.map((r, k) => (
                <div key={r.pid} className={`re-chest t-${r.tier}`} style={{ '--k': k, color: TIER_COLOR[r.tier] } as CSSProperties}>
                  <DotGlyph rows={CHEST_ROWS} className="cg" color="currentColor" dim="transparent" />
                  <b>{view.players.find((p) => p.id === r.pid)?.name}</b>
                  <small>{CHESTS[r.tier].de}</small>
                </div>
              ))}
            </div>
            <p className="dim small">Quien va último recibe plata: la partida sigue abierta.</p>
          </div>
        )}
        {re?.stars && (
          <div className="panel stack">
            <b className="label">Estrellas de esta actividad</b>
            {re.stars.map((s) => (
              <div key={s.pid} className="star-row"><span>{view.players.find((p) => p.id === s.pid)?.name}</span><Stars n={s.n} /></div>
            ))}
          </div>
        )}
      </div>
      {next && <p className="sub">Siguiente: <b>{next.name}</b> · {next.min} min</p>}
    </section>
  );
}

const VERDICT = { correct: 'Richtig!', wrong: 'Falsch', none: 'Zu spät' } as const;

/** Resultado de la pregunta para un alumno. */
export function MyReveal({ view }: { view: RoomView }) {
  const r = view.reveal;
  const me = view.me;
  if (!r) return null;
  const mine = me ? r.results[me.id] : undefined;
  const q = view.q;
  const mcMark = q?.type === 'mc' && q.options ? { right: q.options.indexOf(r.solution), mine: mine ? q.options.indexOf(mine.given) : undefined } : null;
  return (
    <section className="reveal-me" aria-live="polite">
      {r.skipped ? <div className="alert calm">El profesor ha anulado esta pregunta. Los objetos usados se han devuelto.</div> : mine && (
        <div className={`verdict ${mine.status === 'correct' ? 'ok' : 'ko'}`}>
          <span className="big" data-text={VERDICT[mine.status]}>{VERDICT[mine.status]}</span>
          <span className={`delta${mine.delta < 0 ? ' neg' : ''}`}>{mine.delta > 0 ? `+${mine.delta}` : mine.delta < 0 ? `${mine.delta}` : '±0'}</span>
        </div>
      )}
      {mine && mine.lines.length > 0 && <div className="receipt-lines">{mine.lines.map((l, i) => <span key={i} style={{ '--i': i } as CSSProperties}>{l}</span>)}</div>}
      {mine?.note && <p className="note">{mine.note}</p>}
      {q && mcMark && <Question q={q} mode="display" mark={mcMark} />}
      {mine && mine.status !== 'correct' && !mcMark && <p className="given"><span>Tu respuesta</span><s lang="de">{mine.given}</s></p>}
      {!mcMark && <div className="solution" lang="de">{r.solution}</div>}
      <div className="explain">{r.explain}</div>
    </section>
  );
}

/** Corrección proyectada: quién eligió qué (tipo concurso), solución y resultado de cada alumno. */
export function ClassReveal({ view }: { view: RoomView }) {
  const r = view.reveal;
  if (!r) return null;
  const q = view.q;
  let mark: { right: number; picks: Record<number, string[]> } | null = null;
  if (q?.type === 'mc' && q.options) {
    const picks: Record<number, string[]> = {};
    for (const p of view.players) {
      const x = r.results[p.id];
      const i = x ? q.options.indexOf(x.given) : -1;
      if (i >= 0) (picks[i] ??= []).push(p.name);
    }
    mark = { right: q.options.indexOf(r.solution), picks };
  }
  return (
    <section className="stack class-reveal">
      {r.skipped && <div className="alert calm">Pregunta anulada: no cuenta y se han devuelto los objetos.</div>}
      {q && mark ? <Question q={q} mode="display" mark={mark} /> : <div className="solution" lang="de">{r.solution}</div>}
      <div className="explain">{r.explain}</div>
      {!r.skipped && (
        <div className="res-rows">
          {view.players.map((p, k) => {
            const x = r.results[p.id];
            if (!x) return null;
            return (
              <div key={p.id} data-res={p.id} className={`res-row ${x.status === 'correct' ? 'ok' : 'ko'}`} style={{ '--k': k } as CSSProperties}>
                <span className="mk">{x.status === 'correct' ? '✓' : '✗'}</span>
                <b>{p.name}</b>
                <span className="given" lang="de">{x.given}{x.lines.length ? <small>{x.lines.join(' · ')}</small> : null}</span>
                <b className={`d${x.delta < 0 ? ' neg' : ''}`}>{x.delta > 0 ? `+${x.delta}` : x.delta}</b>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function WildPicker({ view, onPick }: { view: RoomView; onPick?: (t: Topic) => void }) {
  const w = view.wild;
  if (!w) return null;
  const mine = view.me?.id === w.by;
  const who = view.players.find((p) => p.id === w.by)?.name ?? '¿?';
  return (
    <section className="intro wild">
      <div className="intro-idx"><span className="big-n">?</span><span>WILDCARD<br />{mine ? 'tú eliges' : `elige ${who}`}</span></div>
      <DotTitle text={mine ? 'Elige categoría' : `${who} elige…`} />
      <div className="wild-opts">
        {w.options.map((t, k) => (
          <button key={t} className="wild-card" style={{ '--k': k } as CSSProperties} disabled={!mine} onClick={() => { sfx.lock(); onPick?.(t); }}>
            <span className="wc-de">{TOPICS[t].de}</span>
            <span className="wc-es">{TOPICS[t].es}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function ErrorCards({ list }: { list: (ErrorEntry & { count?: number; names?: string[] })[] }) {
  if (!list.length) return <p className="dim">Ningún error que repasar. Sehr gut!</p>;
  return (
    <div className="errlist">
      {list.map((e) => (
        <div key={e.qid} className="errcard">
          <span className="p">{e.prompt}</span>
          <span className="s" lang="de">✓ {e.solution}</span>
          {e.names ? <span className="g">Fallada por: {e.names.join(', ')}</span> : <span className="g">Tu respuesta: {e.given}</span>}
          <span className="x">{e.explain}</span>
          <small className="dim">{TOPICS[e.topic].de} · {SOURCES[e.src].name}</small>
        </div>
      ))}
    </div>
  );
}

/** Ticket de caja (Kassenbon) con la partida de cada alumno: en alemán, para leerlo en clase. */
function Kassenbon({ p, k }: { p: FinalPlayer; k: number }) {
  const date = new Date().toLocaleDateString('de-DE');
  const rows: [string, string][] = [
    ['Richtige Antworten', `${p.correct}/${p.total}`],
    ['Beste Serie', String(p.best)],
    ['BlackCard gewonnen', String(p.bcWon)],
    ['BlackCard verloren', String(p.bcLost)],
    ['Gegenstände benutzt', String(p.itemsUsed)],
    ['Punkte gestohlen', String(p.stolen)],
  ];
  return (
    <div className="bon" style={{ '--k': k } as CSSProperties}>
      <div className="bon-head"><b>DEUTSCH TRAINER</b><span>Kassenbon · {date}</span><span>Kunde: {p.name}</span></div>
      <div className="bon-rows">{rows.map(([a, b]) => <div key={a}><span>{a}</span><span>{b}</span></div>)}</div>
      <div className="bon-sum"><span>SUMME</span><span>{p.score} P</span></div>
      {p.stars > 0 && <div className="bon-rows"><div><span>Sterne (Werkstatt)</span><span>{p.stars} ★</span></div></div>}
      <div className="bon-foot">Platz {p.rank} · Danke fürs Mitspielen!</div>
    </div>
  );
}

/** Escena final: podio, tickets y repaso de errores. En «Feierabend» también las estrellas del taller. */
export function Final({ view, teacher, onPractice }: { view: RoomView; teacher?: boolean; onPractice?: () => void }) {
  const f = view.final;
  const [tab, setTab] = useState<'mine' | 'class'>(teacher ? 'class' : 'mine');
  // Cuando sube el primer puesto del podio: fanfarria y confeti.
  useEffect(() => {
    if (view.mode === 'practice') return;
    const t = setTimeout(() => {
      sfx.fanfare();
      for (let i = 0; i < 3; i++) setTimeout(() => burst(innerWidth * (0.3 + i * 0.2), innerHeight * 0.25, 'confetti', 70), i * 220);
    }, 1900);
    return () => clearTimeout(t);
  }, [view.block]);
  if (!f) return null;
  const practice = view.mode === 'practice';
  const ende = view.block === 'ende';
  const ranked = ende ? [...f.players].sort((a, b) => b.stars - a.stars) : f.players;
  const top = ranked.slice(0, 3);
  const podium = [top[1], top[0], top[2]].filter(Boolean);
  const me = f.players.find((p) => p.id === view.me?.id);
  const heights = [230, 160, 110];
  return (
    <section className="final">
      <div className="spot" aria-hidden="true" />
      {!practice ? (
        <>
          <div className="intro final-head">
            <div className="intro-idx"><span className="big-n">{ende ? '★' : '1'}</span><span>{ende ? 'Feierabend' : 'Siegerehrung'}<br />{ende ? 'resumen del día' : 'el juego'}</span></div>
            <DotTitle text={ranked[0] ? (ende ? `${ranked[0].name}: Werkstatt-Star!` : `${ranked[0].name} gewinnt!`) : 'Fin de la clase'} />
          </div>
          <div className="podium">
            {podium.map((p) => {
              const rank = ranked.indexOf(p) + 1;
              return (
                <div key={p.id} className={`pod${rank === 1 ? ' first' : ''}`} style={{ '--d': `${rank === 1 ? 1.6 : rank === 2 ? 0.9 : 0.3}s`, '--h': `${heights[rank - 1] ?? 90}px` } as CSSProperties}>
                  <span className="nm">{p.name}</span>
                  {ende ? <Stars n={p.stars} className="pod-stars" /> : <Counter className="sc" value={p.score} />}
                  <div className="col">{rank}</div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="intro final-head">
          <div className="intro-idx"><span className="big-n">✓</span><span>Práctica<br />terminada</span></div>
          <DotTitle text={`${view.practice?.correct ?? 0} / ${view.practice?.done ?? 0}`} />
          <p className="sub">Las preguntas falladas volverán a salir primero en tu próxima práctica.</p>
          {onPractice && <div className="row"><button className="btn primary lg" onClick={onPractice}>Otra práctica</button></div>}
        </div>
      )}
      {!practice && <div className="bons">{f.players.map((p, k) => <Kassenbon key={p.id} p={p} k={k} />)}</div>}
      {!ende && (
        <div className="stack">
          <div className="row">
            <h2 className="h2">Repaso de errores</h2>
            {!practice && (
              <div className="row seg-tabs" role="tablist">
                {!teacher && <button role="tab" aria-selected={tab === 'mine'} className={`btn sm${tab === 'mine' ? ' on' : ''}`} onClick={() => setTab('mine')}>Mis errores</button>}
                <button role="tab" aria-selected={tab === 'class'} className={`btn sm${tab === 'class' ? ' on' : ''}`} onClick={() => setTab('class')}>Los más fallados</button>
              </div>
            )}
          </div>
          <ErrorCards list={tab === 'class' && !practice ? f.classErrors : me?.errors ?? f.players[0]?.errors ?? []} />
        </div>
      )}
      {!teacher && view.me?.profileCode && (
        <div className="panel home-practice">
          <b>En casa: modo práctica</b>
          <p className="dim">Entra en <span className="mono">{location.host}/practica</span>. En otro ordenador, escribe tu código de alumno: <b className="dotnum red">{view.me.profileCode}</b></p>
        </div>
      )}
    </section>
  );
}
