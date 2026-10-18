import { useState, type CSSProperties } from 'react';
import { PLAN, SOURCES, TOPICS, blockDef } from '../../shared/rules.ts';
import type { ErrorEntry, RoomView, Topic } from '../../shared/types.ts';
import { ItemCard } from './Inventory.tsx';
import { Leaderboard } from './Leaderboard.tsx';
import { Reading } from './Reading.tsx';
import { Counter } from './bits.tsx';

export function Intro({ view }: { view: RoomView }) {
  const def = blockDef(view.block);
  if (!def) return null;
  const i = PLAN.findIndex((b) => b.id === def.id);
  return (
    <section className="intro">
      <span className="idx">Bloque {i + 1} de {PLAN.length} · {def.min} min</span>
      <h1>{def.name}</h1>
      <p className="sub">{def.sub}</p>
      <ul>{def.brief.map((b) => <li key={b}>{b}</li>)}</ul>
      {def.id === 'lesen' && <div className="panel"><Reading /></div>}
    </section>
  );
}

export function RoundEnd({ view }: { view: RoomView }) {
  const re = view.roundEnd;
  const def = blockDef(re?.block ?? null);
  const next = PLAN[PLAN.findIndex((b) => b.id === re?.block) + 1];
  return (
    <section className="intro">
      <span className="idx">Fin de bloque</span>
      <h1>{def?.name}</h1>
      <div className="teacher" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
        <div className="panel"><Leaderboard players={view.players} me={view.me?.id} /></div>
        {re && re.rewards.length > 0 && (
          <div className="panel stack">
            <b>Recompensa de ronda: un objeto para cada uno</b>
            <div className="cards">
              {re.rewards.map((r) => (
                <div key={r.pid} className="stack" style={{ gap: 6 }}>
                  <ItemCard item={r.item} />
                  <small className="dim">{view.players.find((p) => p.id === r.pid)?.name}</small>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {next && <p className="sub">Siguiente: {next.name} · {next.min} min</p>}
    </section>
  );
}

/** Resultado de la pregunta para un alumno. */
export function MyReveal({ view }: { view: RoomView }) {
  const r = view.reveal;
  const me = view.me;
  if (!r) return null;
  const mine = me ? r.results[me.id] : undefined;
  return (
    <section className="stack" aria-live="polite">
      {r.skipped ? <div className="alert calm">El profesor ha anulado esta pregunta. Los objetos usados se han devuelto.</div> : mine && (
        <div className={`verdict ${mine.status === 'correct' ? 'ok' : 'ko'}`}>
          <span className="big">{mine.status === 'correct' ? 'Richtig!' : mine.status === 'none' ? 'Sin respuesta' : 'Falsch'}</span>
          <span className="delta">{mine.delta > 0 ? `+${mine.delta}` : mine.delta < 0 ? `${mine.delta}` : '±0'}</span>
        </div>
      )}
      {mine && mine.lines.length > 0 && <div className="lines">{mine.lines.map((l, i) => <span key={i}>{l}</span>)}</div>}
      {mine?.note && <p className="dim" style={{ margin: 0 }}>{mine.note}</p>}
      {mine && mine.status !== 'correct' && <p style={{ margin: 0 }}><span className="dim">Tu respuesta:</span> <span className="red">{mine.given}</span></p>}
      <div className="solution" lang="de">{r.solution}</div>
      <div className="explain">{r.explain}</div>
    </section>
  );
}

/** Corrección proyectada (profesor): solución, explicación y resultado de cada alumno. */
export function ClassReveal({ view }: { view: RoomView }) {
  const r = view.reveal;
  if (!r) return null;
  return (
    <section className="stack">
      {r.skipped && <div className="alert calm">Pregunta anulada: no cuenta y se han devuelto los objetos.</div>}
      <div className="solution" lang="de">{r.solution}</div>
      <div className="explain">{r.explain}</div>
      {!r.skipped && (
        <div className="stack" style={{ gap: 8 }}>
          {view.players.map((p) => {
            const x = r.results[p.id];
            if (!x) return null;
            return (
              <div key={p.id} className={`res-row ${x.status === 'correct' ? 'ok' : 'ko'}`}>
                <b>{x.status === 'correct' ? '✓' : '✗'} {p.name}</b>
                <b className="dot">{x.delta > 0 ? `+${x.delta}` : x.delta}</b>
                <span className="given">{x.given}{x.lines.length ? ` · ${x.lines.join(' · ')}` : ''}</span>
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
    <section className="intro">
      <span className="idx">WILDCARD</span>
      <h1>{mine ? 'Elige categoría' : `${who} elige`}</h1>
      <div className="wild-opts">
        {w.options.map((t) => (
          <button key={t} className="btn" disabled={!mine} onClick={() => onPick?.(t)}>
            {TOPICS[t].de}<small>{TOPICS[t].es}</small>
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

/** Escena final: podio, estadísticas y repaso de errores. */
export function Final({ view, teacher, onPractice }: { view: RoomView; teacher?: boolean; onPractice?: () => void }) {
  const f = view.final;
  const [tab, setTab] = useState<'mine' | 'class'>(teacher ? 'class' : 'mine');
  if (!f) return null;
  const practice = view.mode === 'practice';
  const top = f.players.slice(0, 3);
  const podium = [top[1], top[0], top[2]].filter(Boolean);
  const me = f.players.find((p) => p.id === view.me?.id);
  const heights: Record<number, number> = { 1: 230, 2: 160, 3: 110 };
  return (
    <section className="final">
      <div className="spot" />
      {!practice ? (
        <>
          <div className="intro" style={{ paddingBottom: 0 }}>
            <span className="idx">Resultados</span>
            <h1>{f.players[0] ? `${f.players[0].name} gewinnt!` : 'Fin de la clase'}</h1>
          </div>
          <div className="podium">
            {podium.map((p) => (
              <div key={p.id} className={`pod${p.rank === 1 ? ' first' : ''}`} style={{ '--d': `${p.rank === 1 ? 1.6 : p.rank === 2 ? 0.9 : 0.3}s`, '--h': `${heights[p.rank] ?? 90}px` } as CSSProperties}>
                <span className="nm">{p.name}</span>
                <Counter className="sc" value={p.score} />
                <div className="col">{p.rank}</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="intro" style={{ paddingBottom: 0 }}>
          <span className="idx">Práctica terminada</span>
          <h1>{view.practice?.correct ?? 0} / {view.practice?.done ?? 0}</h1>
          <p className="sub">Las preguntas falladas volverán a salir primero en tu próxima práctica.</p>
          {onPractice && <div className="row"><button className="btn primary lg" onClick={onPractice}>Otra práctica</button></div>}
        </div>
      )}
      <div className="stats">
        {f.players.map((p) => (
          <div key={p.id} className="panel stat-card">
            <b>{p.rank}. {p.name}</b>
            <div className="kv">Aciertos <b>{p.correct}/{p.total}</b></div>
            <div className="kv">Mejor racha <b>{p.best}</b></div>
            <div className="kv">BlackCard ganadas / perdidas <b>{p.bcWon} / {p.bcLost}</b></div>
            <div className="kv">Objetos usados <b>{p.itemsUsed}</b></div>
            <div className="kv">Puntos robados <b>{p.stolen}</b></div>
          </div>
        ))}
      </div>
      <div className="stack">
        <div className="row">
          <h2 style={{ margin: 0 }}>Repaso de errores</h2>
          {!practice && (
            <div className="row">
              {!teacher && <button className={`btn sm${tab === 'mine' ? ' on' : ''}`} onClick={() => setTab('mine')}>Mis errores</button>}
              <button className={`btn sm${tab === 'class' ? ' on' : ''}`} onClick={() => setTab('class')}>Los más fallados</button>
            </div>
          )}
        </div>
        <ErrorCards list={tab === 'class' && !practice ? f.classErrors : me?.errors ?? f.players[0]?.errors ?? []} />
      </div>
      {!teacher && view.me?.profileCode && (
        <div className="panel">
          <b>En casa: modo práctica</b>
          <p className="dim">Entra en <span className="mono">{location.host}/practica</span>. Si usas otro ordenador, escribe tu código de alumno: <b className="dot red">{view.me.profileCode}</b></p>
        </div>
      )}
    </section>
  );
}
