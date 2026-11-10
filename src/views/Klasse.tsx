// Unterricht mit Klaus — aula interactiva. El motor es DETERMINISTA (server/ai/lessons.ts): teoría, tablas, comparaciones,
// diálogos y ejercicios vienen de actividades predefinidas y se corrigen en el servidor. Solo «Pregúntale a Klaus»
// puede llamar a la IA (cuota klasseAsks); sin proveedor configurado responde el banco preparado y se dice así.
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import type { AnswerPayload, AnswerResult, KlasseView, PublicActivity } from '../../shared/lesson.ts';
import { klasseAnswer, klasseAsk, klasseLessons, klasseNext, klasseSession, klasseStart, newRequestId, type KlasseAskAnswer, type KlasseLessonInfo, type KlasseSessionInfo } from '../klaus-ai-client.ts';
import { navigate, studentSession } from '../util.ts';
import { KlausFigure } from '../klaus/KlausFigure.tsx';
import { useKlausSkin } from '../klaus/skin-client.ts';
import type { KlausReaction } from '../klaus/events.ts';
import '../klasse.css';

const KIND: Record<PublicActivity['kind'], string> = {
  theory: 'Erklärung', 'grammar-table': 'Tabelle', comparison: 'Vergleich', dialogue: 'Dialog', 'multiple-choice': 'Übung',
  'fill-blank': 'Übung', 'sentence-builder': 'Übung', matching: 'Übung', listening: 'Hören', checkpoint: 'Kontrolle',
};
const isExercise = (a: PublicActivity) => ['multiple-choice', 'fill-blank', 'sentence-builder', 'matching', 'listening'].includes(a.kind);

/** Resalta `mark` dentro de una frase alemana (lo que cambia: den Hund, einen Apfel…). */
function Marked({ de, mark }: { de: string; mark?: string }) {
  const i = mark ? de.indexOf(mark) : -1;
  if (!mark || i < 0) return <>{de}</>;
  return <>{de.slice(0, i)}<mark className="kx-mark">{mark}</mark>{de.slice(i + mark.length)}</>;
}

export function Klasse() {
  const loggedIn = !!studentSession();
  const look = useKlausSkin();
  const [lessons, setLessons] = useState<KlasseLessonInfo[] | null>(null);
  const [sessions, setSessions] = useState<KlasseSessionInfo[]>([]);
  const [view, setView] = useState<KlasseView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [reaction, setReaction] = useState<KlausReaction>('waving');

  useEffect(() => {
    if (!loggedIn) return;
    klasseLessons().then((r) => { setLessons(r.lessons); setSessions(r.sessions); }).catch((e: Error) => setErr(e.message));
  }, [loggedIn]);

  const run = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true); setErr(null);
    try { await fn(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }, []);

  const open = (lessonId: string) => run(async () => {
    const r = await klasseStart(lessonId); setView(r.view); setResult(null); setReaction('waving');
  });
  const resume = (id: string) => run(async () => { const r = await klasseSession(id); setView(r.view); setResult(null); setReaction('idle'); });
  const answer = (payload: AnswerPayload) => view && run(async () => {
    setReaction('thinking');
    const r = await klasseAnswer(view.sessionId, payload); setResult(r.result); setView(r.view);
    setReaction(r.result.ok ? 'correct' : 'support');
  });
  const next = () => view && run(async () => {
    const r = await klasseNext(view.sessionId); setView(r.view); setResult(null);
    setReaction(r.view.finished ? 'complete' : 'idle');
  });
  const back = () => { setView(null); setResult(null); klasseLessons().then((r) => { setLessons(r.lessons); setSessions(r.sessions); }).catch(() => {}); };

  if (!loggedIn) return (
    <main className="dt-page kx-page">
      <header className="kx-head"><p className="dt-eyebrow">Unterricht mit Klaus</p><h1>Clase con Klaus<b className="dt-punkt">.</b></h1></header>
      <section className="kx-gate">
        <div className="kx-gate-klaus"><KlausFigure reaction="waving" look={look} /></div>
        <div><h2>Entra para empezar una clase</h2><p>Klaus guarda por dónde vas en cada lección.</p>
          <p className="kx-row"><a className="btn primary" href="/entrar?volver=/unterricht" onClick={(e) => { e.preventDefault(); navigate('/entrar?volver=/unterricht'); }}>Iniciar sesión</a>
            <a className="btn" href="/registro" onClick={(e) => { e.preventDefault(); navigate('/registro'); }}>Crear cuenta</a></p></div>
      </section>
    </main>
  );

  if (!view) return (
    <main className="dt-page kx-page">
      <header className="kx-head">
        <p className="dt-eyebrow">Unterricht mit Klaus</p>
        <h1>Clase con Klaus<b className="dt-punkt">.</b></h1>
        <p className="kx-lede">Lecciones cortas: Klaus explica, tú practicas, y si algo no queda claro, le preguntas.</p>
      </header>
      {err && <p className="kx-err" role="alert">{err}</p>}
      {!lessons ? <p className="kx-muted">Cargando lecciones…</p> : (
        <ol className="kx-lessons">
          {lessons.map((l, i) => {
            const open_ = sessions.find((s) => s.lessonId === l.id && !s.finished), done = sessions.some((s) => s.lessonId === l.id && s.finished);
            return (
              <li key={l.id} className="kx-lesson" style={{ '--i': i } as CSSProperties}>
                <span className="kx-lesson-n dotnum">{String(i + 1).padStart(2, '0')}</span>
                <div className="kx-lesson-body">
                  <p className="kx-mono">{l.level} · {l.unit.replace(/^[A-C][12] · /, '')} · {l.steps} pasos{done ? ' · hecha' : ''}</p>
                  <h2>{l.title}</h2>
                  <ul>{l.objectives.map((o) => <li key={o}>{o}</li>)}</ul>
                </div>
                <div className="kx-lesson-act">
                  {open_
                    ? <button type="button" className="btn primary" disabled={busy} onClick={() => resume(open_.sessionId)}>Continuar · {open_.step + 1}/{open_.total}</button>
                    : <button type="button" className="btn primary" disabled={busy} onClick={() => open(l.id)}>{done ? 'Repetir' : 'Empezar'}</button>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <p className="kx-note">Las explicaciones y ejercicios están preparados por el profesor y se corrigen sin IA. Solo tus preguntas libres usan tu cuota de preguntas.</p>
    </main>
  );

  const a = view.activity;
  const answered = a ? view.answered[a.id] : undefined;
  const locked = !!answered && (answered.ok || !!result?.done || (result?.reveal != null));
  const canNext = !a || !isExercise(a) || locked;

  return (
    <main className="dt-page kx-page kx-room">
      <header className="kx-bar">
        <button type="button" className="kx-back" onClick={back}>← Lecciones</button>
        <div className="kx-bar-t"><p className="kx-mono">{view.level} · Unterricht mit Klaus</p><h1>{view.title}</h1></div>
        <Rail view={view} />
      </header>

      <div className="kx-grid">
        <section className="kx-canvas" aria-live="polite">
          {view.finished && view.summary ? <Summary view={view} onBack={back} /> : a && (
            <div key={a.id} className="kx-stage">
              <p className="kx-kind"><span>{KIND[a.kind]}</span> {view.step + 1} / {view.total}</p>
              <h2 className="kx-title">{a.title}</h2>
              <Activity a={a} busy={busy} locked={locked} onAnswer={answer} />
              {result && <Feedback r={result} />}
              <div className="kx-actions">
                <button type="button" className="btn primary" disabled={busy || !canNext} onClick={next}>
                  {view.step + 1 >= view.total ? 'Terminar' : 'Siguiente'} →
                </button>
                {!canNext && <span className="kx-muted">Responde para continuar</span>}
              </div>
            </div>
          )}
          {err && <p className="kx-err" role="alert">{err}</p>}
        </section>

        <aside className="kx-side" aria-label="Klaus">
          <div className={`kx-klaus r-${reaction}`}><KlausFigure reaction={reaction} look={look} /></div>
          <Ask view={view} onReaction={setReaction} />
        </aside>
      </div>
    </main>
  );
}

function Rail({ view }: { view: KlasseView }) {
  return (
    <ol className="kx-rail" aria-label={`Paso ${view.step + 1} de ${view.total}`}>
      {Array.from({ length: view.total }, (_, i) => (
        <li key={i} className={i < view.step || view.finished ? 'is-done' : i === view.step ? 'is-now' : ''} />
      ))}
    </ol>
  );
}

function Activity({ a, busy, locked, onAnswer }: { a: PublicActivity; busy: boolean; locked: boolean; onAnswer: (p: AnswerPayload) => void }) {
  switch (a.kind) {
    case 'theory': return (
      <div className="kx-theory">
        <p className="kx-text">{a.text}</p>
        {a.example && <blockquote className="kx-example"><p lang="de">{a.example.de}</p><p>{a.example.es}</p></blockquote>}
      </div>
    );
    case 'grammar-table': return <GrammarTable a={a} />;
    case 'comparison': return (
      <div className="kx-compare">
        {[a.left, a.right].map((side, s) => (
          <div key={s} className={`kx-col ${s ? 'is-right' : ''}`}>
            <h3>{side.title}</h3>
            <ul>{side.items.map((it, i) => <li key={i} style={{ '--i': i + s * 2 } as CSSProperties}><p lang="de"><Marked de={it.de} mark={it.mark} /></p><p>{it.es}</p></li>)}</ul>
          </div>
        ))}
      </div>
    );
    case 'dialogue': return (
      <ol className="kx-dialogue">
        {a.lines.map((l, i) => (
          <li key={i} className={i % 2 ? 'is-b' : 'is-a'} style={{ '--i': i } as CSSProperties}>
            <span className="kx-who">{l.who}</span><p lang="de"><Marked de={l.de} mark={l.mark} /></p><p className="kx-es">{l.es}</p>
          </li>
        ))}
      </ol>
    );
    case 'checkpoint': return <p className="kx-text">{a.text}</p>;
    case 'multiple-choice':
    case 'listening': return (
      <div className="kx-ex">
        <p className="kx-prompt" lang="de">{a.prompt}</p>
        {a.kind === 'listening' && <audio controls preload="none" src={a.audioUrl} className="kx-audio" />}
        <div className="kx-options" role="group" aria-label="Opciones">
          {a.options.map((o, i) => <button key={i} type="button" className="kx-opt" disabled={busy || locked} onClick={() => onAnswer({ choice: i })} lang="de">{o}</button>)}
        </div>
      </div>
    );
    case 'fill-blank': return <FillBlank a={a} busy={busy} locked={locked} onAnswer={onAnswer} />;
    case 'sentence-builder': return <Builder a={a} busy={busy} locked={locked} onAnswer={onAnswer} />;
    case 'matching': return <Matching a={a} busy={busy} locked={locked} onAnswer={onAnswer} />;
  }
}

/** Tabla que se explica sola: cada «nota» enciende la celda de la que habla (pasos predefinidos en la lección). */
function GrammarTable({ a }: { a: Extract<PublicActivity, { kind: 'grammar-table' }> }) {
  const [k, setK] = useState(0);
  const step = a.steps[k], focus = step?.focus;
  return (
    <div className="kx-table-wrap">
      <table className="kx-table">
        <thead><tr>{a.columns.map((c, i) => <th key={i} scope="col">{c}</th>)}</tr></thead>
        <tbody>{a.rows.map((r) => (
          <tr key={r.id} className={focus?.startsWith(`${r.id}:`) ? 'is-row' : ''}>
            <th scope="row">{r.label}</th>
            {r.cells.map((c, i) => <td key={i} lang="de" className={focus === `${r.id}:${i}` ? 'is-focus' : ''}>{c}</td>)}
          </tr>
        ))}</tbody>
      </table>
      {a.steps.length > 0 && (
        <div className="kx-notes">
          <p key={k} className="kx-note-t">{step.note}</p>
          <div className="kx-row">
            <button type="button" className="btn ghost" disabled={k === 0} onClick={() => setK(k - 1)}>←</button>
            <span className="kx-mono">{k + 1}/{a.steps.length}</span>
            <button type="button" className="btn ghost" disabled={k >= a.steps.length - 1} onClick={() => setK(k + 1)}>→</button>
          </div>
        </div>
      )}
    </div>
  );
}

function FillBlank({ a, busy, locked, onAnswer }: { a: Extract<PublicActivity, { kind: 'fill-blank' }>; busy: boolean; locked: boolean; onAnswer: (p: AnswerPayload) => void }) {
  const [v, setV] = useState('');
  const [pre, post] = a.prompt.split('___');
  const submit = (e: FormEvent) => { e.preventDefault(); if (v.trim()) onAnswer({ text: v.trim() }); };
  return (
    <form className="kx-ex kx-fill" onSubmit={submit}>
      <p className="kx-prompt" lang="de">{pre}<input aria-label="Tu respuesta" className="kx-gap" value={v} onChange={(e) => setV(e.target.value)} disabled={locked} autoComplete="off" spellCheck={false} size={Math.max(4, v.length + 1)} />{post}</p>
      <button type="submit" className="btn" disabled={busy || locked || !v.trim()}>Comprobar</button>
    </form>
  );
}

function Builder({ a, busy, locked, onAnswer }: { a: Extract<PublicActivity, { kind: 'sentence-builder' }>; busy: boolean; locked: boolean; onAnswer: (p: AnswerPayload) => void }) {
  const [order, setOrder] = useState<number[]>([]);
  const left = a.words.map((w, i) => ({ w, i })).filter((x) => !order.includes(x.i));
  return (
    <div className="kx-ex">
      <p className="kx-prompt">{a.prompt}</p>
      <div className="kx-line" aria-label="Tu frase">{order.length ? order.map((i) => <button key={i} type="button" className="kx-word is-set" disabled={locked} onClick={() => setOrder(order.filter((x) => x !== i))} lang="de">{a.words[i]}</button>) : <span className="kx-muted">Toca las palabras en orden</span>}</div>
      <div className="kx-bank">{left.map(({ w, i }) => <button key={i} type="button" className="kx-word" disabled={locked} onClick={() => setOrder([...order, i])} lang="de">{w}</button>)}</div>
      <button type="button" className="btn" disabled={busy || locked || order.length !== a.words.length} onClick={() => onAnswer({ order: order.map((i) => a.words[i]) })}>Comprobar</button>
    </div>
  );
}

function Matching({ a, busy, locked, onAnswer }: { a: Extract<PublicActivity, { kind: 'matching' }>; busy: boolean; locked: boolean; onAnswer: (p: AnswerPayload) => void }) {
  const [pick, setPick] = useState<(number | null)[]>(() => a.left.map(() => null));
  const used = new Set(pick.filter((x): x is number => x !== null));
  return (
    <div className="kx-ex">
      <p className="kx-prompt">{a.prompt}</p>
      <ul className="kx-match">
        {a.left.map((l, i) => (
          <li key={i}>
            <span lang="de">{l}</span><i aria-hidden="true">→</i>
            <select aria-label={`Pareja de ${l}`} value={pick[i] ?? ''} disabled={locked} onChange={(e) => setPick(pick.map((x, j) => (j === i ? (e.target.value === '' ? null : Number(e.target.value)) : x)))}>
              <option value="">Elige…</option>
              {a.right.map((r, j) => <option key={j} value={j} disabled={used.has(j) && pick[i] !== j} lang="de">{r}</option>)}
            </select>
          </li>
        ))}
      </ul>
      <button type="button" className="btn" disabled={busy || locked || pick.some((x) => x === null)} onClick={() => onAnswer({ pairs: pick as number[] })}>Comprobar</button>
    </div>
  );
}

function Feedback({ r }: { r: AnswerResult }) {
  return (
    <div className={`kx-fb ${r.ok ? 'is-ok' : 'is-ko'}`} role="status">
      <b>{r.ok ? 'Richtig.' : r.reveal ? 'Fast.' : 'Noch nicht.'}</b> <span>{r.feedback}</span>
      {!r.ok && r.hint && !r.reveal && <p className="kx-hint">Pista: {r.hint}</p>}
      {r.reveal && <p className="kx-reveal">Respuesta: <span lang="de">{r.reveal.answer}</span></p>}
    </div>
  );
}

function Summary({ view, onBack }: { view: KlasseView; onBack: () => void }) {
  const s = view.summary!;
  const pct = s.total ? Math.round((s.correct / s.total) * 100) : 0;
  return (
    <div className="kx-stage kx-summary">
      <p className="kx-kind"><span>{s.passed ? 'Geschafft' : 'Noch einmal'}</span></p>
      <p className={`kx-score dotnum ${s.passed ? 'is-pass' : ''}`}>{s.correct}<small>/{s.total}</small></p>
      <div className="kx-meter" style={{ '--p': `${pct}%` } as CSSProperties}><i /></div>
      <p className="kx-text">{s.recommendation}</p>
      <button type="button" className="btn primary" onClick={onBack}>Volver a las lecciones</button>
    </div>
  );
}

/** Preguntas libres: la única parte que puede usar IA. Muestra la cuota y de dónde sale la respuesta. */
function Ask({ view, onReaction }: { view: KlasseView; onReaction: (r: KlausReaction) => void }) {
  const [q, setQ] = useState('');
  const [log, setLog] = useState<{ q: string; a: KlasseAskAnswer }[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [left, setLeft] = useState(view.asksLeft);
  const ctl = useRef<AbortController | null>(null);
  useEffect(() => () => ctl.current?.abort(), []);
  useEffect(() => { setLeft(view.asksLeft); }, [view.asksLeft]);
  const last = useMemo(() => log.at(-1), [log]);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); const text = q.trim(); if (!text || busy) return;
    setBusy(true); setErr(null); onReaction('thinking'); ctl.current = new AbortController();
    try { const r = await klasseAsk(view.sessionId, text, newRequestId(), ctl.current.signal); setLog([...log, { q: text, a: r }]); setLeft(r.asksLeft); setQ(''); onReaction('idle'); }
    catch (x) { setErr((x as Error).message); onReaction('support'); }
    finally { setBusy(false); }
  };
  return (
    <div className="kx-ask">
      {last ? (
        <div className="kx-bubble" key={log.length}>
          <p className="kx-q">«{last.q}»</p>
          <p>{last.a.answer.text}</p>
          {last.a.answer.example && <p className="kx-ex-de" lang="de">{last.a.answer.example.de}</p>}
          <p className="kx-src">{last.a.source === 'ai' ? 'Respuesta de la IA' : 'Respuesta preparada · sin IA'}</p>
        </div>
      ) : <p className="kx-bubble is-hint">¿Algo no está claro? Pregúntame sobre este paso.</p>}
      <form onSubmit={submit} className="kx-ask-form">
        <label className="sr-only" htmlFor="kx-q">Tu pregunta para Klaus</label>
        <input id="kx-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={left > 0 ? 'Tu pregunta…' : 'Sin preguntas hoy'} maxLength={300} disabled={busy || left <= 0} autoComplete="off" />
        <button type="submit" className="btn" disabled={busy || !q.trim() || left <= 0}>{busy ? '…' : 'Preguntar'}</button>
      </form>
      <p className="kx-mono">{left} preguntas restantes</p>
      {err && <p className="kx-err" role="alert">{err}</p>}
    </div>
  );
}
