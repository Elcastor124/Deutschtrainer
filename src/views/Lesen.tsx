// Leseverstehen 001 — /examenes/lesen-001
//  · Práctica (solo): el alumno lee y responde a su ritmo; las respuestas se guardan en el dispositivo. Corrección en el SERVIDOR al terminar
//    (el bundle no contiene la clave). Con cuenta, el resultado se guarda una vez por intento (refrescar no duplica).
//  · Clase: el profesor crea la sala, empieza y termina; los alumnos responden en su dispositivo. Mismo patrón que Hörverstehen 001.
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import type { LesenAction, LesenBlock, LesenExam, LesenPart, LesenQuestion, LesenResult, LesenReviewItem, LesenScore, LesenView } from '../../shared/lesen.ts';
import { matchingConflict } from '../../shared/lesen.ts';
import { mmss, navigate, store, teacherKey } from '../util.ts';
import '../horen.css';
import '../lesen.css';

type Mode = { kind: 'choose' } | { kind: 'practice' } | { kind: 'room'; code: string; token: string; role: 'teacher' | 'player' };
const BASE = '/examenes/lesen-001';
const SESSION = 'dt:lesen:session';
const PRACTICE = 'dt:lesen:practice:v1';
const TOTAL = 25;

async function api<T>(path: string, init: { body?: unknown; token?: string } = {}): Promise<T> {
  const r = await fetch(`/api/lesen/${path}`, {
    method: init.body === undefined ? 'GET' : 'POST', cache: 'no-store', credentials: 'same-origin',
    headers: { ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}), ...(path === 'create' && teacherKey() ? { 'X-Teacher-Key': teacherKey()! } : {}) },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  let data: unknown; try { data = await r.json(); } catch { throw new Error('Respuesta inválida del servidor.'); }
  if (!r.ok) throw new Error((data as { error?: string })?.error ?? 'No se pudo completar la acción.');
  return data as T;
}
function readSession(): Mode | null { try { const s = JSON.parse(store.get(SESSION) ?? 'null'); return s?.code && s?.token && (s.role === 'teacher' || s.role === 'player') ? { kind: 'room', ...s } : null; } catch { return null; } }
const newAttempt = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, '');

export function Lesen() {
  const [mode, setMode] = useState<Mode>(() => {
    const q = new URLSearchParams(location.search);
    if (q.get('modo') === 'practica') return { kind: 'practice' };
    const s = readSession(); if (s && s.kind === 'room' && (!q.get('code') || q.get('code') === s.code)) return s;
    return { kind: 'choose' };
  });
  const enterRoom = (m: Extract<Mode, { kind: 'room' }>) => { store.set(SESSION, JSON.stringify({ code: m.code, token: m.token, role: m.role })); history.replaceState(null, '', `${BASE}?code=${m.code}`); setMode(m); };
  const leave = () => { store.del(SESSION); history.replaceState(null, '', BASE); setMode({ kind: 'choose' }); };
  return (
    <main className="dt-page hv-page lv-page" data-lesen-mode={mode.kind === 'room' ? mode.role : mode.kind}>
      <header className="hv-head">
        <a className="rs-back" href="/examenes" onClick={(e) => { e.preventDefault(); navigate('/examenes'); }}>← Exámenes de práctica</a>
        <p className="dt-eyebrow">A1–A2 · Leseverstehen · 45 Minuten · 25 Aufgaben</p>
        <h1 lang="de">Leseverstehen<b className="dt-punkt">.</b></h1>
        <p className="hv-sub" lang="de">Alltag und Kommunikation</p>
        {mode.kind === 'room' && <p className="hv-sub"><span className="hv-led on" aria-hidden="true" />{mode.role === 'teacher' ? 'Profesor · panel privado' : 'Alumno'} · Sala <b className="hv-dot">{mode.code}</b> <button type="button" className="hv-link" onClick={leave}>Salir</button></p>}
      </header>
      {mode.kind === 'choose' && <Choose onPractice={() => { history.replaceState(null, '', `${BASE}?modo=practica`); setMode({ kind: 'practice' }); }} onRoom={enterRoom} />}
      {mode.kind === 'practice' && <Practice onExit={() => { history.replaceState(null, '', BASE); setMode({ kind: 'choose' }); }} />}
      {mode.kind === 'room' && <Room key={`${mode.code}:${mode.role}`} code={mode.code} token={mode.token} role={mode.role} onLeave={leave} />}
    </main>
  );
}

const TEILE: [string, number, number][] = [['Ein neuer Alltag', 8, 5], ['Das Jugendzentrum Linden', 8, 5], ['Welche Anzeige passt?', 10, 6], ['Eine E-Mail von der Schule', 10, 5], ['Regeln im Lernhaus', 9, 4]];
function Choose({ onPractice, onRoom }: { onPractice: () => void; onRoom: (m: Extract<Mode, { kind: 'room' }>) => void }) {
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('code')?.toUpperCase() ?? '');
  const [name, setName] = useState(() => store.get('dt:lesen:name') ?? '');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const go = async (kind: 'create' | 'join') => {
    setBusy(true); setErr('');
    try {
      const w = await api<{ code: string; token: string; role: 'teacher' | 'player' }>(kind, { body: kind === 'create' ? {} : { code: code.trim().toUpperCase(), name: name.trim() } });
      if (kind === 'join') store.set('dt:lesen:name', name.trim());
      onRoom({ kind: 'room', ...w });
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="hv-choose">
      <section className="hv-card hv-card-main">
        <p className="hv-mono">25 Aufgaben · 5 Teile · 45 min · 25 Punkte</p>
        <h2>Simulacro de lectura</h2>
        <ol className="hv-teile" lang="de">{TEILE.map(([t, m, n], i) => <li key={t}><span className="hv-dot">{i + 1}</span>{t}<small className="lv-teil-meta">{m} min · {n}</small></li>)}</ol>
        <button type="button" className="dt-btn dt-btn-primary" data-lesen-practice="" onClick={onPractice}><span className="dt-btn-label">Hacerlo a mi ritmo →</span></button>
        <p className="hv-note">Tus respuestas se guardan en este dispositivo. Puedes volver atrás y cambiarlas. La corrección sale al terminar.</p>
      </section>
      <form className="hv-card" onSubmit={(e: FormEvent) => { e.preventDefault(); void go('join'); }}>
        <p className="hv-mono">En clase</p>
        <h2>Entrar en la sala</h2>
        <label className="hv-field">Nombre<input className="field" data-lesen-name="" required maxLength={32} value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" /></label>
        <label className="hv-field">Código<input className="field hv-dot" data-lesen-code="" required maxLength={6} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoCapitalize="characters" /></label>
        <button className="dt-btn dt-btn-primary" data-lesen-join="" disabled={busy || !name.trim() || code.trim().length !== 6}><span className="dt-btn-label">Entrar</span></button>
      </form>
      <section className="hv-card">
        <p className="hv-mono">Profesor</p>
        <h2>Dirigir el examen</h2>
        <p className="hv-note">Creas la sala, los alumnos entran con el código y tú decides cuándo empieza y cuándo se corrige. Ves su avance en tu panel privado.</p>
        <button type="button" className="dt-btn dt-btn-ghost" data-lesen-create="" disabled={busy} onClick={() => { void go('create'); }}><span className="dt-btn-label">Crear sala</span></button>
      </section>
      {err && <p className="hv-error" role="alert">{err}</p>}
    </div>
  );
}

/* ───────────────────────────── Piezas compartidas ───────────────────────────── */

function ReadingText({ part }: { part: LesenPart }) {
  return (
    <article className="lv-text" lang="de" aria-label={`Text Teil ${part.n}`} tabIndex={0} data-lesen-text={part.id}>
      <h3 className="lv-text-title">{part.textTitle}</h3>
      {part.text.map((b: LesenBlock, i) => {
        if (b.t === 'h') return <h4 key={i}>{b.text}</h4>;
        if (b.t === 'p') return <p key={i}>{b.text}</p>;
        if (b.t === 'meta') return <dl key={i} className="lv-meta">{b.rows.map(([k, v]) => <div key={k}><dt>{k}:</dt><dd>{v}</dd></div>)}</dl>;
        if (b.t === 'table') return <div key={i} className="lv-table-wrap"><table className="lv-table"><thead><tr>{b.head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{b.rows.map((r) => <tr key={r[0]}>{r.map((c, j) => j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>)}</tr>)}</tbody></table></div>;
        return <section key={i} className="lv-ad" data-lesen-ad={b.id}><header><b className="hv-dot">{b.id}</b><span>{b.title}</span></header>{b.lines.map((l) => <p key={l}>{l}</p>)}</section>;
      })}
    </article>
  );
}

function Questions({ part, answers, disabled, onPick, review }: { part: LesenPart; answers: Record<string, string>; disabled: boolean; onPick: (q: LesenQuestion, v: string | null) => void; review?: Record<string, LesenReviewItem> }) {
  return (
    <div className="hv-qs" lang="de">
      {part.questions.map((q) => {
        const r = review?.[q.id]; const own = answers[q.id];
        return (
          <fieldset key={q.id} className={`hv-q${r ? (r.ok ? ' ok' : ' ko') : ''}`} data-lesen-q={q.id}>
            <legend><span className="hv-dot hv-num">{q.number}</span>{q.prompt}</legend>
            {q.type === 'matching' ? (
              <label className="lv-select">
                <span className="sr">Anzeige für Situation {q.number}</span>
                <select className="field" value={own ?? ''} disabled={disabled} data-lesen-select={q.id} onChange={(e) => onPick(q, e.target.value || null)}>
                  <option value="">— Anzeige wählen —</option>
                  {q.options.map((o) => { const used = matchingConflict(part, answers, q.id, o.id); return <option key={o.id} value={o.id} disabled={used}>{o.id === '0' ? '0 · keine passende Anzeige' : `${o.id}${used ? ' (schon benutzt)' : ''}`}</option>; })}
                </select>
              </label>
            ) : (
              <div className={`hv-opts hv-${q.type}`} role="radiogroup" aria-label={`Aufgabe ${q.number}`}>
                {q.options.map((o) => {
                  const on = own === o.id; const isKey = r && r.key === o.id;
                  return <button key={o.id} type="button" role="radio" aria-checked={on} disabled={disabled} data-lesen-opt={o.id}
                    className={`${on ? 'on' : ''}${isKey ? ' key' : ''}${r && on && !r.ok ? ' wrong' : ''}`}
                    onClick={() => onPick(q, on ? null : o.id)}>
                    {q.type === 'truefalse' ? o.text : <><b className="hv-dot">{o.id}</b><span>{o.text}</span></>}
                  </button>;
                })}
              </div>
            )}
            {r && <div className="hv-evidence" data-lesen-review={r.ok ? 'ok' : 'ko'}>
              <p>{r.ok ? '✓ Richtig' : <>✗ {own ? `Falsch (tu respuesta: ${label(q, own)})` : 'Sin respuesta'} · Lösung: <b>{label(q, r.key)}</b></>}</p>
              <blockquote lang="es">{r.explain}</blockquote>
            </div>}
          </fieldset>
        );
      })}
    </div>
  );
}
const label = (q: LesenQuestion, id: string) => q.type === 'truefalse' ? (id === 'R' ? 'Richtig' : 'Falsch') : q.type === 'matching' ? (id === '0' ? '0' : `Anzeige ${id}`) : id;

function ScoreCard({ score, exam, repasar, saved }: { score: LesenScore; exam: LesenExam; repasar?: LesenResult['repasar']; saved?: boolean }) {
  return (
    <section className="hv-score" data-lesen-score={score.points} aria-label="Resultado">
      <div className="hv-big"><span className="hv-dot">{score.points}</span><small>/ {score.outOf} Punkte</small></div>
      <p className="hv-mono">{score.percent} % de aciertos</p>
      <ol className="hv-bars">{score.byPart.map((p) => <li key={p.part}><span>Teil {p.part + 1}</span><i style={{ ['--p' as string]: p.points / p.outOf }} /><b className="hv-dot">{p.points}/{p.outOf}</b></li>)}</ol>
      {repasar && (repasar.length
        ? <div className="lv-repasar"><p className="hv-mono">Conviene repasar</p><ul>{repasar.slice(0, 4).map((x) => <li key={x.tag}><b>{x.tag}</b> · {x.wrong} de {x.of} fallada{x.wrong === 1 ? '' : 's'}</li>)}</ul></div>
        : <p className="hv-note">Sin fallos. Nada que repasar.</p>)}
      {saved !== undefined && <p className="hv-note" data-lesen-saved={saved ? '1' : '0'}>{saved ? 'Resultado guardado en tu cuenta.' : 'Sin sesión: el resultado no se guarda en ninguna cuenta.'}</p>}
      <p className="hv-note">{exam.disclaimer}</p>
    </section>
  );
}

function PartTabs({ exam, part, answers, review, onGo }: { exam: LesenExam; part: number; answers: Record<string, string>; review?: Record<string, LesenReviewItem>; onGo: (i: number) => void }) {
  return (
    <nav className="hv-steps lv-steps" aria-label="Teile">
      {exam.parts.map((p, i) => {
        const n = p.questions.filter((q) => answers[q.id]).length; const ok = review ? p.questions.filter((q) => review[q.id]?.ok).length : null;
        return <button key={p.id} type="button" aria-current={i === part ? 'step' : undefined} data-lesen-tab={i} className={`${i === part ? 'on' : ''}${n === p.questions.length ? ' full' : ''}`} onClick={() => onGo(i)}>
          <span className="hv-dot">{p.n}</span><span className="lv-tab-name" lang="de">{p.title}</span><small>{ok !== null ? `${ok}/${p.questions.length} ✓` : `${n}/${p.questions.length}`}</small>
        </button>;
      })}
    </nav>
  );
}

/** Texto a la izquierda (siempre visible, con su propio scroll en escritorio) y preguntas a la derecha. */
function PartStage({ part, children, clock }: { part: LesenPart; children: ReactNode; clock?: ReactNode }) {
  return (
    <section className="lv-stage hv-enter" key={part.id} data-lesen-part={part.n}>
      <header className="hv-part-head lv-part-head" lang="de">
        <p className="hv-mono">Teil {part.n} · {part.kind} · Aufgaben {part.questions[0].number}–{part.questions[part.questions.length - 1].number} · {part.minutes} min empfohlen</p>
        <h2>{part.title}</h2>
        {part.instruction.map((l) => <p key={l} className="hv-instr">{l}</p>)}
        {clock}
      </header>
      <div className="lv-split">
        <ReadingText part={part} />
        <div className="lv-answer">{children}</div>
      </div>
    </section>
  );
}

/* ───────────────────────────── Práctica ───────────────────────────── */
interface PracticeState { attempt: string; answers: Record<string, string>; part: number; elapsed: number; partMs: Record<number, number>; result: LesenResult | null }
const freshPractice = (): PracticeState => ({ attempt: newAttempt(), answers: {}, part: 0, elapsed: 0, partMs: {}, result: null });
function loadPractice(): PracticeState {
  try { const s = JSON.parse(store.get(PRACTICE) ?? 'null'); if (s && typeof s.attempt === 'string' && s.answers && typeof s.answers === 'object') return { ...freshPractice(), ...s }; } catch { /* nada guardado */ }
  return freshPractice();
}

function Practice({ onExit }: { onExit: () => void }) {
  const [exam, setExam] = useState<LesenExam | null>(null);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [s, setS] = useState<PracticeState>(loadPractice);
  useEffect(() => { api<{ exam: LesenExam }>('exam').then((r) => setExam(r.exam)).catch((e: Error) => setErr(e.message)); }, []);
  useEffect(() => { store.set(PRACTICE, JSON.stringify(s)); }, [s]);
  // Reloj: solo corre con la pestaña visible y antes de corregir. Nunca bloquea al alumno.
  const done = !!s.result;
  useEffect(() => {
    if (done) return;
    const id = window.setInterval(() => { if (document.visibilityState === 'visible') setS((x) => ({ ...x, elapsed: x.elapsed + 1000, partMs: { ...x.partMs, [x.part]: (x.partMs[x.part] ?? 0) + 1000 } })); }, 1000);
    return () => clearInterval(id);
  }, [done]);
  useEffect(() => { window.scrollTo?.({ top: 0 }); }, [s.part]);
  if (err && !exam) return <p className="hv-error" role="alert">{err}</p>;
  if (!exam) return <p role="status" className="hv-note">Cargando el examen…</p>;
  const part = exam.parts[s.part];
  const review = s.result ? Object.fromEntries(s.result.review.map((r) => [r.id, r])) : undefined;
  const answered = Object.keys(s.answers).length;
  const pick = (q: LesenQuestion, v: string | null) => setS((x) => {
    if (x.result) return x;
    if (q.type === 'matching' && matchingConflict(exam.parts[x.part], x.answers, q.id, v)) return x;
    const a = { ...x.answers }; if (v === null) delete a[q.id]; else a[q.id] = v; return { ...x, answers: a };
  });
  const finish = async () => {
    const left = TOTAL - answered;
    if (left && !confirm(`Te faltan ${left} respuesta${left === 1 ? '' : 's'}: contarán como 0. ¿Terminar y corregir?`)) return;
    setBusy(true); setErr('');
    try { const r = await api<LesenResult>('practice/check', { body: { attempt: s.attempt, answers: s.answers, finish: true } }); setS((x) => ({ ...x, result: r, part: 0 })); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const goPart = (i: number) => setS((x) => ({ ...x, part: i }));
  const partSpent = s.partMs[s.part] ?? 0; const over = partSpent > part.minutes * 60_000;
  const clock = !done && <p className={`lv-clock${over ? ' over' : ''}`} data-lesen-clock="" aria-live="off"><span className="hv-mono">En este Teil</span> <b className="hv-dot">{mmss(partSpent / 1000)}</b> <span className="hv-mono">/ {part.minutes}:00 recomendados{over ? ' · puedes seguir' : ''}</span></p>;
  return (
    <div className="hv-layout lv-layout" data-lesen-practice-part={s.part} data-lesen-done={done ? '1' : '0'}>
      <PartTabs exam={exam} part={s.part} answers={s.answers} review={review} onGo={goPart} />
      <div className="lv-main">
        <PartStage part={part} clock={clock}>
          <Questions part={part} answers={s.answers} disabled={done} review={review} onPick={pick} />
          <div className="hv-nav-row">{s.part > 0 && <button type="button" className="dt-btn dt-btn-ghost" data-lesen-prev="" onClick={() => goPart(s.part - 1)}><span className="dt-btn-label">← Teil {s.part}</span></button>}<span className="spacer" />{s.part < exam.parts.length - 1 && <button type="button" className="dt-btn dt-btn-ghost" data-lesen-next="" onClick={() => goPart(s.part + 1)}><span className="dt-btn-label">Teil {s.part + 2} →</span></button>}</div>
        </PartStage>
      </div>
      <aside className="hv-side">
        <div className="hv-card">
          <p className="hv-mono">Fortschritt</p>
          <div className="hv-meter"><span style={{ width: `${(answered / TOTAL) * 100}%` }} /></div>
          <p className="hv-stat"><b className="hv-dot" data-lesen-answered={answered}>{answered}</b>/{TOTAL} respondidas</p>
          <p className="hv-stat lv-total" data-lesen-elapsed=""><b className="hv-dot">{mmss(s.elapsed / 1000)}</b> / 45:00 min</p>
          {!done ? <button type="button" className="dt-btn dt-btn-primary" data-lesen-finish="" disabled={busy} onClick={() => { void finish(); }}><span className="dt-btn-label">{busy ? 'Corrigiendo…' : 'Terminar y corregir'}</span></button>
            : <button type="button" className="dt-btn dt-btn-ghost" data-lesen-restart="" onClick={() => { if (confirm('¿Empezar un intento nuevo desde cero?')) setS(freshPractice()); }}><span className="dt-btn-label">Nuevo intento</span></button>}
          {err && <p className="hv-error" role="alert">{err}</p>}
          <button type="button" className="hv-link" onClick={onExit}>Salir (se guarda lo que llevas)</button>
        </div>
        {s.result && <ScoreCard score={s.result.score} exam={exam} repasar={s.result.repasar} saved={s.result.saved} />}
        {!s.result && <p className="hv-note">Las soluciones no están en esta página: las da el servidor solo al terminar.</p>}
      </aside>
    </div>
  );
}

/* ───────────────────────────── Clase ───────────────────────────── */
function useRoom(code: string, token: string) {
  const [v, setV] = useState<LesenView | null>(null); const [error, setError] = useState('');
  useEffect(() => {
    let alive = true; let t = 0;
    const poll = async () => {
      try { const x = await api<LesenView>(`state?code=${code}`, { token }); if (alive) { setV(x); setError(''); } } catch (e) { if (alive) setError((e as Error).message); }
      if (alive) t = window.setTimeout(() => { void poll(); }, 2000);
    };
    void poll(); return () => { alive = false; clearTimeout(t); };
  }, [code, token]);
  const act = async (a: LesenAction) => { try { setV(await api<LesenView>('action', { token, body: { code, action: a } })); setError(''); } catch (e) { setError((e as Error).message); } };
  return { v, error, act };
}

function Room({ code, token, role, onLeave }: { code: string; token: string; role: 'teacher' | 'player'; onLeave: () => void }) {
  const { v, error, act } = useRoom(code, token);
  const [part, setPart] = useState(0);
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(id); }, []);
  const [local, setLocal] = useState<Record<string, string> | null>(null);
  useEffect(() => { if (v?.ownAnswers) setLocal(null); }, [v?.ownAnswers]);
  if (!v) return <div className="hv-card"><p role="status">{error ? <>{error} <button type="button" className="hv-link" onClick={onLeave}>Volver</button></> : 'Conectando con la sala…'}</p></div>;
  const elapsed = v.startedAt ? ((v.finishedAt ?? v.serverNow) - v.startedAt) / 1000 : 0;
  const status = <section className="hv-hud lv-hud" aria-live="polite"><div className="hv-hud-row">
    <span className={`hv-led${v.status === 'running' ? ' on' : ''}`} aria-hidden="true" />
    <span className="hv-mono">{v.status === 'lobby' ? 'Warten auf Start' : v.status === 'finished' ? 'Prüfung beendet' : 'Prüfung läuft'}</span>
    <span className="spacer" />{v.status !== 'lobby' && <span className="hv-clock hv-dot lv-room-clock" data-lesen-clock="">{mmss(elapsed)}<small className="hv-mono"> / 45:00</small></span>}
  </div>{error && <p className="hv-error" role="alert">{error}</p>}</section>;
  if (role === 'teacher') return <div className="lv-room">{status}<TeacherPanel v={v} act={act} /></div>;

  const answers = local ?? v.ownAnswers ?? {};
  const review = v.result ? Object.fromEntries(v.result.review.map((r) => [r.id, r])) : undefined;
  const p = v.exam.parts[part];
  const pick = (q: LesenQuestion, val: string | null) => {
    if (q.type === 'matching' && matchingConflict(p, answers, q.id, val)) return;
    const a = { ...answers }; if (val === null) delete a[q.id]; else a[q.id] = val; setLocal(a);
    void act({ type: 'answer', questionId: q.id, value: val });
  };
  return (
    <div className="lv-room" data-lesen-status={v.status}>
      {status}
      {v.status === 'lobby' && <section className="hv-card" lang="de"><h2>Gleich geht es los</h2><p>Ihr Lehrer startet die Prüfung. Danach können Sie die Texte lesen und antworten.</p><p className="hv-note" lang="es">No cierres esta pestaña.</p></section>}
      {v.status !== 'lobby' && <div className="hv-layout lv-layout" data-lesen-room-part={part}>
        <PartTabs exam={v.exam} part={part} answers={answers} review={review} onGo={setPart} />
        <div className="lv-main"><PartStage part={p}>
          <Questions part={p} answers={answers} disabled={v.status !== 'running'} review={review} onPick={pick} />
          <div className="hv-nav-row">{part > 0 && <button type="button" className="dt-btn dt-btn-ghost" onClick={() => setPart(part - 1)}><span className="dt-btn-label">← Teil {part}</span></button>}<span className="spacer" />{part < 4 && <button type="button" className="dt-btn dt-btn-ghost" onClick={() => setPart(part + 1)}><span className="dt-btn-label">Teil {part + 2} →</span></button>}</div>
        </PartStage></div>
        <aside className="hv-side">
          <div className="hv-card"><p className="hv-mono">Fortschritt</p><div className="hv-meter"><span style={{ width: `${(Object.keys(answers).length / TOTAL) * 100}%` }} /></div><p className="hv-stat"><b className="hv-dot">{Object.keys(answers).length}</b>/{TOTAL} respondidas</p>
            {v.status === 'running' && <p className="hv-note">Tus respuestas se guardan en el servidor al marcarlas. El profesor corrige al final.</p>}</div>
          {v.result && <ScoreCard score={v.result.score} exam={v.exam} repasar={v.result.repasar} saved={v.result.saved} />}
        </aside>
      </div>}
    </div>
  );
}

function TeacherPanel({ v, act }: { v: LesenView; act: (a: LesenAction) => Promise<void> }) {
  const [open, setOpen] = useState<string | null>(null);
  const finished = v.status === 'finished';
  const qs = useMemo(() => v.exam.parts.flatMap((p) => p.questions), [v.exam]);
  return (
    <section className="hv-stage hv-teacher" aria-label="Panel privado">
      <div className="hv-ctl-row">
        {v.status === 'lobby' && <button type="button" className="dt-btn dt-btn-primary" data-lesen-start="" disabled={!v.players.length} onClick={() => { void act({ type: 'start' }); }}><span className="dt-btn-label">▶ Empezar ({v.players.length} alumno{v.players.length === 1 ? '' : 's'})</span></button>}
        {v.status === 'running' && <button type="button" className="dt-btn dt-btn-primary" data-lesen-end="" onClick={() => { if (confirm('¿Terminar y corregir ahora? Se bloquean las respuestas.')) void act({ type: 'finish' }); }}><span className="dt-btn-label">Terminar y corregir</span></button>}
        {v.status === 'lobby' && <p className="hv-note">Invitación: <b>{location.origin}{BASE}?code={v.code}</b></p>}
      </div>
      <h2>Alumnos <span className="hv-mono">· no proyectar esta pestaña</span></h2>
      {!v.players.length && <p className="hv-note">Esperando alumnos… comparte el código <b className="hv-dot">{v.code}</b>.</p>}
      <div className="hv-students">{v.players.map((p) => (
        <article key={p.id} className="hv-student" data-lesen-student={p.name}>
          <header><span className={`hv-led${p.connected ? ' on' : ''}`} aria-hidden="true" /><b>{p.name}</b><span className="spacer" /><span className="hv-dot">{p.answered}/{TOTAL}</span></header>
          <div className="hv-meter"><span style={{ width: `${(p.answered / TOTAL) * 100}%` }} /></div>
          {finished && p.score && <><p className="hv-stat"><b className="hv-dot">{p.score.points}</b> / {TOTAL} Punkte · {p.score.percent} %</p>
            <ol className="hv-bars">{p.score.byPart.map((b) => <li key={b.part}><span>Teil {b.part + 1}</span><i style={{ ['--p' as string]: b.points / b.outOf }} /><b className="hv-dot">{b.points}/{b.outOf}</b></li>)}</ol></>}
          <button type="button" className="hv-link" onClick={() => setOpen(open === p.id ? null : p.id)}>{open === p.id ? 'Ocultar respuestas' : 'Ver respuestas'}</button>
          {open === p.id && <ol className="hv-grid">{qs.map((q) => { const a = p.answers?.[q.id]; const ok = finished && v.key ? a === v.key[q.id] : null; return <li key={q.id} className={`${a ? 'given' : 'none'}${ok === true ? ' lv-ok' : ok === false ? ' lv-ko' : ''}`} title={q.prompt}><small>{q.number}</small><b>{a ?? '—'}</b></li>; })}</ol>}
        </article>
      ))}</div>
      {finished && v.key && <details className="hv-card" open data-lesen-analysis="">
        <summary>Análisis por pregunta</summary>
        <ol className="hv-analysis" lang="de">{qs.map((q) => {
          const k = v.key![q.id]; const wrong = v.players.filter((p) => p.answers?.[q.id] !== k);
          return <li key={q.id} className={wrong.length ? 'ko' : 'ok'}>
            <p><span className="hv-dot hv-num">{q.number}</span>{q.prompt} <b className="hv-key">→ {label(q, k)}</b></p>
            <p className="hv-who">{v.players.map((p) => { const a = p.answers?.[q.id]; return <span key={p.id} className={a === k ? 'ok' : 'ko'}>{p.name}: {a ?? '—'}</span>; })}</p>
            <blockquote lang="es">{v.explain?.[q.id]}</blockquote>
          </li>;
        })}</ol>
      </details>}
    </section>
  );
}
