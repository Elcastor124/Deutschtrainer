// Redet mit Klaus — conversación guiada por situaciones (/hablar). Klaus responde en alemán sencillo y marca los errores de cada mensaje.
// Sin IA configurada, Klaus sigue el guion de práctica del escenario y la corrección usa los patrones deterministas del servidor: se dice así.
// Voz: el servidor (si tiene proveedor real) o la voz alemana del navegador, siempre a petición del alumno (sin autoplay).
// Dictado: solo si el servidor tiene STT real; si no, se escribe. Nunca se evalúa la pronunciación.
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import type { AiLevel } from '../../shared/klaus-ai.ts';
import {
  klausStatus, newRequestId, quotaLeft, redetEnd, redetScenarios, redetSession, redetSessions, redetStart, redetStt, redetTts, redetTurn,
  type KlausStatus, type RedetCorrectionView, type RedetScenarioInfo, type RedetSessionInfo, type RedetSessionView, type RedetSummaryView,
} from '../klaus-ai-client.ts';
import { studentSession } from '../util.ts';
import { KlausFigure } from '../klaus/KlausFigure.tsx';
import { KlausGate } from '../klaus/KlausGate.tsx';
import { useKlausSkin } from '../klaus/skin-client.ts';
import type { KlausReaction } from '../klaus/events.ts';
import { speak, stopSpeaking, useBrowserVoices } from '../klaus/speech.ts';
import { Segmented } from '../components/Segmented.tsx';
import '../redet.css';

interface Line { role: 'student' | 'klaus'; text: string; corrections?: RedetCorrectionView[]; source?: 'mock' | 'ai'; fresh?: boolean }
const KIND_LABEL: Record<RedetCorrectionView['kind'], string> = { error: 'Error', unnatural: 'Poco natural', style: 'Alternativa' };

export function Redet() {
  const loggedIn = !!studentSession();
  const look = useKlausSkin();
  const [status, setStatus] = useState<KlausStatus | null>(null);
  const [scenarios, setScenarios] = useState<RedetScenarioInfo[] | null>(null);
  const [sessions, setSessions] = useState<RedetSessionInfo[]>([]);
  const [level, setLevel] = useState<AiLevel>('A1');
  const [conv, setConv] = useState<RedetSessionView | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [summary, setSummary] = useState<RedetSummaryView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'start' | 'turn' | 'end' | 'stt'>(null);
  const [reaction, setReaction] = useState<KlausReaction>('waving');

  const refresh = useCallback(async () => {
    const [st, sc, ss] = await Promise.all([klausStatus(), redetScenarios(), redetSessions()]);
    setStatus(st); setScenarios(sc.scenarios); setSessions(ss.sessions);
  }, []);
  useEffect(() => { if (loggedIn) refresh().catch((e: Error) => setErr(e.message)); }, [loggedIn, refresh]);
  useEffect(() => () => stopSpeaking(), []);

  const scenario = useMemo(() => (conv && scenarios ? scenarios.find((s) => s.id === conv.scenarioId) ?? null : null), [conv, scenarios]);
  const open = (s: RedetSessionView, fromHistory: boolean) => {
    setConv(s); setSummary(s.summary); setErr(null);
    setLines(s.turns.map((t) => ({ role: t.role, text: t.text, fresh: !fromHistory })));
    setReaction(s.summary ? 'complete' : 'waving');
    window.scrollTo({ top: 0 });
  };
  const start = async (id: string) => {
    setBusy('start'); setErr(null);
    try { const r = await redetStart(id, level); open(r.session, false); } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };
  const resume = async (id: string) => {
    setBusy('start'); setErr(null);
    try { const r = await redetSession(id); open(r.session, true); } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };
  const back = () => { stopSpeaking(); setConv(null); setLines([]); setSummary(null); setReaction('waving'); refresh().catch(() => {}); };

  if (!loggedIn) return (
    <main className="dt-page rd-page">
      <header className="rd-head"><p className="dt-eyebrow">Redet mit Klaus</p><h1>Habla con Klaus<b className="dt-punkt">.</b></h1></header>
      <KlausGate kind="hablar" className="rd-gate" back="/hablar" look={look}
        title="Entra para empezar una conversación con Klaus."
        lead="Elige una situación (restaurante, tienda, presentarte…) y contesta en alemán. Klaus te sigue la conversación y te marca cada error con la forma correcta."
        perks={[['7 situaciones de A1 y A2', 'Del «Wie heißt du?» a pedir en un restaurante.'], ['Corrección en cada mensaje', 'Ves qué falló, por qué y cómo se dice bien.'], ['Escucha a Klaus', 'Cada respuesta se puede oír en alemán.']]} />
    </main>
  );

  if (conv) return <Conversation conv={conv} scenario={scenario} lines={lines} setLines={setLines} summary={summary} setSummary={setSummary}
    status={status} setStatus={setStatus} busy={busy} setBusy={setBusy} err={err} setErr={setErr} reaction={reaction} setReaction={setReaction} look={look} onBack={back} />;

  const left = quotaLeft(status, 'text');
  const openOnes = sessions.filter((s) => !s.endedAt), done = sessions.filter((s) => s.endedAt && s.summary).slice(0, 4);
  const name = (id: string) => scenarios?.find((s) => s.id === id)?.title ?? id;
  return (
    <main className="dt-page rd-page">
      <header className="rd-head">
        <p className="dt-eyebrow">Redet mit Klaus</p>
        <h1>Habla con Klaus<b className="dt-punkt">.</b></h1>
        <p className="rd-lede">Elige una situación y responde en alemán. Klaus te contesta y te señala lo que puedes decir mejor.</p>
        <Status status={status} left={left} />
      </header>
      {err && <p className="rd-err" role="alert">{err}</p>}
      {openOnes.length > 0 && (
        <section className="rd-open" aria-label="Conversaciones abiertas">
          <h2 className="rd-mono">Sin terminar</h2>
          <ul>{openOnes.map((s) => <li key={s.id}><span><b>{name(s.scenarioId)}</b> <span className="rd-dim">{s.level} · {s.turns} mensajes</span></span>
            <button type="button" className="btn" disabled={!!busy} onClick={() => void resume(s.id)}>Continuar</button></li>)}</ul>
        </section>
      )}
      <section className="rd-pick" aria-labelledby="rd-pick-h">
        <div className="rd-pick-top"><h2 id="rd-pick-h">Situaciones</h2><Segmented label="Nivel" value={level} onChange={setLevel} options={[{ id: 'A1', label: 'A1' }, { id: 'A2', label: 'A2' }]} /></div>
        {!scenarios ? <p className="rd-dim">Cargando situaciones…</p> : (
          <ol className="rd-scenes">
            {scenarios.map((s, i) => {
              const ok = s.levels.includes(level);
              return (
                <li key={s.id} className={`rd-scene${ok ? '' : ' is-off'}`} style={{ '--i': i } as CSSProperties}>
                  <span className="rd-scene-n dotnum" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                  <div className="rd-scene-body">
                    <p className="rd-mono" lang="de">{s.de}</p>
                    <h3>{s.title}</h3>
                    <p className="rd-scene-intro">{s.intro}</p>
                    <p className="rd-scene-open" lang="de">«{s.opening}»</p>
                  </div>
                  <div className="rd-scene-act">
                    {ok ? <button type="button" className="btn primary" disabled={!!busy || openOnes.length >= 3} onClick={() => void start(s.id)} aria-label={`Empezar: ${s.title}`}>Empezar</button>
                      : <span className="rd-dim">Solo {s.levels.join(' / ')}</span>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {openOnes.length >= 3 && <p className="rd-note">Tienes 3 conversaciones sin terminar: termina alguna para empezar otra.</p>}
      </section>
      {done.length > 0 && (
        <section className="rd-past" aria-label="Conversaciones terminadas">
          <h2 className="rd-mono">Terminadas</h2>
          <ul>{done.map((s) => <li key={s.id}><span><b>{name(s.scenarioId)}</b> <span className="rd-dim">{s.level} · {s.summary!.mistakes.length} errores · {s.summary!.expressions.length} expresiones</span></span>
            <button type="button" className="btn" disabled={!!busy} onClick={() => void resume(s.id)}>Ver resumen</button></li>)}</ul>
        </section>
      )}
    </main>
  );
}

function Status({ status, left }: { status: KlausStatus | null; left: number | null }) {
  const voices = useBrowserVoices();
  if (!status) return null;
  const voice = status.providers.tts.real ? 'Voz: servidor' : voices.de ? 'Voz: navegador' : 'Voz: no disponible';
  return (
    <p className="rd-status">
      <span className={`kw-chip${status.plan === 'plus' ? ' plus' : ''}`}>{status.plan === 'plus' ? 'Plus' : 'Free'}</span>
      <span>{left} de {status.quota.text.limit} mensajes hoy</span>
      {!status.providers.llm.real && <span className="kw-chip mock" title="Sin IA configurada: Klaus sigue un guion de práctica.">Modo práctica</span>}
      <span className="rd-dim">{voice}</span>
      <span className="rd-dim">{status.providers.stt.real ? 'Dictado: disponible' : 'Dictado: no configurado'}</span>
    </p>
  );
}

function Conversation(p: {
  conv: RedetSessionView; scenario: RedetScenarioInfo | null; lines: Line[]; setLines: (f: (l: Line[]) => Line[]) => void;
  summary: RedetSummaryView | null; setSummary: (s: RedetSummaryView) => void; status: KlausStatus | null; setStatus: (s: KlausStatus) => void;
  busy: null | string; setBusy: (b: null | 'start' | 'turn' | 'end' | 'stt') => void; err: string | null; setErr: (e: string | null) => void;
  reaction: KlausReaction; setReaction: (r: KlausReaction) => void; look: ReturnType<typeof useKlausSkin>; onBack: () => void;
}) {
  const { conv, scenario, lines, setLines, summary, status, busy } = p;
  const [text, setText] = useState('');
  const attempt = useRef<{ key: string; id: string } | null>(null);
  const log = useRef<HTMLOListElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const voices = useBrowserVoices();
  const [speaking, setSpeaking] = useState<number | null>(null);
  const left = quotaLeft(status, 'text');
  const ended = !!summary || !!conv.endedAt;
  const corrections = useMemo(() => lines.flatMap((l) => l.corrections ?? []), [lines]);
  const allCorr = corrections.length ? corrections : conv.corrections;

  useEffect(() => { const el = log.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); }, [lines.length, busy]);

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const t = text.trim(); if (!t || busy || ended) return;
    // El mismo texto reintentado reutiliza el id: el servidor no cobra dos veces.
    if (attempt.current?.key !== t) attempt.current = { key: t, id: newRequestId() };
    p.setBusy('turn'); p.setErr(null); p.setReaction('thinking');
    setLines((l) => [...l, { role: 'student', text: t, fresh: true }]); setText('');
    try {
      const r = await redetTurn(conv.id, t, attempt.current.id);
      attempt.current = null;
      setLines((l) => { const n = [...l]; n[n.length - 1] = { ...n[n.length - 1], corrections: r.corrections }; return [...n, { role: 'klaus', text: r.reply, source: r.source, fresh: true }]; });
      p.setReaction(r.corrections.some((c) => c.kind === 'error') ? 'support' : 'correct');
      klausStatus().then(p.setStatus).catch(() => {});
    } catch (er) {
      setLines((l) => l.slice(0, -1)); setText(t); p.setErr((er as Error).message); p.setReaction('idle');
    } finally { p.setBusy(null); input.current?.focus(); }
  };
  const finish = async () => {
    p.setBusy('end'); p.setErr(null); stopSpeaking();
    try { const r = await redetEnd(conv.id); p.setSummary(r.summary); p.setReaction('complete'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    catch (er) { p.setErr((er as Error).message); } finally { p.setBusy(null); }
  };
  const listen = async (i: number, line: string) => {
    if (speaking === i) { stopSpeaking(); setSpeaking(null); return; }
    setSpeaking(i);
    if (status?.providers.tts.real) {
      try {
        const r = await redetTts(line, newRequestId());
        const a = new Audio(`data:${r.mime};base64,${r.audio}`); a.onended = () => setSpeaking(null); await a.play();
      } catch (er) { p.setErr((er as Error).message); setSpeaking(null); }
      return;
    }
    speak([{ text: line, lang: 'de' }], undefined, () => setSpeaking(null));
  };
  const canListen = !!status?.providers.tts.real || voices.de;

  return (
    <main className="dt-page rd-page rd-room">
      <header className="rd-bar">
        <button type="button" className="rd-back" onClick={p.onBack}>← Situaciones</button>
        <div className="rd-bar-t"><p className="rd-mono" lang="de">{conv.level} · {scenario?.de ?? 'Redet mit Klaus'}</p><h1>{scenario?.title ?? 'Conversación'}</h1></div>
        {!ended && <button type="button" className="btn" disabled={!!busy || lines.filter((l) => l.role === 'student').length === 0} onClick={() => void finish()}>{busy === 'end' ? 'Cerrando…' : 'Terminar'}</button>}
      </header>

      {summary ? <Summary summary={summary} onBack={p.onBack} /> : (
        <div className="rd-grid">
          <section className="rd-chat" aria-label="Conversación">
            {scenario && <p className="rd-intro">{scenario.intro}</p>}
            <ol ref={log} className="rd-log" role="log" aria-live="polite" aria-relevant="additions">
              {lines.map((l, i) => (
                <li key={i} className={`rd-msg is-${l.role}${l.fresh ? ' is-fresh' : ''}`}>
                  {l.role === 'klaus' && <span className="rd-who">Klaus{l.source === 'mock' ? <em> · guion de práctica</em> : null}</span>}
                  <p lang="de">{l.text}</p>
                  {l.role === 'klaus' && canListen && (
                    <button type="button" className={`rd-listen${speaking === i ? ' is-on' : ''}`} onClick={() => void listen(i, l.text)} aria-label={speaking === i ? 'Parar' : `Escuchar: ${l.text}`}>
                      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 6h2.5L9 3v10L5.5 10H3z" fill="currentColor" /><path d="M11.5 5.5a3.5 3.5 0 0 1 0 5M13 3.8a6 6 0 0 1 0 8.4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
                      {speaking === i ? 'Parar' : 'Escuchar'}
                    </button>
                  )}
                  {l.corrections && l.corrections.length > 0 && (
                    <ul className="rd-fixes">{l.corrections.map((c, k) => <li key={k} className={`k-${c.kind}`}>
                      <span className="rd-fix-tag">{KIND_LABEL[c.kind]}</span>
                      <span lang="de"><del>{c.original}</del> → <ins>{c.suggestion}</ins></span>
                      <span className="rd-fix-why">{c.explanation}</span></li>)}</ul>
                  )}
                  {l.corrections && l.corrections.length === 0 && <p className="rd-ok">Sin errores detectados.</p>}
                </li>
              ))}
              {busy === 'turn' && <li className="rd-typing" aria-label="Klaus está escribiendo"><span /><span /><span /></li>}
            </ol>
            {p.err && <p className="rd-err" role="alert">{p.err}</p>}
            <Composer text={text} setText={setText} onSend={send} busy={busy} disabled={ended || left === 0} input={input} status={status} setBusy={p.setBusy} setErr={p.setErr} />
            {left === 0 && <p className="rd-note" role="status">Has usado los mensajes de hoy. Puedes terminar la conversación para ver el resumen; mañana se renuevan.</p>}
          </section>
          <aside className="rd-side" aria-label="Klaus">
            <div className={`rd-klaus r-${p.reaction}`}><KlausFigure reaction={p.reaction} look={p.look} /></div>
            {scenario && scenario.phrases.length > 0 && (
              <div className="rd-phrases"><h2 className="rd-mono">Frases útiles</h2>
                <ul>{scenario.phrases.map((ph) => <li key={ph.de}><button type="button" className="rd-phrase" disabled={ended} onClick={() => { setText((t) => (t ? `${t} ${ph.de}` : ph.de)); input.current?.focus(); }}>
                  <b lang="de">{ph.de}</b><span>{ph.es}</span></button></li>)}</ul></div>
            )}
            <div className="rd-tally"><h2 className="rd-mono">Correcciones</h2>
              {allCorr.length ? <p><b className="dotnum">{allCorr.filter((c) => c.kind === 'error').length}</b> errores · <b className="dotnum">{allCorr.filter((c) => c.kind !== 'error').length}</b> sugerencias</p> : <p className="rd-dim">Aún nada que corregir.</p>}</div>
          </aside>
        </div>
      )}
    </main>
  );
}

function Composer({ text, setText, onSend, busy, disabled, input, status, setBusy, setErr }: {
  text: string; setText: (f: string | ((t: string) => string)) => void; onSend: (e?: FormEvent) => void; busy: null | string; disabled: boolean;
  input: React.RefObject<HTMLTextAreaElement | null>; status: KlausStatus | null; setBusy: (b: null | 'stt') => void; setErr: (e: string | null) => void;
}) {
  const rec = useRef<{ r: MediaRecorder; chunks: Blob[]; t0: number; stop: number } | null>(null);
  const [recording, setRecording] = useState(false);
  const sttReal = !!status?.providers.stt.real && typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  const toggleMic = async () => {
    if (rec.current) { rec.current.r.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream), chunks: Blob[] = [];
      r.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop()); const cur = rec.current; rec.current = null; setRecording(false);
        if (!cur) return; clearTimeout(cur.stop);
        const blob = new Blob(chunks, { type: r.mimeType || 'audio/webm' }), secs = (performance.now() - cur.t0) / 1000;
        setBusy('stt');
        try { const out = await redetStt(blob, secs, newRequestId()); setText((t) => (t ? `${t} ${out.text}` : out.text)); input.current?.focus(); }
        catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
      };
      rec.current = { r, chunks, t0: performance.now(), stop: window.setTimeout(() => r.state === 'recording' && r.stop(), 30_000) };
      r.start(); setRecording(true);
    } catch { setErr('No se ha podido usar el micrófono. Revisa el permiso del navegador.'); }
  };
  return (
    <form className="rd-compose" onSubmit={onSend}>
      <label htmlFor="rd-input" className="sr-only">Tu respuesta en alemán</label>
      <textarea id="rd-input" ref={input} lang="de" rows={2} value={text} maxLength={800} disabled={disabled} placeholder={disabled ? 'Conversación cerrada' : 'Antworte auf Deutsch…'}
        onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }} />
      <div className="rd-compose-act">
        {sttReal && <button type="button" className={`rd-mic${recording ? ' is-rec' : ''}`} disabled={disabled || (!!busy && !recording)} onClick={() => void toggleMic()} aria-pressed={recording}>
          {recording ? 'Parar' : busy === 'stt' ? 'Transcribiendo…' : 'Dictar'}</button>}
        <button type="submit" className="btn primary" disabled={disabled || !!busy || !text.trim()}>{busy === 'turn' ? 'Enviando…' : 'Enviar'}</button>
      </div>
      {!sttReal && !disabled && <p className="rd-hint">Escribe tu respuesta · Enter para enviar. El dictado por voz no está configurado en este servidor.</p>}
      {sttReal && <p className="rd-hint">El dictado transcribe lo que dices; no evalúa tu pronunciación. El audio no se guarda.</p>}
    </form>
  );
}

function Summary({ summary, onBack }: { summary: RedetSummaryView; onBack: () => void }) {
  return (
    <section className="rd-summary" aria-labelledby="rd-sum-h">
      <p className="rd-mono">Resumen{summary.source === 'mock' ? ' · sin IA' : ''}</p>
      <h2 id="rd-sum-h">Conversación terminada<b className="dt-punkt">.</b></h2>
      <div className="rd-sum-grid">
        <div><h3>Has practicado</h3><ul className="rd-topics">{summary.topics.map((t) => <li key={t}>{t}</li>)}</ul></div>
        <div><h3>Expresiones nuevas</h3>{summary.expressions.length ? <ul className="rd-expr">{summary.expressions.map((e) => <li key={e.de}><b lang="de">{e.de}</b><span>{e.es}</span></li>)}</ul> : <p className="rd-dim">Ninguna esta vez.</p>}</div>
        <div className="rd-sum-wide"><h3>Errores para repasar</h3>{summary.mistakes.length
          ? <ul className="rd-fixes">{summary.mistakes.map((c, k) => <li key={k} className="k-error"><span lang="de"><del>{c.original}</del> → <ins>{c.suggestion}</ins></span><span className="rd-fix-why">{c.explanation}</span></li>)}</ul>
          : <p className="rd-ok">No se ha detectado ningún error.</p>}</div>
        <div className="rd-sum-wide"><h3>Siguiente paso</h3><ul className="rd-topics">{summary.suggestions.map((t) => <li key={t}>{t}</li>)}</ul></div>
      </div>
      <p className="rd-row"><button type="button" className="btn primary" onClick={onBack}>Otra situación</button></p>
    </section>
  );
}
