// /cuenta — cuenta de alumno del modo libre. Pensada para que crearla cueste un minuto y no pida ningún dato personal:
// alias sugerido, contraseña con indicador claro, ranking opcional explicado, y todo lo de la cuenta en un sitio.
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { PASSWORD_MIN, type AccountPub, type ProgressSummary } from '../../shared/play.ts';
import { changePassword, deleteAccount, getAchievements, getProgress, refreshAccount, setRanking, signIn, signOut } from '../play-client.ts';
import type { AchievementState } from '../../shared/play.ts';
import { BadgeGrid } from '../components/Badges.tsx';
import { navigate, store } from '../util.ts';
import '../libre.css';
import '../account.css';
import { LoginPage } from './Auth.tsx';

const ANIMALS = ['Fuchs', 'Igel', 'Dachs', 'Eule', 'Luchs', 'Otter', 'Biber', 'Falke', 'Hase', 'Adler', 'Spatz', 'Möwe', 'Elch', 'Panda', 'Wal', 'Kauz'];
/** Alias sugerido: un animal en alemán + dos cifras. Así nadie tiene que pensar en algo que no sea su nombre real. */
export const suggestAlias = (rand = Math.random) => `${ANIMALS[Math.floor(rand() * ANIMALS.length)]}${['_', '.', ''][Math.floor(rand() * 3)]}${10 + Math.floor(rand() * 90)}`;
const ALIAS_OK = /^[\p{L}\p{N}][\p{L}\p{N}_.-]{2,15}$/u;

/** Fuerza orientativa (el servidor es quien valida). 0 vacía · 1 débil · 2 aceptable · 3 fuerte. */
export function passwordStrength(pw: string, alias: string): 0 | 1 | 2 | 3 {
  if (!pw) return 0;
  if (pw.length < PASSWORD_MIN || (alias && pw.toLowerCase().includes(alias.toLowerCase())) || /^(.)\1+$/.test(pw)) return 1;
  const kinds = [/[a-zäöüß]/, /[A-ZÄÖÜ]/, /\d/, /[^\p{L}\p{N}]/u].filter((r) => r.test(pw)).length;
  return pw.length >= 14 || kinds >= 3 ? 3 : 2;
}
const STRENGTH = ['', 'Débil', 'Aceptable', 'Fuerte'];

const back = () => { const v = new URLSearchParams(location.search).get('volver'); return v && /^\/[\w/-]*$/.test(v) ? v : null; };

export function Account() {
  const [account, setAccount] = useState<AccountPub | null | undefined>(undefined);
  useEffect(() => { void refreshAccount().then(setAccount); }, []);
  if (account === null) return <LoginPage />;
  return (
    <main className="libre account" data-account-page="">
      {account === undefined ? <p className="libre-note">Comprobando tu sesión…</p>
        : account ? <AccountHome account={account} onChange={setAccount} />
        : <LoginPage />}
    </main>
  );
}

export function Check({ ok, children }: { ok: boolean; children: ReactNode }) {
  return <li className={ok ? 'ok' : ''}><span aria-hidden="true">{ok ? '✓' : '·'}</span>{children}</li>;
}

export function PasswordField({ value, onChange, alias, label, autoComplete, meter }: { value: string; onChange: (v: string) => void; alias: string; label: string; autoComplete: string; meter?: boolean }) {
  const [show, setShow] = useState(false);
  const s = passwordStrength(value, alias);
  return (
    <label className="acc-field">
      <span>{label}</span>
      <span className="acc-pw">
        <input className="field" type={show ? 'text' : 'password'} value={value} minLength={meter ? PASSWORD_MIN : undefined} maxLength={128} autoComplete={autoComplete} required onChange={(e) => onChange(e.target.value)} />
        <button type="button" className="btn sm ghost" onClick={() => setShow((x) => !x)} aria-pressed={show}>{show ? 'Ocultar' : 'Ver'}</button>
      </span>
      {meter && (
        <span className="acc-meter" data-strength={s} aria-live="polite">
          <i /><i /><i /><b>{value ? STRENGTH[s] : `Mínimo ${PASSWORD_MIN} caracteres`}</b>
        </span>
      )}
    </label>
  );
}

export function AccountGate({ onSigned, compact = false, hideGuest = false }: { onSigned: (a: AccountPub) => void; compact?: boolean; hideGuest?: boolean }) {
  const [tab, setTab] = useState<'register' | 'login'>(() => (store.get('dt:has-account') ? 'login' : 'register'));
  const [alias, setAlias] = useState('');
  const [pw, setPw] = useState('');
  const [optIn, setOptIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const a = alias.normalize('NFKC').trim();
  const checks = useMemo(() => ({ length: a.length >= 3 && a.length <= 16, chars: a.length > 0 && ALIAS_OK.test(a), pw: pw.length >= PASSWORD_MIN, notAlias: !!pw && (!a || !pw.toLowerCase().includes(a.toLowerCase())) }), [a, pw]);
  const canRegister = checks.length && checks.chars && checks.pw && checks.notAlias;
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      const acc = await signIn(tab, a, pw, optIn);
      store.set('dt:has-account', '1');
      onSigned(acc);
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  };
  return (
    <section className={`acc-gate${compact ? ' compact' : ''}`} aria-label="Cuenta de alumno">
      {!compact && (
        <header className="acc-hero">
          <p className="dt-eyebrow">Tu cuenta · opcional</p>
          <h1>Guarda lo que aprendes.</h1>
          <p className="libre-lead">Una cuenta solo necesita un <b>alias</b> y una contraseña: nada de correo, nombre ni teléfono. Con ella guardas tu progreso, ves tus errores frecuentes y recibes recomendaciones de repaso.</p>
          <ul className="acc-perks">
            <li><b>Progreso</b><span>Actividades, temas y evolución de tu precisión.</span></li>
            <li><b>Repaso</b><span>Lo que más fallas vuelve en tus prácticas.</span></li>
            <li><b>Ranking</b><span>Solo si quieres, y solo con tu alias.</span></li>
          </ul>
        </header>
      )}
      <form className="acc-card" onSubmit={submit} noValidate>
        <div className="acc-tabs" role="tablist" aria-label="Entrar o crear cuenta">
          <button type="button" role="tab" aria-selected={tab === 'register'} className={tab === 'register' ? 'on' : ''} onClick={() => { setTab('register'); setError(null); }}>Crear cuenta</button>
          <button type="button" role="tab" aria-selected={tab === 'login'} className={tab === 'login' ? 'on' : ''} onClick={() => { setTab('login'); setError(null); }}>Ya tengo cuenta</button>
        </div>
        <label className="acc-field">
          <span>Alias</span>
          <span className="acc-pw">
            <input className="field" value={alias} maxLength={16} autoComplete="username" autoCapitalize="off" spellCheck={false} required placeholder={tab === 'register' ? 'Por ejemplo, Fuchs_27' : 'Tu alias'} onChange={(e) => setAlias(e.target.value)} />
            {tab === 'register' && <button type="button" className="btn sm" onClick={() => setAlias(suggestAlias())} title="Sugerir un alias">🎲 Sugerir</button>}
          </span>
        </label>
        {tab === 'register' && (
          <ul className="acc-checks" aria-label="Requisitos del alias">
            <Check ok={checks.length}>De 3 a 16 caracteres</Check>
            <Check ok={checks.chars}>Letras, números, punto, guion o guion bajo</Check>
            <li className="hint">No uses tu nombre real: el alias es lo único que otros podrían ver.</li>
          </ul>
        )}
        <PasswordField value={pw} onChange={setPw} alias={a} label="Contraseña" autoComplete={tab === 'login' ? 'current-password' : 'new-password'} meter={tab === 'register'} />
        {tab === 'register' && (
          <>
            <ul className="acc-checks" aria-label="Requisitos de la contraseña">
              <Check ok={checks.pw}>Al menos {PASSWORD_MIN} caracteres (una frase corta sirve)</Check>
              <Check ok={checks.notAlias}>Que no contenga tu alias</Check>
            </ul>
            <label className="acc-switch">
              <input type="checkbox" role="switch" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
              <span><b>Aparecer en el ranking semanal</b><small>Solo tu alias y tus puntos. Puedes cambiarlo cuando quieras.</small></span>
            </label>
          </>
        )}
        {error && <p className="libre-err" role="alert">{error}</p>}
        <button className="btn primary lg" disabled={busy || (tab === 'register' ? !canRegister : !a || !pw)}>{busy ? 'Un momento…' : tab === 'register' ? 'Crear mi cuenta' : 'Entrar'}</button>
        {tab === 'login' && <p className="libre-note">¿Olvidaste la contraseña? No guardamos correo, así que no se puede recuperar: crea una cuenta nueva con otro alias.</p>}
        {!hideGuest && <p className="libre-note acc-guest">¿Prefieres no crear cuenta? <a href="/libre" onClick={(e) => { e.preventDefault(); navigate(back() ?? '/libre'); }}>Juega como invitado</a>: todo funciona, pero no se guarda nada.</p>}
      </form>
    </section>
  );
}

function AccountHome({ account, onChange }: { account: AccountPub; onChange: (a: AccountPub | null) => void }) {
  const [p, setP] = useState<ProgressSummary | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ach, setAch] = useState<AchievementState[] | null>(null);
  useEffect(() => { void getProgress().then(setP).catch(() => setP(null)); void getAchievements().then((r) => setAch(r.achievements)).catch(() => setAch(null)); }, []);
  useEffect(() => { if (ach && location.hash === '#logros') document.getElementById('logros')?.scrollIntoView({ block: 'start' }); }, [ach]);
  const toggleRanking = async (on: boolean) => {
    setError(null);
    try { onChange((await setRanking(on)).account); setMsg(on ? 'Ahora apareces en el ranking con tu alias.' : 'Ya no apareces en el ranking.'); } catch (cause) { setError((cause as Error).message); }
  };
  return (
    <>
      <header className="acc-profile">
        <span className="acc-avatar" aria-hidden="true">{account.alias.slice(0, 1).toUpperCase()}</span>
        <div>
          <p className="dt-eyebrow">Tu cuenta</p>
          <h1>Hallo, {account.alias}!</h1>
          <p className="libre-lead">Tu progreso se guarda solo cada vez que completas una actividad.</p>
        </div>
        <button className="btn primary lg" onClick={() => navigate('/libre')}>Jugar ahora →</button>
      </header>
      {p && (
        <div className="libre-stats">
          <div className="libre-stat"><span>Puntos esta semana</span><b>{p.weekPoints}</b></div>
          <div className="libre-stat"><span>Días seguidos</span><b>{p.streak}</b></div>
          <div className="libre-stat"><span>Logros</span><b>{ach ? ach.filter((a) => a.unlocked).length : '—'}</b></div>
          <div className="libre-stat"><span>Ranking</span><b>{p.rank ?? '—'}</b></div>
        </div>
      )}
      {ach && <div id="logros"><BadgeGrid list={ach} /></div>}
      {p && <ProgressDetails p={p} />}
      <section className="libre-card" aria-label="Ajustes">
        <p className="libre-note"><a className="btn" href="/klaus">🐾 Tus Klaus y lootboxes</a></p>
        <h2>Ajustes</h2>
        <label className="acc-switch">
          <input type="checkbox" role="switch" checked={account.rankingOptIn} onChange={(e) => void toggleRanking(e.target.checked)} />
          <span><b>Aparecer en el ranking semanal</b><small>Solo se muestra tu alias y tus puntos de la semana; nunca tus estadísticas ni a qué hora juegas.</small></span>
        </label>
        {msg && <p className="libre-note" role="status">{msg}</p>}
        <ChangePassword alias={account.alias} />
        <div className="libre-row">
          <button className="btn" onClick={async () => { await signOut(); onChange(null); }}>Cerrar sesión</button>
        </div>
        {error && <p className="libre-err" role="alert">{error}</p>}
      </section>
      <DangerZone onDeleted={() => onChange(null)} />
    </>
  );
}

export function ProgressDetails({ p }: { p: ProgressSummary }) {
  return (
    <section className="libre-card" aria-label="Tu progreso">
      <h2>Tu progreso</h2>
      {p.advice.length > 0 && <div className="acc-advice"><b>Para tu próximo repaso</b><ul className="libre-list">{p.advice.map((a) => <li key={a}>{a}</li>)}</ul></div>}
      {p.topics.length > 0 && <><h3>Por tema</h3>{p.topics.map((t) => (
        <div key={t.topic} className="libre-bar"><span>{t.topic}</span><i style={{ width: `${Math.round(t.accuracy * 100)}%` }} /><span>{Math.round(t.accuracy * 100)} %</span></div>
      ))}</>}
      {p.accuracy.some((a) => a.accuracy !== null) && <><h3>Evolución semanal</h3>{p.accuracy.filter((a) => a.accuracy !== null).map((a) => (
        <div key={a.week} className="libre-bar"><span>{a.week.slice(5)}</span><i style={{ width: `${Math.round((a.accuracy ?? 0) * 100)}%` }} /><span>{Math.round((a.accuracy ?? 0) * 100)} %</span></div>
      ))}</>}
      {p.frequentErrors.length > 0 && <><h3>Lo que más fallas</h3><ul className="libre-list">{p.frequentErrors.map((e) => <li key={e.qid} lang="de">{e.prompt} <span className="libre-note">({e.wrong} fallos)</span></li>)}</ul></>}
      {p.activities.length > 0 && <><h3>Últimas actividades</h3><ul className="libre-list">{p.activities.map((a) => <li key={a.at}>{({ blackcard: 'BlackCard', jenga: 'Wort-Jenga', boxing: 'Boxeo', deck: 'Deck' } as const)[a.game]} {a.level ?? ''} · {a.correct}/{a.total} bien · {new Date(a.at).toLocaleDateString()}</li>)}</ul></>}
    </section>
  );
}

function ChangePassword({ alias }: { alias: string }) {
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState(''); const [next, setNext] = useState('');
  const [msg, setMsg] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  if (!open) return <div className="libre-row"><button className="btn" onClick={() => setOpen(true)}>Cambiar contraseña…</button></div>;
  return (
    <form className="acc-sub" onSubmit={async (e) => {
      e.preventDefault(); setError(null);
      try { await changePassword(cur, next); setMsg('Contraseña cambiada. Se ha cerrado la sesión en tus otros dispositivos.'); setCur(''); setNext(''); setOpen(false); } catch (cause) { setError((cause as Error).message); }
    }}>
      <PasswordField value={cur} onChange={setCur} alias={alias} label="Contraseña actual" autoComplete="current-password" />
      <PasswordField value={next} onChange={setNext} alias={alias} label="Nueva contraseña" autoComplete="new-password" meter />
      <div className="libre-row"><button className="btn primary" disabled={!cur || next.length < PASSWORD_MIN}>Guardar</button><button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancelar</button></div>
      {error && <p className="libre-err" role="alert">{error}</p>}
      {msg && <p className="libre-note" role="status">{msg}</p>}
    </form>
  );
}

function DangerZone({ onDeleted }: { onDeleted: () => void }) {
  const [step, setStep] = useState(0);
  const [pw, setPw] = useState(''); const [error, setError] = useState<string | null>(null);
  return (
    <section className="libre-card acc-danger" aria-label="Eliminar cuenta">
      <h2>Eliminar la cuenta</h2>
      <p className="libre-note">Se borran tu cuenta, tu progreso y tus puntos. No se puede deshacer.</p>
      {step === 0 ? <div className="libre-row"><button className="btn" onClick={() => setStep(1)}>Quiero eliminar mi cuenta…</button></div> : (
        <form className="libre-row" onSubmit={async (e) => { e.preventDefault(); setError(null); try { await deleteAccount(pw); onDeleted(); } catch (cause) { setError((cause as Error).message); } }}>
          <input className="field" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Escribe tu contraseña para confirmar" autoComplete="current-password" required />
          <button className="btn acc-delete" disabled={!pw}>Eliminar definitivamente</button>
          <button type="button" className="btn ghost" onClick={() => { setStep(0); setPw(''); }}>Cancelar</button>
        </form>
      )}
      {error && <p className="libre-err" role="alert">{error}</p>}
    </section>
  );
}
