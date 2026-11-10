// /tablon — Tablón de peticiones. Todos lo leen; con cuenta y al menos una actividad hecha se puede abrir un ticket y apoyar los de otros.
// El servidor decide los permisos (server/tablon.ts); aquí solo se muestran, con el motivo cuando no se puede.
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { followLearningLink } from '../components/LearningNav.tsx';
import { studentSession } from '../util.ts';
import {
  CATEGORY_HINT, CATEGORY_LABEL, STATUS_LABEL, tablonCreate, tablonList, tablonVote, tablonWithdraw,
  type TablonLimits, type TablonMe, type TicketCategory, type TicketStatus, type TicketView,
} from '../tablon-client.ts';
import '../tablon.css';

type Filter = 'todas' | 'abiertas' | 'hechas' | 'mias';
const FILTERS: { id: Filter; label: string }[] = [{ id: 'todas', label: 'Todas' }, { id: 'abiertas', label: 'Abiertas' }, { id: 'hechas', label: 'Hechas' }, { id: 'mias', label: 'Mías' }];
const CATS = Object.keys(CATEGORY_LABEL) as TicketCategory[];
const when = (at: number) => new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(at);

export function Tablon() {
  const loggedIn = !!studentSession();
  const [tickets, setTickets] = useState<TicketView[] | null>(null);
  const [me, setMe] = useState<TablonMe | null>(null);
  const [limits, setLimits] = useState<TablonLimits | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('todas');
  const [busy, setBusy] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);

  const load = useCallback(() => tablonList().then((r) => { setTickets(r.tickets); setMe(r.me); setLimits(r.limits); setErr(null); }).catch((e: Error) => setErr(e.message)), []);
  useEffect(() => { void load(); }, [load]);

  const replace = (t: TicketView) => setTickets((l) => (l ?? []).map((x) => (x.id === t.id ? t : x)));
  const vote = async (id: string) => { setBusy(id); try { replace((await tablonVote(id)).ticket); } catch (e) { setErr((e as Error).message); } finally { setBusy(null); } };
  const withdraw = async (id: string) => {
    if (!confirm('¿Retirar esta petición? Se borrará del tablón.')) return;
    setBusy(id); try { const r = await tablonWithdraw(id); setMe(r.me); setTickets((l) => (l ?? []).filter((x) => x.id !== id)); } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };
  const created = (t: TicketView, m: TablonMe) => { setTickets((l) => [t, ...(l ?? [])]); setMe(m); setFresh(t.id); setFilter('todas'); };

  const shown = useMemo(() => {
    const l = tickets ?? [];
    const f = filter === 'abiertas' ? l.filter((t) => t.status === 'abierto' || t.status === 'en-curso')
      : filter === 'hechas' ? l.filter((t) => t.status === 'hecho') : filter === 'mias' ? l.filter((t) => t.mine) : l;
    const rank = (s: TicketStatus) => (s === 'en-curso' ? 0 : s === 'abierto' ? 1 : s === 'hecho' ? 2 : 3);
    return [...f].sort((a, b) => rank(a.status) - rank(b.status) || b.votes - a.votes || b.createdAt - a.createdAt);
  }, [tickets, filter]);
  const counts = useMemo(() => ({ open: (tickets ?? []).filter((t) => t.status === 'abierto' || t.status === 'en-curso').length, done: (tickets ?? []).filter((t) => t.status === 'hecho').length }), [tickets]);

  return (
    <main className="dt-page tb-page">
      <header className="tb-head">
        <div>
          <p className="dt-eyebrow">Schwarzes Brett · Tablón</p>
          <h1>Tablón<b className="dt-punkt">.</b></h1>
          <p className="tb-lede">Pide lo que quieras ver en Deutschtrainer: más ejercicios, una clase con Klaus, una función nueva o algo que falla. Las peticiones con más apoyos van primero.</p>
        </div>
        <dl className="tb-stats" aria-label="Resumen del tablón">
          <div><dt>Abiertas</dt><dd className="dotnum">{tickets ? counts.open : '–'}</dd></div>
          <div><dt>Hechas</dt><dd className="dotnum">{tickets ? counts.done : '–'}</dd></div>
        </dl>
      </header>

      <div className="tb-grid">
        <section className="tb-board" aria-labelledby="tb-list-h">
          <div className="tb-bar">
            <h2 id="tb-list-h" className="tb-mono">Peticiones</h2>
            <div className="tb-filters" role="group" aria-label="Filtrar">
              {FILTERS.filter((f) => f.id !== 'mias' || me).map((f) => <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</button>)}
            </div>
          </div>
          {err && <p className="tb-err" role="alert">{err}</p>}
          {!tickets ? <p className="tb-muted" role="status">Cargando el tablón…</p>
            : shown.length === 0 ? <p className="tb-empty">{filter === 'mias' ? 'Aún no has abierto ninguna petición.' : filter === 'todas' ? 'Todavía no hay peticiones. ¡Abre la primera!' : 'No hay peticiones aquí.'}</p>
            : <ol className="tb-list">{shown.map((t, i) => <Ticket key={t.id} t={t} i={i} me={me} busy={busy === t.id} fresh={fresh === t.id} onVote={vote} onWithdraw={withdraw} />)}</ol>}
        </section>

        <aside className="tb-side" aria-label="Abrir una petición">
          {!loggedIn || !me ? (
            <div className="tb-card tb-gate">
              <p className="tb-mono">Abrir una petición</p>
              <h2>Entra para pedir algo</h2>
              <p>Con tu cuenta y al menos una actividad hecha puedes abrir peticiones y apoyar las de otros.</p>
              <div className="tb-row">
                <a className="btn primary" href="/entrar?volver=/tablon" onClick={followLearningLink}>Iniciar sesión</a>
                <a className="btn" href="/registro?volver=/tablon" onClick={followLearningLink}>Crear cuenta</a>
              </div>
            </div>
          ) : !me.active ? (
            <div className="tb-card tb-gate" data-tablon-locked="">
              <p className="tb-mono">Abrir una petición</p>
              <h2>Primero, una actividad</h2>
              <p>{me.reason}</p>
              <div className="tb-row">
                <a className="btn primary" href="/practica" onClick={followLearningLink}>Practicar</a>
                <a className="btn" href="/unterricht" onClick={followLearningLink}>Clase con Klaus</a>
              </div>
            </div>
          ) : <NewTicket me={me} limits={limits} onCreated={created} />}
          <ul className="tb-rules">
            <li>Una idea por petición, explicada con calma.</li>
            <li>Sin enlaces ni datos personales. Tu alias no se muestra a los demás.</li>
            <li>Máximo {limits?.openPerAccount ?? 3} abiertas a la vez y {limits?.perDay ?? 3} al día.</li>
            <li>El profesor responde aquí y marca en qué estado está cada una.</li>
          </ul>
        </aside>
      </div>
    </main>
  );
}

function Ticket({ t, i, me, busy, fresh, onVote, onWithdraw }: { t: TicketView; i: number; me: TablonMe | null; busy: boolean; fresh: boolean; onVote: (id: string) => void; onWithdraw: (id: string) => void }) {
  const canVote = !!me?.canVote && !t.mine && t.status !== 'descartado' && t.status !== 'hecho';
  return (
    <li className={`tb-ticket s-${t.status}${fresh ? ' is-fresh' : ''}${t.mine ? ' is-mine' : ''}`} style={{ '--i': Math.min(i, 12) } as CSSProperties} data-ticket={t.id}>
      <button type="button" className={`tb-vote${t.voted ? ' is-on' : ''}`} disabled={!canVote || busy} aria-pressed={t.voted}
        onClick={() => onVote(t.id)} aria-label={`${t.voted ? 'Quitar apoyo' : 'Apoyar'}: ${t.title}. ${t.votes} apoyos.`}
        title={t.mine ? 'Es tu petición' : !me ? 'Entra para apoyar' : !me.canVote ? (me.reason ?? '') : ''}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.5 13 10H3z" /></svg>
        <span className="dotnum">{t.votes}</span>
      </button>
      <div className="tb-t-body">
        <p className="tb-t-meta"><span className="tb-n dotnum">#{String(t.n).padStart(3, '0')}</span><span className={`tb-cat c-${t.category}`}>{CATEGORY_LABEL[t.category]}</span>
          <span className={`tb-status s-${t.status}`}>{STATUS_LABEL[t.status]}</span>{t.mine && <span className="tb-mine">Tuya</span>}<span className="tb-date">{when(t.createdAt)}</span></p>
        <h3>{t.title}</h3>
        <p className="tb-t-text">{t.body}</p>
        {t.reply && <div className="tb-reply"><p className="tb-mono">Respuesta del profesor{t.repliedAt ? ` · ${when(t.repliedAt)}` : ''}</p><p>{t.reply}</p></div>}
        {t.mine && t.status === 'abierto' && <button type="button" className="tb-link" disabled={busy} onClick={() => onWithdraw(t.id)}>Retirar petición</button>}
      </div>
    </li>
  );
}

function NewTicket({ me, limits, onCreated }: { me: TablonMe; limits: TablonLimits | null; onCreated: (t: TicketView, me: TablonMe) => void }) {
  const [category, setCategory] = useState<TicketCategory>('contenido');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const L = limits ?? { titleMin: 6, titleMax: 80, bodyMin: 15, bodyMax: 600, openPerAccount: 3, perDay: 3 };
  const ready = title.trim().length >= L.titleMin && body.trim().length >= L.bodyMin;
  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (!ready || busy || !me.canPost) return;
    setBusy(true); setMsg(null);
    try { const r = await tablonCreate({ category, title, body }); onCreated(r.ticket, r.me); setTitle(''); setBody(''); setMsg({ kind: 'ok', text: `Petición #${String(r.ticket.n).padStart(3, '0')} publicada.` }); }
    catch (er) { setMsg({ kind: 'err', text: (er as Error).message }); } finally { setBusy(false); }
  };
  return (
    <form className="tb-card tb-form" onSubmit={(e) => void submit(e)} aria-labelledby="tb-new-h" data-tablon-form="">
      <p className="tb-mono">Abrir una petición · {me.open}/{me.limit} abiertas</p>
      <h2 id="tb-new-h">¿Qué te gustaría?</h2>
      <fieldset className="tb-cats"><legend className="sr">Tipo</legend>
        {CATS.map((c) => (
          <label key={c} className={category === c ? 'is-on' : ''}>
            <input type="radio" name="tb-cat" value={c} checked={category === c} onChange={() => setCategory(c)} />
            <b>{CATEGORY_LABEL[c]}</b><small>{CATEGORY_HINT[c]}</small>
          </label>
        ))}
      </fieldset>
      <label className="tb-field"><span>Título</span>
        <input id="tb-title" value={title} maxLength={L.titleMax} onChange={(e) => setTitle(e.target.value)} placeholder="Ej.: Más ejercicios de Perfekt" required />
        <small>{title.trim().length}/{L.titleMax}</small></label>
      <label className="tb-field"><span>Explícalo</span>
        <textarea id="tb-body" value={body} maxLength={L.bodyMax} rows={5} onChange={(e) => setBody(e.target.value)} placeholder="¿Qué necesitas y para qué te ayudaría?" required />
        <small>{body.trim().length}/{L.bodyMax}{body.trim().length > 0 && body.trim().length < L.bodyMin ? ` · mínimo ${L.bodyMin}` : ''}</small></label>
      {!me.canPost && me.reason && <p className="tb-note" role="status">{me.reason}</p>}
      {msg && <p className={msg.kind === 'ok' ? 'tb-ok' : 'tb-err'} role={msg.kind === 'ok' ? 'status' : 'alert'}>{msg.text}</p>}
      <button type="submit" className="btn primary" disabled={!ready || busy || !me.canPost}>{busy ? 'Publicando…' : 'Publicar petición'}</button>
    </form>
  );
}
