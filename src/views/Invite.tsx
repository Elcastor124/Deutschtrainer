// Invita a un amigo y ganáis una semana de Plus (lo decide el servidor: server/referrals.ts).
//  /invitar   → tu código y enlace, compartir (WhatsApp / copiar), tus amigos y su estado; si te acabas de registrar,
//               puedes meter el código de quien te invitó (48 h).
//  /i/CODIGO  → página de bienvenida del amigo: guarda el código y le lleva a crear cuenta (se aplica solo al registrarse).
import { useEffect, useState, type FormEvent, type MouseEvent } from 'react';
import { cachedAlias, playRequest } from '../play-client.ts';
import { navigate, store } from '../util.ts';
import '../referral.css';

export interface ReferralMe {
  code: string; days: number; max: number; rewarded: number; plan?: 'free' | 'plus'; plusUntil?: number | null;
  friends: { alias: string; status: 'pending' | 'rewarded'; at: number }[];
  invitedBy: { alias: string; status: 'pending' | 'rewarded' | 'cancelled' } | null;
}
const PENDING = 'dt:ref-code';
/** Código guardado al abrir /i/CODIGO (lo usa el registro). */
export const pendingReferral = () => store.get(PENDING);
export const clearPendingReferral = () => store.del(PENDING);
/** Tras crear la cuenta: aplica el código guardado. Nunca rompe el registro si falla. */
export async function claimPendingReferral(): Promise<string | null> {
  const code = pendingReferral(); if (!code) return null;
  try { await playRequest('/api/referral/claim', { code }); clearPendingReferral(); return null; }
  catch (e) { clearPendingReferral(); return (e as Error).message; }
}
const go = (path: string) => (e: MouseEvent) => { e.preventDefault(); navigate(path); };
const dmy = (t: number) => new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

export function InviteLanding({ code }: { code: string }) {
  const [who, setWho] = useState<{ ok: boolean; alias?: string; days?: number } | null>(null);
  useEffect(() => {
    fetch(`/api/referral/check?code=${encodeURIComponent(code)}`).then((r) => r.json()).then((x) => {
      setWho(x); if (x.ok) store.set(PENDING, code.toUpperCase());
    }).catch(() => setWho({ ok: false }));
  }, [code]);
  const logged = !!cachedAlias();
  return (
    <main className="dt-page rf-page" data-invite-landing>
      <section className="rf-hero">
        <p className="dt-eyebrow">Invitación</p>
        {!who ? <div className="rf-skel" aria-busy="true" />
          : who.ok ? <>
            <h1><b>{who.alias}</b> te invita a aprender alemán<b className="dt-punkt">.</b></h1>
            <p className="rf-lead">Crea tu cuenta gratis con esta invitación y, en cuanto hagas tu primera práctica, <b className="gold">los dos ganáis {who.days} días de Plus</b>: Klaus, todo el curso y práctica sin límite.</p>
            {logged
              ? <p className="rf-note">Ya tienes cuenta en este navegador. Si la acabas de crear (menos de 48 h), mete el código en <a href="/invitar" onClick={go('/invitar')}>Invitar</a>.</p>
              : <div className="rf-row"><a className="btn primary" href="/registro?volver=/mi" onClick={go('/registro?volver=/mi')} data-invite-register>Crear mi cuenta gratis</a><a className="btn ghost" href="/" onClick={go('/')}>Ver la web primero</a></div>}
            <p className="rf-code">Código <b>{code.toUpperCase()}</b> · se aplica solo al crear la cuenta</p>
          </> : <>
            <h1>Esta invitación no existe<b className="dt-punkt">.</b></h1>
            <p className="rf-lead">Puede que el enlace esté mal copiado. Puedes crear tu cuenta igualmente.</p>
            <div className="rf-row"><a className="btn primary" href="/registro" onClick={go('/registro')}>Crear cuenta</a></div>
          </>}
      </section>
    </main>
  );
}

export function Invite() {
  const [me, setMe] = useState<ReferralMe | null>(null);
  const [err, setErr] = useState<string | null>(() => new URLSearchParams(location.search).get('aviso'));
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const logged = !!cachedAlias();
  const load = () => playRequest<ReferralMe>('/api/referral/me').then(setMe).catch((e) => setErr((e as Error).message));
  useEffect(() => { if (logged) void load(); }, [logged]);
  if (!logged) return (
    <main className="dt-page rf-page"><section className="rf-hero">
      <p className="dt-eyebrow">Invita a un amigo</p>
      <h1>Una semana de Plus para los dos<b className="dt-punkt">.</b></h1>
      <p className="rf-lead">Crea tu cuenta para tener tu enlace de invitación.</p>
      <div className="rf-row"><a className="btn primary" href="/registro?volver=/invitar" onClick={go('/registro?volver=/invitar')}>Crear cuenta</a><a className="btn ghost" href="/entrar?volver=/invitar" onClick={go('/entrar?volver=/invitar')}>Ya tengo cuenta</a></div>
    </section></main>
  );
  const link = me ? `${location.origin}/i/${me.code}` : '';
  const text = me ? `Estoy aprendiendo alemán con Deutschtrainer. Crea tu cuenta con mi invitación y los dos ganamos ${me.days} días de Plus: ${link}` : '';
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); } };
  const share = async () => { if (navigator.share) { try { await navigator.share({ title: 'Deutschtrainer', text, url: link }); } catch { /* cancelado */ } } else void copy(); };
  const claim = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { setMe(await playRequest<ReferralMe>('/api/referral/claim', { code })); setCode(''); void load(); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  const left = me ? Math.max(0, me.max - me.rewarded) : 0;
  return (
    <main className="dt-page rf-page" data-invite>
      <section className="rf-hero">
        <p className="dt-eyebrow">Invita a un amigo</p>
        <h1>Una semana de Plus para los dos<b className="dt-punkt">.</b></h1>
        <p className="rf-lead">Pásale tu enlace. Cuando tu amigo cree su cuenta y haga su <b>primera práctica</b>, a ti y a él se os suman <b className="gold">{me?.days ?? 7} días de Plus</b> (encima de lo que ya tengáis).</p>
        {!me ? (err ? <p className="libre-err" role="alert">{err}</p> : <div className="rf-skel" aria-busy="true" />) : <>
          <div className="rf-link" data-ref-code={me.code}>
            <span className="rf-url">{link.replace(/^https?:\/\//, '')}</span>
            <div className="rf-row">
              <a className="btn primary" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" data-ref-whatsapp>Enviar por WhatsApp</a>
              <button type="button" className="btn" onClick={() => void copy()} data-ref-copy>{copied ? 'Copiado' : 'Copiar enlace'}</button>
              {'share' in navigator && <button type="button" className="btn ghost" onClick={() => void share()}>Compartir…</button>}
            </div>
            <p className="rf-code">Tu código: <b>{me.code}</b></p>
          </div>
          <ol className="rf-steps">
            <li><b>1</b><span>Tu amigo abre tu enlace y crea su cuenta gratis.</span></li>
            <li><b>2</b><span>Hace su primera práctica, misión o actividad.</span></li>
            <li><b>3</b><span>Los dos recibís {me.days} días de Plus al momento.</span></li>
          </ol>
        </>}
      </section>
      {me && <section className="rf-side">
        <div className="rf-card">
          <h2>Tus invitaciones</h2>
          <p className="rf-stat"><b className="gold dotnum" data-ref-rewarded>{me.rewarded * me.days}</b><span>días de Plus ganados · {me.rewarded} {me.rewarded === 1 ? 'amigo' : 'amigos'}</span></p>
          {me.friends.length ? <ul className="rf-friends" data-ref-friends>{me.friends.map((f, i) => <li key={i}><b>{f.alias}</b><span className={`rf-pill ${f.status}`}>{f.status === 'rewarded' ? `+${me.days} días` : 'Falta su primera práctica'}</span><small>{dmy(f.at)}</small></li>)}</ul>
            : <p className="rf-note">Aún no has invitado a nadie. Tus amigos aparecerán aquí.</p>}
          <p className="rf-note">Puedes ganar hasta {me.max} semanas ({left} {left === 1 ? 'restante' : 'restantes'}). Las cuentas creadas solo para conseguir días se anulan.</p>
        </div>
        <div className="rf-card">
          <h2>¿Te invitó alguien?</h2>
          {me.invitedBy ? <p className="rf-note" data-ref-invited-by>Te invitó <b>{me.invitedBy.alias}</b>. {me.invitedBy.status === 'rewarded' ? `Ya tenéis vuestros ${me.days} días.` : 'Haz tu primera práctica y los dos ganáis la semana.'}</p>
            : <form className="rf-form" onSubmit={claim}>
              <label><span>Código de tu amigo</span><input className="field" value={code} maxLength={12} autoCapitalize="characters" spellCheck={false} placeholder="Por ejemplo, K7MQ2X" onChange={(e) => setCode(e.target.value)} /></label>
              <button className="btn" disabled={busy || code.trim().length < 4}>Usar código</button>
              <small>Solo para cuentas nuevas (primeras 48 horas).</small>
            </form>}
          {err && me && <p className="libre-err" role="alert">{err}</p>}
        </div>
      </section>}
    </main>
  );
}
