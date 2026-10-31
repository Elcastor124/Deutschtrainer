// /examenes/a1-a2 — Simulacro individual (sin sala ni profesor). Se responde a tu ritmo; «Corregir» corrige SOLO lo que
// llevas respondido (y lo deja fijado); «Terminar» da la nota final sobre 10 contando lo no respondido como 0.
import { useEffect, useMemo, useState } from 'react';
import type { RoadLevel, RoadQuestion } from '../../shared/road.ts';
import { navigate, store } from '../util.ts';
import { sfx } from '../fx/sound.ts';
import '../road.css';
import '../road-solo.css';

type Level = RoadLevel & { dictationFragments: number };
interface Check {
  results: Record<string, { ok: boolean; solution: string }>;
  lesen: { answered: number; correct: number; total: number }; horen: { answered: number; correct: number; total: number };
  diktat: { written: boolean; points: number; max: number };
  answered: number; totalQuestions: number; complete: boolean; points: number; outOf: number; accuracy: number | null;
  final: { total: number; outOf: number; grade: number; percent: number; passed: boolean } | null;
  dictationSolution?: string; rubric?: string[]; rubricHits?: boolean[];
}
interface Saved { answers: Record<string, string>; dictation: string; checked: Record<string, { ok: boolean; solution: string }>; dictChecked: string | null; listens: Record<string, number>; last: Check | null }
const KEY = 'dt:road-solo:v1';
const EMPTY: Saved = { answers: {}, dictation: '', checked: {}, dictChecked: null, listens: {}, last: null };
const LISTEN_LIMIT = 2;
type Tab = 'lesen' | 'horen' | 'diktat' | 'ergebnis';

function load(): Saved { try { return { ...EMPTY, ...JSON.parse(store.get(KEY) ?? 'null') }; } catch { return EMPTY; } }

export function RoadSolo() {
  const [level, setLevel] = useState<Level | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [s, setS] = useState<Saved>(load);
  const [tab, setTab] = useState<Tab>(() => (load().last?.final ? 'ergebnis' : 'lesen'));
  const [part, setPart] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetch('/api/road/solo/level').then((r) => r.ok ? r.json() : Promise.reject(new Error('No se pudo cargar el examen.'))).then(setLevel).catch((e: Error) => setErr(e.message)); }, []);
  useEffect(() => { store.set(KEY, JSON.stringify(s)); }, [s]);
  const all = useMemo(() => level ? [...level.reading.flatMap((p) => p.questions), ...level.listening.flatMap((l) => l.questions)] : [], [level]);
  if (err) return <main className="home road"><p className="err-msg" role="alert">{err}</p></main>;
  if (!level) return <main className="home road"><p role="status">Cargando el simulacro…</p></main>;

  const finished = !!s.last?.final;
  const answered = all.filter((q) => s.answers[q.id]).length;
  const pending = all.filter((q) => s.answers[q.id] && !s.checked[q.id]).length + (s.dictation.trim() && s.dictation !== s.dictChecked ? 1 : 0);
  const set = (q: RoadQuestion, v: string) => { if (s.checked[q.id] || finished) return; sfx.key(); setS({ ...s, answers: { ...s.answers, [q.id]: v } }); };

  const run = async (finish: boolean) => {
    if (finish) {
      const left = all.length - answered + (s.dictation.trim() ? 0 : 1);
      if (left && !confirm(`Te ${left === 1 ? 'falta 1 parte' : `faltan ${left} preguntas/partes`} por responder: contarán como 0. ¿Terminar el examen?`)) return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/road/solo/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers: s.answers, dictation: s.dictation, finish }) });
      if (!r.ok) throw new Error('No se pudo corregir. Comprueba la conexión.');
      const c = await r.json() as Check;
      const newly = Object.keys(c.results).filter((id) => !s.checked[id]);
      setS({ ...s, checked: { ...s.checked, ...c.results }, dictChecked: s.dictation.trim() ? s.dictation : s.dictChecked, last: c });
      if (finish) { setTab('ergebnis'); sfx.fanfare(); } else if (newly.length) { if (newly.every((id) => c.results[id].ok)) sfx.good(); else sfx.next(); }
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const restart = () => { if (confirm('¿Empezar el simulacro de cero? Se borran tus respuestas.')) { setS(EMPTY); setTab('lesen'); setPart(0); } };
  const c = s.last;

  return (
    <main className="dt-page rs-page">
      <header className="rs-head">
        <div>
          <a className="rs-back" href="/examenes" onClick={(e) => { e.preventDefault(); navigate('/examenes'); }}>← Exámenes de práctica</a>
          <p className="dt-eyebrow">Simulacro 1 · A1/A2 · individual</p>
          <h1>Die erste Prüfung<b className="dt-punkt">.</b></h1>
        </div>
      </header>

      <div className="rs-layout">
        <section className="rs-main">
          <nav className="rs-tabs" aria-label="Partes del examen">
            {(['lesen', 'horen', 'diktat', 'ergebnis'] as Tab[]).map((t) => <button key={t} type="button" className={tab === t ? 'on' : ''} aria-current={tab === t ? 'step' : undefined} onClick={() => setTab(t)}>{{ lesen: 'Lesen · 30', horen: 'Hören · 10', diktat: 'Diktat · 10', ergebnis: 'Ergebnis' }[t]}</button>)}
          </nav>

          {tab === 'lesen' && <>
            <div className="rs-parts">{level.reading.map((p, i) => <button key={p.id} type="button" className={i === part ? 'on' : ''} onClick={() => setPart(i)}>{p.title.split('—')[0].trim()}<small>{p.questions.filter((q) => s.answers[q.id]).length}/{p.questions.length}</small></button>)}</div>
            {(() => { const p = level.reading[Math.min(part, level.reading.length - 1)]; return (
              <article className="rs-part" lang="de">
                <h2>{p.title}</h2><p className="rs-instr">{p.instruction}</p>{p.example && <p className="rs-example">{p.example}</p>}
                <div className={`rs-texts${p.texts.length > 2 ? ' grid' : ''}`}>{p.texts.map((t) => <section key={t.id} className="rs-text">{t.label && <b className="rs-label">{t.label}</b>}<h3>{t.title}</h3><p>{t.body}</p></section>)}</div>
                <ol className="rs-qs">{p.questions.map((q) => <QuestionView key={q.id} q={q} value={s.answers[q.id] ?? ''} result={s.checked[q.id]} locked={!!s.checked[q.id] || finished} onPick={(v) => set(q, v)} />)}</ol>
                {part < level.reading.length - 1 && <button type="button" className="dt-btn dt-btn-ghost sm" onClick={() => setPart(part + 1)}><span className="dt-btn-label">Siguiente parte →</span></button>}
              </article>); })()}
          </>}

          {tab === 'horen' && <div className="rs-part" lang="de">
            <h2>Hörverstehen</h2><p className="rs-instr">Lee primero las preguntas. Puedes escuchar cada audio como máximo {LISTEN_LIMIT} veces.</p>
            {level.listening.map((l) => (
              <section key={l.audio.id} className="rs-listen">
                <Audio id={l.audio.id} title={l.audio.title} used={s.listens[l.audio.id] ?? 0} limit={LISTEN_LIMIT} onPlay={() => setS({ ...s, listens: { ...s.listens, [l.audio.id]: (s.listens[l.audio.id] ?? 0) + 1 } })} />
                <ol className="rs-qs">{l.questions.map((q) => <QuestionView key={q.id} q={q} value={s.answers[q.id] ?? ''} result={s.checked[q.id]} locked={!!s.checked[q.id] || finished} onPick={(v) => set(q, v)} />)}</ol>
              </section>))}
          </div>}

          {tab === 'diktat' && <div className="rs-part" lang="de">
            <h2>{level.dictation.title}</h2>
            <p className="rs-instr">Escucha el dictado completo y luego frase a frase. Escribe el texto; se corrige por elementos clave (10 puntos).</p>
            <div className="rs-dict-audio">
              <Audio id="diktat" title="Dictado completo" used={0} limit={Infinity} onPlay={() => {}} />
              <div className="rs-frags">{Array.from({ length: level.dictationFragments }, (_, i) => <Audio key={i} id={`diktat-${i + 1}`} title={`Frase ${i + 1}`} used={0} limit={Infinity} onPlay={() => {}} small />)}</div>
            </div>
            <textarea className="field rs-dict" rows={8} value={s.dictation} disabled={finished} onChange={(e) => setS({ ...s, dictation: e.target.value })} placeholder="Escribe aquí lo que oyes…" aria-label="Tu dictado" spellCheck={false} />
            {c && s.dictChecked && <p className="rs-dict-score">Dictado: <b>{c.diktat.points}/{c.diktat.max}</b> elementos correctos{s.dictation !== s.dictChecked ? ' (has cambiado el texto: vuelve a corregir)' : ''}.</p>}
          </div>}

          {tab === 'ergebnis' && <Results c={c} level={level} answered={answered} total={all.length} />}
        </section>

        <aside className="rs-side" aria-label="Tu progreso en el examen">
          <div className="rs-card">
            <p className="rs-mono">Progreso</p>
            <div className="rs-meter"><span style={{ width: `${(answered / all.length) * 100}%` }} /></div>
            <p className="rs-stat"><b>{answered}</b>/{all.length} preguntas respondidas · dictado {s.dictation.trim() ? 'escrito' : 'pendiente'}</p>
            {c && <>
              <p className="rs-stat">Corregido: <b>{c.points}</b> puntos{c.accuracy !== null ? <> · <b>{c.accuracy} %</b> de acierto en lo corregido</> : null}</p>
              <p className="rs-note">{c.final ? <>Nota final: <b className="rs-grade">{String(c.final.grade).replace('.', ',')}</b> / 10</> : 'La nota final (sobre 10) aparece al terminar el examen.'}</p>
            </>}
            {!finished ? <>
              <button type="button" className="dt-btn dt-btn-primary" disabled={busy || pending === 0} onClick={() => run(false)}><span className="dt-btn-label">{pending ? `Corregir lo respondido (${pending})` : 'Nada nuevo que corregir'}</span></button>
              <button type="button" className="dt-btn dt-btn-ghost sm" disabled={busy} onClick={() => run(true)}><span className="dt-btn-label">Terminar examen</span></button>
            </> : <button type="button" className="dt-btn dt-btn-ghost sm" onClick={() => setTab('ergebnis')}><span className="dt-btn-label">Ver resultado</span></button>}
            <button type="button" className="rs-reset" onClick={restart}>Empezar de cero</button>
          </div>
          <p className="rs-disclaimer">{level.disclaimer}</p>
        </aside>
      </div>
    </main>
  );
}

function QuestionView({ q, value, result, locked, onPick }: { q: RoadQuestion; value: string; result?: { ok: boolean; solution: string }; locked: boolean; onPick: (v: string) => void }) {
  return (
    <li className={`rs-q${result ? (result.ok ? ' ok' : ' ko') : ''}`}>
      <p className="rs-prompt"><b>{q.number}.</b> {q.prompt}</p>
      {q.type === 'matching'
        ? <select className="field rs-select" value={value} disabled={locked} onChange={(e) => onPick(e.target.value)} aria-label={`Respuesta ${q.number}`}><option value="">Elige anuncio…</option>{q.options.map((o) => <option key={o} value={o}>{o === '0' ? '0 · ninguno' : o}</option>)}</select>
        : <div className="rs-opts" role="radiogroup" aria-label={`Respuesta ${q.number}`}>{q.options.map((o) => <button key={o} type="button" role="radio" aria-checked={value === o} disabled={locked} className={`${value === o ? 'on' : ''}${result && o === result.solution ? ' sol' : ''}`} onClick={() => onPick(o)}>{o}</button>)}</div>}
      {result && <p className="rs-verdict" role="status">{result.ok ? '✓ Richtig' : <>✗ Falsch · correcta: <b>{result.solution}</b></>}</p>}
    </li>
  );
}

function Audio({ id, title, used, limit, onPlay, small }: { id: string; title: string; used: number; limit: number; onPlay: () => void; small?: boolean }) {
  const [state, setState] = useState<'idle' | 'playing' | 'error'>('idle');
  const left = limit - used;
  const play = () => {
    if (left <= 0 || state === 'playing') return;
    const a = new window.Audio(`/api/road/solo/audio?id=${encodeURIComponent(id)}`);
    a.onended = () => setState('idle'); a.onerror = () => setState('error');
    void a.play().then(() => { setState('playing'); onPlay(); }).catch(() => setState('error'));
  };
  return (
    <button type="button" className={`rs-audio${small ? ' small' : ''}${state === 'playing' ? ' playing' : ''}`} disabled={left <= 0} onClick={play}>
      <span aria-hidden="true">{state === 'playing' ? '◼' : '▶'}</span>
      <span>{title}{Number.isFinite(limit) && <small>{left > 0 ? `${left} escucha${left === 1 ? '' : 's'}` : 'sin escuchas'}</small>}{state === 'error' && <small>audio no disponible</small>}</span>
    </button>
  );
}

function Results({ c, level, answered, total }: { c: Check | null; level: Level; answered: number; total: number }) {
  if (!c?.final) return <div className="rs-part"><h2>Ergebnis</h2><p>Todavía no has terminado. Puedes corregir lo que llevas tantas veces como quieras; la nota sobre 10 aparece al pulsar «Terminar examen».</p><p className="rs-stat">Llevas {answered}/{total} preguntas respondidas.</p></div>;
  const f = c.final;
  return (
    <div className="rs-part rs-results">
      <div className={`rs-big ${f.passed ? 'pass' : 'fail'}`}><span className="dotnum">{String(f.grade).replace('.', ',')}</span><small>/ 10</small></div>
      <p className="rs-stat"><b>{f.total}/{f.outOf}</b> puntos · {f.percent} % · {f.passed ? 'Aprobado (≥ 60 %)' : 'No aprobado (necesitas 60 %)'}</p>
      <ul className="rs-break">
        <li><b>Lesen</b><span>{c.lesen.correct}/{c.lesen.total}</span><small>{c.lesen.answered < c.lesen.total ? `${c.lesen.total - c.lesen.answered} sin responder` : 'todo respondido'}</small></li>
        <li><b>Hören</b><span>{c.horen.correct}/{c.horen.total}</span><small>{c.horen.answered < c.horen.total ? `${c.horen.total - c.horen.answered} sin responder` : 'todo respondido'}</small></li>
        <li><b>Diktat</b><span>{c.diktat.points}/{c.diktat.max}</span><small>{c.diktat.written ? 'por elementos clave' : 'no escrito'}</small></li>
      </ul>
      {c.dictationSolution && <details className="rs-sol" lang="de"><summary>Ver el dictado correcto y los elementos puntuados</summary><p>{c.dictationSolution}</p>
        {c.rubric && <ul className="rs-rubric">{c.rubric.map((r, i) => <li key={r} className={c.rubricHits?.[i] ? 'ok' : 'ko'}>{c.rubricHits?.[i] ? '✓' : '✗'} {r}</li>)}</ul>}</details>}
      <p className="rs-disclaimer">{level.disclaimer}</p>
    </div>
  );
}
