// Hörverstehen 001 — /examenes/horen-001
//  · Práctica (solo): el alumno controla la reproducción (2 escuchas por pista); corrección en el servidor al terminar.
//  · Clase: el profesor crea la sala y controla inicio/pausa/avance; los alumnos responden en sus dispositivos y oyen
//    el audio sincronizado con el reloj del servidor. Sin soluciones ni transcripciones hasta el final.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import type { HorenAction, HorenExam, HorenPart, HorenQuestion, HorenReviewItem, HorenScore, HorenSegment, HorenStep, HorenView } from '../../shared/horen.ts';
import { mmss, navigate, store, teacherKey } from '../util.ts';
import '../horen.css';

type Mode = { kind: 'choose' } | { kind: 'practice' } | { kind: 'room'; code: string; token: string; role: 'teacher' | 'player' };
const SESSION = 'dt:horen:session';
const PRACTICE = 'dt:horen:practice:v1';
const audioUrl = (id: string) => `/api/horen/audio?id=${encodeURIComponent(id)}`;
const STEP_LABEL: Record<HorenStep['kind'], string> = { intro: 'Einführung', instruction: 'Anweisung', read: 'Aufgaben lesen', listen1: '1. Hören', work: 'Arbeitszeit', listen2: '2. Hören', answer: 'Antworten', review: 'Überprüfen', done: 'Ende' };

async function api<T>(path: string, init: { body?: unknown; token?: string } = {}): Promise<T> {
  const r = await fetch(`/api/horen/${path}`, { method: init.body === undefined ? 'GET' : 'POST', cache: 'no-store', headers: { ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}), ...(path === 'create' && teacherKey() ? { 'X-Teacher-Key': teacherKey()! } : {}) }, ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }) });
  let data: unknown; try { data = await r.json(); } catch { throw new Error('Respuesta inválida del servidor.'); }
  if (!r.ok) throw new Error((data as { error?: string })?.error ?? 'No se pudo completar la acción.');
  return data as T;
}
function readSession(): Mode | null { try { const s = JSON.parse(store.get(SESSION) ?? 'null'); return s?.code && s?.token && (s.role === 'teacher' || s.role === 'player') ? { kind: 'room', ...s } : null; } catch { return null; } }

export function Horen() {
  const [mode, setMode] = useState<Mode>(() => {
    const q = new URLSearchParams(location.search);
    if (q.get('modo') === 'practica') return { kind: 'practice' };
    const s = readSession(); if (s && s.kind === 'room' && (!q.get('code') || q.get('code') === s.code)) return s;
    return { kind: 'choose' };
  });
  const enterRoom = (m: Extract<Mode, { kind: 'room' }>) => { store.set(SESSION, JSON.stringify({ code: m.code, token: m.token, role: m.role })); history.replaceState(null, '', `/examenes/horen-001?code=${m.code}`); setMode(m); };
  const leave = () => { store.del(SESSION); history.replaceState(null, '', '/examenes/horen-001'); setMode({ kind: 'choose' }); };
  return (
    <main className="dt-page hv-page" data-horen-mode={mode.kind === 'room' ? mode.role : mode.kind}>
      <header className="hv-head">
        <a className="rs-back" href="/examenes" onClick={(e) => { e.preventDefault(); navigate('/examenes'); }}>← Exámenes de práctica</a>
        <p className="dt-eyebrow">DSD I · adaptado A1–A2 · Hörverstehen</p>
        <h1>Hörverstehen <span className="hv-dot">001</span><b className="dt-punkt">.</b></h1>
        {mode.kind === 'room' && <p className="hv-sub"><span className="hv-led on" aria-hidden="true" />{mode.role === 'teacher' ? 'Profesor · panel privado' : 'Alumno'} · Sala <b className="hv-dot">{mode.code}</b> <button type="button" className="hv-link" onClick={leave}>Salir</button></p>}
      </header>
      {mode.kind === 'choose' && <Choose onPractice={() => { history.replaceState(null, '', '/examenes/horen-001?modo=practica'); setMode({ kind: 'practice' }); }} onRoom={enterRoom} />}
      {mode.kind === 'practice' && <Practice onExit={() => { history.replaceState(null, '', '/examenes/horen-001'); setMode({ kind: 'choose' }); }} />}
      {mode.kind === 'room' && <Room key={`${mode.code}:${mode.role}`} code={mode.code} token={mode.token} role={mode.role} onLeave={leave} />}
    </main>
  );
}

function Choose({ onPractice, onRoom }: { onPractice: () => void; onRoom: (m: Extract<Mode, { kind: 'room' }>) => void }) {
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('code')?.toUpperCase() ?? '');
  const [name, setName] = useState(() => store.get('dt:horen:name') ?? '');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const go = async (kind: 'create' | 'join') => {
    setBusy(true); setErr('');
    try {
      const w = await api<{ code: string; token: string; role: 'teacher' | 'player' }>(kind, { body: kind === 'create' ? {} : { code: code.trim().toUpperCase(), name: name.trim() } });
      if (kind === 'join') store.set('dt:horen:name', name.trim());
      onRoom({ kind: 'room', ...w });
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="hv-choose">
      <section className="hv-card hv-card-main">
        <p className="hv-mono">30 Aufgaben · 5 Teile · 60 min · jeder Text 2×</p>
        <h2>Prüfungssimulation</h2>
        <ol className="hv-teile">{['Alltagssituationen', 'Ein Wochenende', 'Ein Schulausflug', 'Freizeit und Schule', 'Ein Tag voller Überraschungen'].map((t, i) => <li key={t}><span className="hv-dot">{i + 1}</span>{t}</li>)}</ol>
        <button type="button" className="dt-btn dt-btn-primary" data-horen-practice="" onClick={onPractice}><span className="dt-btn-label">Practicar a mi ritmo →</span></button>
        <p className="hv-note">En práctica tú decides cuándo suena cada pista (dos escuchas). La nota sale al terminar.</p>
      </section>
      <form className="hv-card" onSubmit={(e: FormEvent) => { e.preventDefault(); void go('join'); }}>
        <p className="hv-mono">En clase</p>
        <h2>Entrar en la sala</h2>
        <label className="hv-field">Nombre<input className="field" data-horen-name="" required maxLength={32} value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" /></label>
        <label className="hv-field">Código<input className="field hv-dot" data-horen-code="" required maxLength={6} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoCapitalize="characters" /></label>
        <button className="dt-btn dt-btn-primary" data-horen-join="" disabled={busy || !name.trim() || code.trim().length !== 6}><span className="dt-btn-label">Entrar</span></button>
      </form>
      <section className="hv-card">
        <p className="hv-mono">Profesor</p>
        <h2>Dirigir el examen</h2>
        <p className="hv-note">Creas la sala, los alumnos entran con el código y tú controlas inicio, pausas y avance. El audio suena sincronizado en sus dispositivos.</p>
        <button type="button" className="dt-btn dt-btn-ghost" data-horen-create="" disabled={busy} onClick={() => { void go('create'); }}><span className="dt-btn-label">Crear sala</span></button>
      </section>
      {err && <p className="hv-error" role="alert">{err}</p>}
    </div>
  );
}

/* ───────────────────────────── Shared bits ───────────────────────────── */

/** Waveform drawn from the real decoded audio (Web Audio peaks) on a canvas; progress = played portion. */
function Wave({ src, progress, live, label }: { src?: string; progress: number; live: boolean; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  useEffect(() => {
    if (!src) { setPeaks(null); return; }
    let off = false; const ctl = new AbortController();
    (async () => {
      try {
        const buf = await (await fetch(src, { signal: ctl.signal })).arrayBuffer();
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ac = new AC(); const audio = await ac.decodeAudioData(buf); void ac.close();
        const ch = audio.getChannelData(0), n = 120, size = Math.floor(ch.length / n), out: number[] = [];
        for (let i = 0; i < n; i++) { let m = 0; for (let j = i * size; j < (i + 1) * size; j += 16) m = Math.max(m, Math.abs(ch[j])); out.push(m); }
        const max = Math.max(...out, 0.01); if (!off) setPeaks(out.map((v) => v / max));
      } catch { if (!off) setPeaks(null); }
    })();
    return () => { off = true; ctl.abort(); };
  }, [src]);
  useEffect(() => {
    const c = ref.current; if (!c) return; const dpr = Math.min(2, devicePixelRatio || 1);
    const w = c.clientWidth, h = c.clientHeight; c.width = w * dpr; c.height = h * dpr;
    const g = c.getContext('2d'); if (!g) return; g.scale(dpr, dpr); g.clearRect(0, 0, w, h);
    const bars = peaks ?? Array.from({ length: 120 }, (_, i) => 0.12 + 0.08 * Math.sin(i * 0.7));
    const bw = w / bars.length; const css = getComputedStyle(c);
    const red = css.getPropertyValue('--dt-red').trim() || '#e5352b', paper = css.getPropertyValue('--dt-paper-3').trim() || '#666';
    bars.forEach((v, i) => {
      const x = i * bw, bh = Math.max(2, v * (h - 6));
      g.fillStyle = i / bars.length <= progress ? red : paper; g.globalAlpha = i / bars.length <= progress ? 1 : 0.45;
      const r = Math.max(1, bw * 0.28); g.beginPath(); g.arc(x + bw / 2, h / 2 - bh / 2 + r, r, 0, Math.PI * 2); g.fill();
      g.fillRect(x + bw / 2 - r, h / 2 - bh / 2 + r, r * 2, bh - r * 2); g.beginPath(); g.arc(x + bw / 2, h / 2 + bh / 2 - r, r, 0, Math.PI * 2); g.fill();
    });
  }, [peaks, progress]);
  return <div className={`hv-wave${live ? ' is-live' : ''}`}><canvas ref={ref} role="img" aria-label={label} /></div>;
}

function Leds({ listen, of = 2 }: { listen: number; of?: number }) {
  return <span className="hv-leds" aria-label={`Escucha ${Math.min(listen, of)} de ${of}`}>{Array.from({ length: of }, (_, i) => <i key={i} className={i < listen ? 'on' : ''} />)}<b className="hv-mono">{listen ? `${Math.min(listen, of)}. Hören` : 'Noch nicht gehört'}</b></span>;
}

function QuestionBlock({ part, answers, disabled, onPick, review }: { part: HorenPart; answers: Record<string, string>; disabled: boolean; onPick: (q: HorenQuestion, v: string | null) => void; review?: Record<string, HorenReviewItem> }) {
  const usedInPart = new Set(part.questions.filter((q) => q.type === 'matching').map((q) => answers[q.id]).filter(Boolean));
  return (
    <div className="hv-qs" lang="de">
      {part.bank && <ol className="hv-bank" aria-label="Hobbys">{part.bank.map((o) => <li key={o.id} className={usedInPart.has(o.id) ? 'used' : ''}><b className="hv-dot">{o.id}</b>{o.text}</li>)}</ol>}
      {part.questions.map((q) => {
        const r = review?.[q.id]; const own = answers[q.id];
        return (
          <fieldset key={q.id} className={`hv-q${r ? (r.ok ? ' ok' : ' ko') : ''}`} data-horen-q={q.id}>
            <legend><span className="hv-dot hv-num">{q.number}</span>{q.prompt}</legend>
            <div className={`hv-opts hv-${q.type}`} role="radiogroup" aria-label={`Aufgabe ${q.number}`}>
              {q.options.map((o) => {
                const on = own === o.id; const isKey = r && r.key === o.id;
                return <button key={o.id} type="button" role="radio" aria-checked={on} disabled={disabled} data-horen-opt={o.id}
                  className={`${on ? 'on' : ''}${isKey ? ' key' : ''}${r && on && !r.ok ? ' wrong' : ''}`}
                  onClick={() => onPick(q, on ? null : o.id)}>
                  {q.type === 'truefalse' ? o.text : <><b className="hv-dot">{o.id}</b>{q.type === 'matching' ? null : <span>{o.text}</span>}</>}
                </button>;
              })}
            </div>
            {r && <div className="hv-evidence"><p>{r.ok ? '✓ Richtig' : <>✗ {own ? 'Falsch' : 'Keine Antwort'} · Lösung: <b>{r.key}</b>{q.type === 'matching' ? ` — ${part.bank?.find((b) => b.id === r.key)?.text ?? ''}` : ''}</>}</p><blockquote>{r.evidence.map((e) => <span key={e}>„{e.replace(/^„|“$/g, '')}“ </span>)}</blockquote></div>}
          </fieldset>
        );
      })}
    </div>
  );
}

function ScoreCard({ score }: { score: HorenScore }) {
  return (
    <section className="hv-score" data-horen-score={score.points}>
      <div className="hv-big"><span className="hv-dot">{String(score.grade20).replace('.', ',')}</span><small>/ 20</small></div>
      <p className="hv-mono">{score.points} / {score.outOf} Punkte · {Math.round((score.points / score.outOf) * 100)} %</p>
      <ol className="hv-bars">{score.byPart.map((p) => <li key={p.part}><span>Teil {p.part + 1}</span><i style={{ ['--p' as string]: p.points / p.outOf }} /><b className="hv-dot">{p.points}/{p.outOf}</b></li>)}</ol>
    </section>
  );
}

function Transcripts({ exam, scripts }: { exam: HorenExam; scripts: Record<string, HorenSegment[]> }) {
  return <details className="hv-trans" lang="de"><summary>Transkripte (nach der Prüfung)</summary>{exam.parts.map((p) => <section key={p.id}><h3>Teil {p.n} · {p.title}</h3>{scripts[p.audioId]?.map((s, i) => <div key={i}>{s.label && <h4>{s.label}</h4>}{s.turns.map((t, j) => <p key={j}><b>{t.speaker}:</b> {t.text}</p>)}</div>)}</section>)}</details>;
}

/* ───────────────────────────── Practice ───────────────────────────── */
interface PracticeState { answers: Record<string, string>; listens: Record<string, number>; part: number; result: { score: HorenScore; review: HorenReviewItem[]; transcripts: Record<string, HorenSegment[]> } | null }
const EMPTY_P: PracticeState = { answers: {}, listens: {}, part: 0, result: null };

function Practice({ onExit }: { onExit: () => void }) {
  const [exam, setExam] = useState<HorenExam | null>(null); const [durations, setDurations] = useState<Record<string, number>>({});
  const [err, setErr] = useState('');
  const [s, setS] = useState<PracticeState>(() => { try { return { ...EMPTY_P, ...JSON.parse(store.get(PRACTICE) ?? 'null') }; } catch { return EMPTY_P; } });
  const [playing, setPlaying] = useState<{ id: string; t: number; d: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const el = useRef<HTMLAudioElement | null>(null);
  useEffect(() => { api<{ exam: HorenExam; audio: { id: string; duration: number }[] }>('exam').then((r) => { setExam(r.exam); setDurations(Object.fromEntries(r.audio.map((a) => [a.id, a.duration]))); }).catch((e: Error) => setErr(e.message)); }, []);
  useEffect(() => { store.set(PRACTICE, JSON.stringify(s)); }, [s]);
  useEffect(() => () => { const a = el.current; if (a) { a.ontimeupdate = null; a.pause(); } }, []);
  if (err) return <p className="hv-error" role="alert">{err}</p>;
  if (!exam) return <p role="status" className="hv-note">Cargando el examen…</p>;
  const part = exam.parts[s.part]; const done = !!s.result;
  const used = s.listens[part.audioId] ?? 0; const hasAudio = durations[part.audioId] !== undefined;
  const review = s.result ? Object.fromEntries(s.result.review.map((r) => [r.id, r])) : undefined;
  const answered = Object.keys(s.answers).length;
  const play = () => {
    if (used >= 2 || playing) return;
    const a = new Audio(audioUrl(part.audioId)); el.current = a;
    a.ontimeupdate = () => setPlaying({ id: part.audioId, t: a.currentTime, d: a.duration || durations[part.audioId] || 1 });
    a.onended = () => setPlaying(null); a.onerror = () => { setPlaying(null); setErr('No se pudo reproducir el audio.'); };
    void a.play().then(() => { setS((x) => ({ ...x, listens: { ...x.listens, [part.audioId]: (x.listens[part.audioId] ?? 0) + 1 } })); setPlaying({ id: part.audioId, t: 0, d: durations[part.audioId] || 1 }); }).catch(() => setErr('El navegador bloqueó el audio. Pulsa otra vez.'));
  };
  const stop = () => { const a = el.current; if (a) { a.ontimeupdate = null; a.onended = null; a.pause(); } el.current = null; setPlaying(null); };
  const finish = async () => {
    const left = 30 - answered;
    if (left && !confirm(`Te faltan ${left} respuestas: contarán como 0. ¿Terminar?`)) return;
    stop(); setBusy(true);
    try { const r = await api<PracticeState['result']>('practice/check', { body: { answers: s.answers, finish: true } }); setS((x) => ({ ...x, result: r })); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const goPart = (i: number) => { stop(); setS((x) => ({ ...x, part: i })); };
  return (
    <div className="hv-layout" data-horen-practice-part={s.part}>
      <nav className="hv-steps" aria-label="Teile">{exam.parts.map((p, i) => <button key={p.id} type="button" className={`${i === s.part ? 'on' : ''}${p.questions.every((q) => s.answers[q.id]) ? ' full' : ''}`} onClick={() => goPart(i)}><span className="hv-dot">{p.n}</span><small>{p.questions.filter((q) => s.answers[q.id]).length}/6</small></button>)}</nav>
      <section className="hv-stage hv-enter" key={part.id}>
        <header className="hv-part-head" lang="de"><p className="hv-mono">Teil {part.n} · Aufgaben {part.questions[0].number}–{part.questions[5].number}</p><h2>{part.title.charAt(0) + part.title.slice(1).toLowerCase()}</h2>{part.instruction.map((l) => <p key={l} className="hv-instr">{l}</p>)}</header>
        <div className="hv-player">
          <Wave src={hasAudio ? audioUrl(part.audioId) : undefined} progress={playing?.id === part.audioId ? playing.t / playing.d : used ? 1 : 0} live={playing?.id === part.audioId} label={`Audio Teil ${part.n}`} />
          <div className="hv-player-row">
            {playing ? <button type="button" className="dt-btn dt-btn-ghost" onClick={stop}><span className="dt-btn-label">◼ Stopp</span></button>
              : <button type="button" className="dt-btn dt-btn-primary" data-horen-play={part.audioId} disabled={done || used >= 2 || !hasAudio} onClick={play}><span className="dt-btn-label">▶ {used ? 'Zweites Mal hören' : 'Hören'}</span></button>}
            <Leds listen={used + (playing ? 0 : 0)} />
            <span className="hv-mono hv-time">{playing ? `${mmss(playing.t)} / ${mmss(playing.d)}` : hasAudio ? mmss(durations[part.audioId]) : 'Audio no generado'}</span>
          </div>
        </div>
        <QuestionBlock part={part} answers={s.answers} disabled={done} review={review} onPick={(q, v) => setS((x) => { const a = { ...x.answers }; if (v === null) delete a[q.id]; else a[q.id] = v; return { ...x, answers: a }; })} />
        <div className="hv-nav-row">{s.part > 0 && <button type="button" className="dt-btn dt-btn-ghost" onClick={() => goPart(s.part - 1)}><span className="dt-btn-label">← Teil {s.part}</span></button>}<span className="spacer" />{s.part < 4 && <button type="button" className="dt-btn dt-btn-ghost" onClick={() => goPart(s.part + 1)}><span className="dt-btn-label">Teil {s.part + 2} →</span></button>}</div>
      </section>
      <aside className="hv-side">
        <div className="hv-card">
          <p className="hv-mono">Fortschritt</p>
          <div className="hv-meter"><span style={{ width: `${(answered / 30) * 100}%` }} /></div>
          <p className="hv-stat"><b className="hv-dot">{answered}</b>/30 respondidas</p>
          {!done ? <button type="button" className="dt-btn dt-btn-primary" data-horen-finish="" disabled={busy} onClick={() => { void finish(); }}><span className="dt-btn-label">Terminar y corregir</span></button>
            : <button type="button" className="dt-btn dt-btn-ghost" onClick={() => { if (confirm('¿Empezar de cero?')) { stop(); setS(EMPTY_P); } }}><span className="dt-btn-label">Empezar de cero</span></button>}
          <button type="button" className="hv-link" onClick={onExit}>Salir</button>
        </div>
        {s.result && <ScoreCard score={s.result.score} />}
        <p className="hv-note">{exam.disclaimer}</p>
      </aside>
      {s.result && <div className="hv-full"><Transcripts exam={exam} scripts={s.result.transcripts} /></div>}
    </div>
  );
}

/* ───────────────────────────── Class room ───────────────────────────── */
class RoomClient {
  view: HorenView | null = null; error = ''; offset = 0; private timer = 0; private listeners = new Set<() => void>(); private alive = true;
  readonly code: string; readonly token: string;
  constructor(code: string, token: string) { this.code = code; this.token = token; }
  subscribe = (l: () => void) => { this.listeners.add(l); return () => this.listeners.delete(l); };
  snapshot = () => this.view;
  private emit() { for (const l of this.listeners) l(); }
  private accept(v: HorenView, sentAt: number) { const rtt = Date.now() - sentAt; this.offset = v.serverNow + rtt / 2 - Date.now(); this.view = v; this.error = ''; this.emit(); }
  async poll() {
    const t = Date.now();
    try { this.accept(await api<HorenView>(`state?code=${this.code}`, { token: this.token }), t); } catch (e) { this.error = (e as Error).message; this.emit(); }
    if (this.alive) this.timer = window.setTimeout(() => { void this.poll(); }, 1000);
  }
  async act(a: HorenAction) { const t = Date.now(); try { this.accept(await api<HorenView>('action', { token: this.token, body: { code: this.code, action: a } }), t); return true; } catch (e) { this.error = (e as Error).message; this.emit(); return false; } }
  close() { this.alive = false; clearTimeout(this.timer); }
  /** Current (step, elapsed) projected from the last server snapshot. */
  now(v: HorenView) {
    if (v.status !== 'running') return { step: v.step, elapsed: v.stepElapsedMs };
    let step = v.step, elapsed = v.stepElapsedMs + (Date.now() + this.offset - v.serverNow);
    while (step < v.steps.length - 1 && elapsed >= v.steps[step].ms) { elapsed -= v.steps[step].ms; step++; }
    return { step, elapsed };
  }
}

function useFrame(on: boolean) { const [, set] = useState(0); useEffect(() => { if (!on) return; const id = setInterval(() => set((n) => n + 1), 250); return () => clearInterval(id); }, [on]); }

/** Plays the step's audio in sync with the shared clock. Needs one user gesture to unlock autoplay (browser rule). */
function useSyncedAudio(v: HorenView | null, pos: { step: number; elapsed: number } | null, armed: boolean) {
  const el = useRef<HTMLAudioElement | null>(null); const cur = useRef<string>('');
  const step = v && pos ? v.steps[pos.step] : undefined;
  const id = step?.audioId && v?.status === 'running' && armed ? `${pos!.step}:${step.audioId}` : '';
  useEffect(() => {
    if (!id) { el.current?.pause(); cur.current = ''; return; }
    if (cur.current === id && el.current && !el.current.paused) {
      // Drift correction: only if more than 1.5 s away from the shared clock.
      const want = pos!.elapsed / 1000; if (Math.abs(el.current.currentTime - want) > 1.5) el.current.currentTime = want;
      return;
    }
    cur.current = id; el.current?.pause();
    const a = new Audio(audioUrl(step!.audioId!)); el.current = a;
    a.currentTime = pos!.elapsed / 1000;
    a.addEventListener('loadedmetadata', () => { if (cur.current === id) a.currentTime = Math.max(0, pos!.elapsed / 1000); }, { once: true });
    // Observable playback state (used by the browser checks): set only when sound is really running.
    const root = document.documentElement;
    a.addEventListener('playing', () => { if (cur.current === id) root.dataset.horenPlaying = step!.audioId!; });
    a.addEventListener('pause', () => { if (root.dataset.horenPlaying === step!.audioId) delete root.dataset.horenPlaying; });
    void a.play().catch(() => { /* gesture lost: the arm button reappears */ });
  });
  useEffect(() => () => { el.current?.pause(); delete document.documentElement.dataset.horenPlaying; }, []);
}

function Room({ code, token, role, onLeave }: { code: string; token: string; role: 'teacher' | 'player'; onLeave: () => void }) {
  const client = useMemo(() => new RoomClient(code, token), [code, token]);
  const v = useSyncExternalStore(client.subscribe, client.snapshot);
  const [armed, setArmed] = useState(false);
  const [mute, setMute] = useState(role === 'teacher');
  useEffect(() => { void client.poll(); return () => client.close(); }, [client]);
  useFrame(v?.status === 'running');
  const pos = v ? client.now(v) : null;
  useSyncedAudio(v, pos, armed && !mute);
  if (!v) return <div className="hv-card"><p role="status">{client.error ? <>{client.error} <button type="button" className="hv-link" onClick={onLeave}>Volver</button></> : 'Conectando con la sala…'}</p></div>;
  const step = v.steps[pos!.step]; const part = v.exam.parts[step.part];
  const left = Math.max(0, step.ms - pos!.elapsed);
  const total = v.steps.reduce((s, x) => s + x.ms, 0); const before = v.steps.slice(0, pos!.step).reduce((s, x) => s + x.ms, 0);
  const progress = v.status === 'lobby' ? 0 : v.status === 'finished' ? 1 : (before + pos!.elapsed) / total;
  const audioStep = !!step.audioId; const listen = step.kind === 'listen1' ? 1 : step.kind === 'listen2' ? 2 : ['work', 'answer'].includes(step.kind) ? (step.kind === 'work' ? 1 : 2) : 0;
  const teacher = role === 'teacher'; const finished = v.status === 'finished';
  const review = v.review ? Object.fromEntries(v.review.map((r) => [r.id, r])) : undefined;
  const answers = v.ownAnswers ?? {};
  const canAnswer = !teacher && v.status === 'running';
  const pick = (q: HorenQuestion, val: string | null) => { void client.act({ type: 'answer', questionId: q.id, value: val }); };
  return (
    <div className="hv-layout" data-horen-status={v.status} data-horen-step={step.kind}>
      <section className="hv-hud" aria-live="polite">
        <div className="hv-hud-row">
          <span className={`hv-led${v.status === 'running' ? ' on' : v.status === 'paused' ? ' warn' : ''}`} aria-hidden="true" />
          <span className="hv-mono">{v.status === 'lobby' ? 'Warten auf Start' : v.status === 'paused' ? 'Pause' : finished ? 'Prüfung beendet' : `Teil ${part.n} · ${STEP_LABEL[step.kind]}`}</span>
          <span className="spacer" />
          {!finished && v.status !== 'lobby' && <span className="hv-clock hv-dot" data-horen-clock="">{mmss(left / 1000)}</span>}
        </div>
        <div className="hv-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          {v.exam.parts.map((p, i) => { const own = v.steps.filter((s) => s.part === i && s.kind !== 'review' && s.kind !== 'done').reduce((s, x) => s + x.ms, 0); return <i key={p.id} style={{ flexGrow: own }} className={i < step.part || finished ? 'done' : i === step.part && v.status !== 'lobby' ? 'now' : ''} />; })}
          <i style={{ flexGrow: v.exam.reviewMinutes * 60_000 }} className={finished ? 'done' : step.kind === 'review' ? 'now' : ''} />
          <b style={{ left: `${progress * 100}%` }} />
        </div>
        {v.status !== 'lobby' && !finished && <div className="hv-player">
          <Wave src={audioStep ? audioUrl(step.audioId!) : part ? audioUrl(part.audioId) : undefined} progress={audioStep ? pos!.elapsed / Math.max(1, step.ms) : listen >= 2 && step.kind === 'answer' ? 1 : listen ? 1 : 0} live={audioStep && v.status === 'running'} label="Audio" />
          <div className="hv-player-row"><Leds listen={listen} />
            {(!armed || mute) && <button type="button" className={`dt-btn ${teacher ? 'dt-btn-ghost' : 'dt-btn-primary'}`} data-horen-arm="" onClick={() => { setArmed(true); setMute(false); }}><span className="dt-btn-label">🔊 {teacher ? 'Escuchar también aquí' : 'Activar sonido'}</span></button>}
            {armed && !mute && teacher && <button type="button" className="hv-link" onClick={() => setMute(true)}>Silenciar este equipo</button>}
          </div>
        </div>}
        {teacher && <TeacherControls v={v} pos={pos!} act={(a) => { void client.act(a); }} />}
        {client.error && <p className="hv-error" role="alert">{client.error}</p>}
      </section>

      {v.status === 'lobby' && !teacher && <section className="hv-stage hv-card" lang="de"><h2>Gleich geht es los</h2>{v.exam.general.map((l) => <p key={l}>{l}</p>)}<button type="button" className="dt-btn dt-btn-primary" data-horen-arm="" disabled={armed} onClick={() => setArmed(true)}><span className="dt-btn-label">{armed ? 'Sonido activado ✓' : '🔊 Activar sonido ahora'}</span></button><p className="hv-note">Usa auriculares. El audio empieza solo cuando el profesor arranque.</p></section>}

      {!teacher && v.status !== 'lobby' && !finished && part && <section className="hv-stage hv-enter" key={part.id}>
        <header className="hv-part-head" lang="de"><p className="hv-mono">Teil {part.n} · Aufgaben {part.questions[0].number}–{part.questions[5].number}</p><h2>{part.title.charAt(0) + part.title.slice(1).toLowerCase()}</h2>{part.instruction.map((l) => <p key={l} className="hv-instr">{l}</p>)}</header>
        <QuestionBlock part={part} answers={answers} disabled={!canAnswer} onPick={pick} />
        {step.kind === 'review' && <OtherParts exam={v.exam} answers={answers} current={part.n} disabled={!canAnswer} onPick={pick} />}
      </section>}

      {!teacher && finished && <section className="hv-stage">
        {v.ownScore && <ScoreCard score={v.ownScore} />}
        {v.exam.parts.map((p) => <div key={p.id} className="hv-card"><h3 lang="de">Teil {p.n} · {p.title.charAt(0) + p.title.slice(1).toLowerCase()}</h3><QuestionBlock part={p} answers={answers} disabled review={review} onPick={() => {}} /></div>)}
        {v.transcripts && <Transcripts exam={v.exam} scripts={v.transcripts} />}
      </section>}

      {teacher && <TeacherPanel v={v} />}
    </div>
  );
}

function OtherParts({ exam, answers, current, disabled, onPick }: { exam: HorenExam; answers: Record<string, string>; current: number; disabled: boolean; onPick: (q: HorenQuestion, v: string | null) => void }) {
  return <details className="hv-card" open><summary>Überprüfen: alle Teile</summary>{exam.parts.filter((p) => p.n !== current).map((p) => <div key={p.id}><h3 lang="de">Teil {p.n}</h3><QuestionBlock part={p} answers={answers} disabled={disabled} onPick={onPick} /></div>)}</details>;
}

function TeacherControls({ v, pos, act }: { v: HorenView; pos: { step: number; elapsed: number }; act: (a: HorenAction) => void }) {
  const lobby = v.status === 'lobby', finished = v.status === 'finished';
  return (
    <div className="hv-controls" aria-label="Controles del profesor">
      {lobby && <>
        {v.audio.length < 10 && <p className="hv-error" role="alert">Faltan pistas de audio en el servidor ({v.audio.length}/10). Genera el audio antes de empezar.</p>}
        {v.warnings.map((w) => <p key={w} className="hv-warn" role="alert">⚠ {w}</p>)}
        <div className="hv-adjust">{v.exam.parts.map((p, i) => <label key={p.id}><span className="hv-mono">Teil {p.n}</span><input type="number" min={3} max={30} value={p.minutes} onChange={(e) => act({ type: 'adjust', part: i, minutes: Number(e.target.value) })} /> min</label>)}<span className="hv-mono">+ {v.exam.reviewMinutes} min revisión = {v.exam.parts.reduce((s, p) => s + p.minutes, 0) + v.exam.reviewMinutes} min</span></div>
        <button type="button" className="dt-btn dt-btn-primary" data-horen-start="" disabled={!v.players.length || v.audio.length < 10} onClick={() => act({ type: 'start' })}><span className="dt-btn-label">▶ Empezar examen ({v.players.length} alumno{v.players.length === 1 ? '' : 's'})</span></button>
        <p className="hv-note">Invitación: <b>{location.origin}/examenes/horen-001?code={v.code}</b></p>
      </>}
      {!lobby && !finished && <div className="hv-ctl-row">
        <button type="button" className="dt-btn dt-btn-ghost" data-horen-prev="" disabled={pos.step === 0} onClick={() => act({ type: 'prev' })}><span className="dt-btn-label">⏮ Paso anterior</span></button>
        {v.status === 'running' ? <button type="button" className="dt-btn dt-btn-primary" data-horen-pause="" onClick={() => act({ type: 'pause' })}><span className="dt-btn-label">❚❚ Pausar</span></button>
          : <button type="button" className="dt-btn dt-btn-primary" data-horen-resume="" onClick={() => act({ type: 'resume' })}><span className="dt-btn-label">▶ Reanudar</span></button>}
        <button type="button" className="dt-btn dt-btn-ghost" data-horen-next="" onClick={() => act({ type: 'next' })}><span className="dt-btn-label">Siguiente paso ⏭</span></button>
        <button type="button" className="hv-link" data-horen-end="" onClick={() => { if (confirm('¿Terminar el examen ahora? Se bloquean las respuestas.')) act({ type: 'finish' }); }}>Terminar examen</button>
      </div>}
      {!lobby && <ol className="hv-timeline">{v.steps.filter((s) => s.kind !== 'done').map((s, i) => <li key={i} className={i < pos.step || finished ? 'done' : i === pos.step ? 'now' : ''} style={{ flexGrow: Math.max(1, s.ms / 1000) }} title={`Teil ${s.part + 1} · ${STEP_LABEL[s.kind]} · ${mmss(s.ms / 1000)}`} />)}</ol>}
    </div>
  );
}

function TeacherPanel({ v }: { v: HorenView }) {
  const [open, setOpen] = useState<string | null>(null);
  const finished = v.status === 'finished';
  return (
    <section className="hv-stage hv-teacher" aria-label="Panel privado">
      <h2>Alumnos <span className="hv-mono">· no proyectar esta pestaña</span></h2>
      {!v.players.length && <p className="hv-note">Esperando alumnos… comparte el código <b className="hv-dot">{v.code}</b>.</p>}
      <div className="hv-students">{v.players.map((p) => (
        <article key={p.id} className="hv-student" data-horen-student={p.name}>
          <header><span className={`hv-led${p.connected ? ' on' : ''}`} aria-hidden="true" /><b>{p.name}</b><span className="spacer" /><span className="hv-dot">{p.answered}/30</span></header>
          <div className="hv-meter"><span style={{ width: `${(p.answered / 30) * 100}%` }} /></div>
          {finished && p.score && <><p className="hv-stat"><b className="hv-dot">{String(p.score.grade20).replace('.', ',')}</b> / 20 · {p.score.points}/30 Punkte</p>
            <ol className="hv-bars">{p.score.byPart.map((b) => <li key={b.part}><span>Teil {b.part + 1}</span><i style={{ ['--p' as string]: b.points / b.outOf }} /><b className="hv-dot">{b.points}/{b.outOf}</b></li>)}</ol></>}
          <button type="button" className="hv-link" onClick={() => setOpen(open === p.id ? null : p.id)}>{open === p.id ? 'Ocultar respuestas' : finished ? 'Análisis de errores' : 'Ver respuestas'}</button>
          {open === p.id && <ol className="hv-grid">{v.exam.parts.flatMap((part) => part.questions).map((q) => { const a = p.answers?.[q.id]; return <li key={q.id} className={finished && p.score ? (a ? 'given' : 'none') : a ? 'given' : 'none'} title={q.prompt}><small>{q.number}</small><b>{a ?? '—'}</b></li>; })}</ol>}
        </article>
      ))}</div>
      {finished && v.transcripts && <Transcripts exam={v.exam} scripts={v.transcripts} />}
      {finished && <TeacherKeyReview v={v} />}
    </section>
  );
}

/** After the exam: per-question error analysis for the whole class (key + the audio sentence that proves it). */
function TeacherKeyReview({ v }: { v: HorenView }) {
  if (!v.key) return null;
  return (
    <details className="hv-card" open data-horen-analysis="">
      <summary>Análisis por pregunta</summary>
      <ol className="hv-analysis" lang="de">{v.exam.parts.flatMap((part) => part.questions.map((q) => {
        const k = v.key![q.id]; const wrong = v.players.filter((p) => p.answers?.[q.id] !== k);
        return <li key={q.id} className={wrong.length ? 'ko' : 'ok'}>
          <p><span className="hv-dot hv-num">{q.number}</span>{q.prompt} <b className="hv-key">→ {k}</b></p>
          <p className="hv-who">{v.players.map((p) => { const a = p.answers?.[q.id]; return <span key={p.id} className={a === k ? 'ok' : 'ko'}>{p.name}: {a ?? '—'}</span>; })}</p>
          <blockquote>{v.evidence?.[q.id]?.map((e) => <span key={e}>„{e.replace(/^„|“$/g, '')}“ </span>)}</blockquote>
        </li>;
      }))}</ol>
    </details>
  );
}
