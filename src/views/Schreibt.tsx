// /escribir — Schreibt mit Klaus. Escribes tu texto, Klaus lo revisa y las correcciones aparecen en un panel lateral (nunca tapan el texto).
// El servidor decide cuota, valida la salida del modelo y calcula las posiciones; aquí solo se muestra y se edita.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORY_LABEL, KIND_LABEL, type AiLevel, type WritingCorrection } from '../../shared/klaus-ai.ts';
import type { WritingTask } from '../../shared/klaus-content.ts';
import { deleteDraft, klausStatus, newRequestId, quotaLeft, resolveCorrection, reviewWriting, saveDraft, writingDrafts, writingTasks, type DraftView, type DraftReviewView, type KlausStatus } from '../klaus-ai-client.ts';
import { navigate, studentSession } from '../util.ts';
import { KlausFigure } from '../klaus/KlausFigure.tsx';
import { useKlausSkin } from '../klaus/skin-client.ts';
import '../klaus-writing.css';

const words = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);
const when = (ms: number) => new Date(ms).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Texto del alumno con los fragmentos señalados. Los rangos vienen del servidor y se comprueban contra el texto de la revisión. */
function Marked({ text, items, resolved, active, onPick }: { text: string; items: WritingCorrection[]; resolved: Set<string>; active: string | null; onPick: (id: string) => void }) {
  const parts: React.ReactNode[] = []; let at = 0;
  for (const c of items) {
    if (c.start < at || text.slice(c.start, c.end) !== c.original) continue; // defensa: rango incoherente → no se marca
    if (c.start > at) parts.push(text.slice(at, c.start));
    parts.push(<mark key={c.id} className={`kw-mark k-${c.kind}${resolved.has(c.id) ? ' done' : ''}${active === c.id ? ' on' : ''}`} onClick={() => onPick(c.id)} data-correction={c.id}>{c.original}</mark>);
    at = c.end;
  }
  parts.push(text.slice(at));
  return <p className="kw-marked" lang="de">{parts}</p>;
}

export function Schreibt() {
  const loggedIn = !!studentSession();
  const look = useKlausSkin();
  const [status, setStatus] = useState<KlausStatus | null>(null);
  const [tasks, setTasks] = useState<WritingTask[]>([]);
  const [drafts, setDrafts] = useState<DraftView[]>([]);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [level, setLevel] = useState<AiLevel>('A1');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [review, setReview] = useState<DraftReviewView | null>(null);
  const [localReview, setLocalReview] = useState<DraftReviewView['review'] | null>(null);
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<string | null>(null);
  const [guided, setGuided] = useState(false);
  const [shown, setShown] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<'review' | 'save' | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const attempt = useRef<{ key: string; id: string } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  const refresh = useCallback(async () => {
    const [s, t, d] = await Promise.all([klausStatus(), writingTasks(), writingDrafts()]);
    setStatus(s); setTasks(t.tasks); setDrafts(d.drafts);
  }, []);
  useEffect(() => { if (loggedIn) refresh().catch((e: Error) => setMsg({ kind: 'err', text: e.message })); }, [loggedIn, refresh]);
  useEffect(() => () => abort.current?.abort(), []);
  // Aviso al salir con cambios sin guardar.
  useEffect(() => {
    if (!dirty) return;
    const on = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    addEventListener('beforeunload', on); return () => removeEventListener('beforeunload', on);
  }, [dirty]);

  const task = tasks.find((t) => t.id === taskId) ?? null;
  const wc = words(text);
  const left = quotaLeft(status, 'text');
  const shownReview = localReview;
  const corrections = shownReview?.corrections ?? [];
  const open = corrections.filter((c) => !resolved.has(c.id));
  const stale = !!review && review.textSnapshot !== text;
  const taskTasks = useMemo(() => tasks.filter((t) => t.level === level), [tasks, level]);

  const load = (d: DraftView) => {
    setDraftId(d.id); setTitle(d.title); setText(d.text); setLevel(d.level); setTaskId(d.taskId); setDirty(false); setMsg(null);
    const last = d.reviews[d.reviews.length - 1] ?? null;
    setReview(last); setLocalReview(last?.review ?? null); setResolved(new Set(last?.resolved ?? [])); setActive(null); setShown(new Set());
  };
  const fresh = () => { setDraftId(null); setTitle(''); setText(''); setTaskId(null); setReview(null); setLocalReview(null); setResolved(new Set()); setActive(null); setDirty(false); setMsg(null); };

  const save = async (): Promise<string | null> => {
    setBusy('save');
    try {
      const { draft } = await saveDraft({ id: draftId ?? undefined, title: title.trim() || task?.title || 'Sin título', text, level, taskId });
      setDraftId(draft.id); setTitle(draft.title); setDirty(false); setMsg({ kind: 'ok', text: 'Borrador guardado.' });
      setDrafts((cur) => [draft, ...cur.filter((x) => x.id !== draft.id)]);
      return draft.id;
    } catch (e) { setMsg({ kind: 'err', text: (e as Error).message }); return null; } finally { setBusy(null); }
  };

  const requestReview = async () => {
    if (!text.trim() || busy) return;
    setMsg(null);
    // El mismo texto+nivel reutiliza el requestId: si la red falla y reintentas, no se cobra dos veces.
    const key = `${level}\n${text}`;
    if (attempt.current?.key !== key) attempt.current = { key, id: newRequestId() };
    const id = await save(); if (!id) return;
    setBusy('review'); abort.current?.abort(); abort.current = new AbortController();
    try {
      const r = await reviewWriting({ text, level, draftId: id, requestId: attempt.current.id }, abort.current.signal);
      attempt.current = null;
      setLocalReview(r.review); setResolved(new Set()); setActive(null); setShown(new Set());
      setReview({ id: r.reviewId ?? 'local', at: Date.now(), review: r.review, resolved: [], textSnapshot: text });
      setStatus(await klausStatus());
      setDrafts((await writingDrafts()).drafts);
    } catch (e) { if ((e as Error).name !== 'AbortError') setMsg({ kind: 'err', text: (e as Error).message }); } finally { setBusy(null); }
  };

  const done = async (c: WritingCorrection) => {
    setResolved((s) => new Set(s).add(c.id));
    if (draftId && review && review.id !== 'local') resolveCorrection(draftId, review.id, c.id).catch(() => {});
  };
  const apply = (c: WritingCorrection) => {
    // Solo si el fragmento sigue en el texto actual (el alumno pudo editar tras la revisión).
    const i = text.indexOf(c.original);
    if (i < 0) { setMsg({ kind: 'err', text: 'Ese fragmento ya no está en tu texto; puede que ya lo hayas cambiado.' }); return; }
    setText(text.slice(0, i) + c.suggestion + text.slice(i + c.original.length)); setDirty(true); void done(c);
  };
  const remove = async () => {
    if (!draftId || !confirm('¿Borrar este borrador y sus revisiones?')) return;
    try { await deleteDraft(draftId); setDrafts((d) => d.filter((x) => x.id !== draftId)); fresh(); } catch (e) { setMsg({ kind: 'err', text: (e as Error).message }); }
  };

  if (!loggedIn) return (
    <main className="dt-page kw-page">
      <header className="kw-head"><p className="dt-eyebrow">Schreibt mit Klaus</p><h1>Escribir<b className="dt-punkt">.</b></h1></header>
      <section className="kw-card kw-gate">
        <div className="kw-gate-klaus"><KlausFigure reaction="waving" look={look} /></div>
        <div><h2>Entra para que Klaus revise tus textos</h2><p>Tus borradores y correcciones se guardan en tu cuenta de alumno.</p>
          <p className="kw-row"><a className="btn primary" href="/entrar?volver=/escribir" onClick={(e) => { e.preventDefault(); navigate('/entrar?volver=/escribir'); }}>Iniciar sesión</a>
            <a className="btn" href="/registro" onClick={(e) => { e.preventDefault(); navigate('/registro'); }}>Crear cuenta</a></p></div>
      </section>
    </main>
  );

  return (
    <main className="dt-page kw-page" aria-busy={busy === 'review'}>
      <header className="kw-head">
        <p className="dt-eyebrow">Schreibt mit Klaus · escritura guiada</p>
        <h1>Escribir<b className="dt-punkt">.</b></h1>
        <p className="kw-lead">Escribe en alemán. Klaus te señala lo que puede mejorar, te explica por qué y tú decides qué cambiar.</p>
        {status && <p className="kw-plan" role="status">
          <span className={`kw-chip ${status.plan}`}>{status.plan === 'plus' ? 'Plus' : 'Free'}</span>
          <span>{left} revisión(es) hoy de {status.quota.text.limit}</span>
          {!status.providers.llm.real && <span className="kw-chip mock" title={status.providers.llm.note ?? ''}>Modo básico sin IA</span>}
        </p>}
      </header>

      <div className="kw-grid">
        <section className="kw-card kw-edit" aria-label="Tu texto">
          <div className="kw-row kw-controls">
            <label>Nivel <select value={level} onChange={(e) => { setLevel(e.target.value as AiLevel); setTaskId(null); setDirty(true); }}><option>A1</option><option>A2</option></select></label>
            <label>Tarea <select value={taskId ?? ''} onChange={(e) => { setTaskId(e.target.value || null); setDirty(true); }}>
              <option value="">Texto libre</option>{taskTasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
            <label className="kw-grow">Título <input value={title} maxLength={80} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} placeholder={task?.title ?? 'Sin título'} /></label>
          </div>
          {task && <aside className="kw-task"><b>{task.title}.</b> {task.prompt} <span className="kw-dim">({task.minWords}–{task.maxWords} palabras)</span>
            <ul>{task.points.map((p) => <li key={p}>{p}</li>)}</ul></aside>}
          <label className="sr" htmlFor="kw-text">Tu texto en alemán</label>
          <textarea id="kw-text" ref={area} lang="de" value={text} maxLength={4000} rows={12} spellCheck={false} placeholder="Schreib hier deinen Text…" onChange={(e) => { setText(e.target.value); setDirty(true); }} />
          <div className="kw-row kw-foot">
            <span className={`kw-count${task && (wc < task.minWords || wc > task.maxWords) ? ' off' : ''}`}>{wc} palabra(s){task ? ` · objetivo ${task.minWords}–${task.maxWords}` : ''}</span>
            <span className="kw-grow" />
            <button type="button" className="btn" onClick={() => void save()} disabled={!!busy || (!text.trim() && !title.trim())}>{busy === 'save' ? 'Guardando…' : dirty ? 'Guardar borrador' : 'Guardado'}</button>
            <button type="button" className="btn primary" onClick={() => void requestReview()} disabled={!!busy || !text.trim() || left === 0}>{busy === 'review' ? 'Klaus está leyendo…' : 'Revisar con Klaus'}</button>
          </div>
          {left === 0 && <p className="kw-note" role="status">Has llegado al límite de revisiones de hoy. Puedes seguir escribiendo y guardando borradores; mañana se renueva.</p>}
          {msg && <p className={`kw-msg ${msg.kind}`} role={msg.kind === 'err' ? 'alert' : 'status'}>{msg.text}</p>}
        </section>

        <aside className="kw-card kw-side" aria-label="Correcciones de Klaus" aria-live="polite">
          <div className="kw-side-head"><div className="kw-mini"><KlausFigure reaction={busy === 'review' ? 'thinking' : shownReview && !shownReview.corrections.length ? 'correct' : 'idle'} look={look} still={!busy} /></div>
            <div><h2>Correcciones</h2>
              {shownReview ? <p className="kw-dim">{open.length ? `${open.length} por revisar` : 'Todo revisado'}{shownReview.dropped ? ` · ${shownReview.dropped} sugerencia(s) descartada(s) por no ser fiables` : ''}</p> : <p className="kw-dim">Aún no has pedido ninguna revisión.</p>}</div></div>
          {shownReview && <>
            {stale && <p className="kw-note">Has editado el texto después de esta revisión; pide otra para actualizarla.</p>}
            <p className="kw-summary">{shownReview.summary}</p>
            {shownReview.source === 'mock' && <p className="kw-note">Revisión básica con reglas fijas, no con IA: solo detecta errores muy típicos.</p>}
            <label className="kw-switch"><input type="checkbox" checked={guided} onChange={(e) => setGuided(e.target.checked)} /> Modo guiado: pistas antes que soluciones</label>
            {review && <Marked text={review.textSnapshot} items={corrections} resolved={resolved} active={active} onPick={(id) => setActive(id)} />}
            <ol className="kw-list">
              {corrections.map((c) => (
                <li key={c.id} className={`k-${c.kind}${resolved.has(c.id) ? ' done' : ''}${active === c.id ? ' on' : ''}`} onClick={() => setActive(c.id)}>
                  <div className="kw-tags"><span className={`kw-chip k-${c.kind}`}>{KIND_LABEL[c.kind]}</span><span className="kw-chip">{CATEGORY_LABEL[c.category]}</span></div>
                  <p className="kw-orig" lang="de"><del>{c.original}</del>{(!guided || shown.has(c.id)) && <> → <ins>{c.suggestion}</ins></>}</p>
                  {guided && !shown.has(c.id) ? <p>{c.hint}</p> : <p>{c.explanation}</p>}
                  {c.rule && (!guided || shown.has(c.id)) && <p className="kw-rule">📘 {c.rule}</p>}
                  <div className="kw-row">
                    {guided && !shown.has(c.id) && <button type="button" className="btn sm" onClick={() => setShown((s) => new Set(s).add(c.id))}>Ver la solución</button>}
                    {(!guided || shown.has(c.id)) && !resolved.has(c.id) && <button type="button" className="btn sm primary" onClick={() => apply(c)}>Aplicar</button>}
                    {!resolved.has(c.id) ? <button type="button" className="btn sm" onClick={() => void done(c)}>{c.kind === 'style' ? 'Descartar' : 'Mantener mi versión'}</button> : <span className="kw-dim">✓ revisada</span>}
                  </div>
                </li>
              ))}
            </ol>
          </>}
        </aside>
      </div>

      <section className="kw-card kw-drafts" aria-label="Tus borradores">
        <div className="kw-row"><h2>Tus borradores</h2><span className="kw-grow" />
          <button type="button" className="btn sm" onClick={fresh}>Nuevo texto</button>{draftId && <button type="button" className="btn sm" onClick={() => void remove()}>Borrar este</button>}</div>
        {drafts.length === 0 ? <p className="kw-dim">Cuando guardes un texto aparecerá aquí.</p> :
          <ul className="kw-draft-list">{drafts.map((d) => <li key={d.id}><button type="button" className={d.id === draftId ? 'on' : ''} onClick={() => load(d)}>
            <b>{d.title}</b><span className="kw-dim">{d.level} · {words(d.text)} palabras · {d.reviews.length} revisión(es) · {when(d.updatedAt)}</span></button></li>)}</ul>}
      </section>
    </main>
  );
}
