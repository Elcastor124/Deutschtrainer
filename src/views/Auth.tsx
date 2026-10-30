// /registro y /entrar — cuentas de alumno. Solo alias + contraseña (+ confirmación): ni correo, ni nombre real, ni fecha de
// nacimiento (no hacen falta y, con alumnado menor, mejor no tenerlos). La sesión queda en una cookie HttpOnly del servidor.
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { PASSWORD_MIN } from '../../shared/play.ts';
import { signIn } from '../play-client.ts';
import { navigate, store } from '../util.ts';
import { Check, PasswordField, suggestAlias } from './Account.tsx';
import '../libre.css';
import '../account.css';
import '../auth.css';

const ALIAS_OK = /^[\p{L}\p{N}][\p{L}\p{N}_.-]{2,15}$/u;
/** Destino tras entrar: ?volver=/ruta (solo rutas internas) o el panel personal. */
export const afterAuth = () => { const v = new URLSearchParams(location.search).get('volver'); return v && /^\/[\w/#?=&.-]*$/.test(v) && !v.startsWith('//') ? v : '/mi'; };
const keepBack = (path: string) => { const v = new URLSearchParams(location.search).get('volver'); return v ? `${path}?volver=${encodeURIComponent(v)}` : path; };
const go = (path: string) => (e: { preventDefault: () => void }) => { e.preventDefault(); navigate(path); };

function AuthLayout({ eyebrow, title, lead, children, side }: { eyebrow: string; title: string; lead: string; children: ReactNode; side: ReactNode }) {
  return (
    <main className="auth" data-auth="">
      <section className="auth-side">
        <p className="dt-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="libre-lead">{lead}</p>
        {side}
      </section>
      <section className="auth-card">{children}</section>
    </main>
  );
}

function JoinClass() {
  return (
    <a className="auth-join" href="/jugar" onClick={go('/jugar')}>
      <span aria-hidden="true">#</span>
      <span><b>Unirse a una clase</b><small>¿Tu profesor te ha dado un código de sala? Entra aquí, con o sin cuenta.</small></span>
      <i aria-hidden="true">→</i>
    </a>
  );
}

export function RegisterPage() {
  const [alias, setAlias] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [optIn, setOptIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const a = alias.normalize('NFKC').trim();
  const c = useMemo(() => ({
    length: a.length >= 3 && a.length <= 16, chars: a.length > 0 && ALIAS_OK.test(a),
    pw: pw.length >= PASSWORD_MIN, notAlias: !!pw && (!a || !pw.toLowerCase().includes(a.toLowerCase())), match: !!pw2 && pw === pw2,
  }), [a, pw, pw2]);
  const ready = c.length && c.chars && c.pw && c.notAlias && c.match;
  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (!ready) return;
    setBusy(true); setError(null);
    try { await signIn('register', a, pw, optIn, pw2); store.set('dt:has-account', '1'); navigate(afterAuth()); }
    catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  };
  return (
    <AuthLayout eyebrow="Crear cuenta · gratis" title="Tu alemán, a tu ritmo." lead="Con tu cuenta se guardan tu progreso, tus errores frecuentes y tus logros. Solo necesitas un alias y una contraseña."
      side={<>
        <ul className="acc-perks">
          <li><b>Sin datos personales</b><span>Ni correo, ni nombre real, ni fecha de nacimiento.</span></li>
          <li><b>Tu progreso, siempre contigo</b><span>Entra desde cualquier ordenador o Chromebook y sigue donde lo dejaste.</span></li>
          <li><b>El ranking es opcional</b><span>Solo aparece tu alias, y solo si tú quieres.</span></li>
        </ul>
        <JoinClass />
      </>}>
      <form className="auth-form" onSubmit={submit} noValidate aria-describedby={error ? 'auth-error' : undefined}>
        <h2>Crear cuenta</h2>
        <label className="acc-field">
          <span>Alias</span>
          <span className="acc-pw">
            <input className="field" value={alias} maxLength={16} autoComplete="username" autoCapitalize="off" spellCheck={false} required autoFocus placeholder="Por ejemplo, Fuchs_27" onChange={(e) => setAlias(e.target.value)} />
            <button type="button" className="btn sm" onClick={() => setAlias(suggestAlias())}>🎲 Sugerir</button>
          </span>
        </label>
        <ul className="acc-checks"><Check ok={c.length}>De 3 a 16 caracteres</Check><Check ok={c.chars}>Letras, números, punto o guiones</Check><li className="hint">No uses tu nombre real.</li></ul>
        <PasswordField value={pw} onChange={setPw} alias={a} label="Contraseña" autoComplete="new-password" meter />
        <ul className="acc-checks"><Check ok={c.pw}>Al menos {PASSWORD_MIN} caracteres (una frase corta sirve)</Check><Check ok={c.notAlias}>Que no contenga tu alias</Check></ul>
        <PasswordField value={pw2} onChange={setPw2} alias={a} label="Confirmar contraseña" autoComplete="new-password" />
        <ul className="acc-checks"><Check ok={c.match}>{pw2 && !c.match ? 'Las contraseñas no coinciden' : 'Las dos contraseñas coinciden'}</Check></ul>
        <label className="acc-switch">
          <input type="checkbox" role="switch" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
          <span><b>Aparecer en el ranking semanal</b><small>Solo tu alias y tus puntos. Puedes cambiarlo cuando quieras.</small></span>
        </label>
        {error && <p className="libre-err" role="alert" id="auth-error">{error}</p>}
        <button className="btn primary lg" disabled={busy || !ready} data-auth-submit="">{busy ? 'Creando tu cuenta…' : 'Crear cuenta'}</button>
        <p className="auth-switch">¿Ya tienes una cuenta? <a href={keepBack('/entrar')} onClick={go(keepBack('/entrar'))}>Iniciar sesión</a></p>
      </form>
    </AuthLayout>
  );
}

export function LoginPage() {
  const [alias, setAlias] = useState('');
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    try { await signIn('login', alias.trim(), pw); store.set('dt:has-account', '1'); navigate(afterAuth()); }
    catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  };
  return (
    <AuthLayout eyebrow="Iniciar sesión" title="Willkommen zurück." lead="Entra con tu alias para seguir donde lo dejaste."
      side={<JoinClass />}>
      <form className="auth-form" onSubmit={submit} aria-describedby={error ? 'auth-error' : undefined}>
        <h2>Iniciar sesión</h2>
        <label className="acc-field"><span>Alias</span><input className="field" value={alias} maxLength={16} autoComplete="username" autoCapitalize="off" spellCheck={false} required autoFocus onChange={(e) => setAlias(e.target.value)} /></label>
        <PasswordField value={pw} onChange={setPw} alias="" label="Contraseña" autoComplete="current-password" />
        {error && <p className="libre-err" role="alert" id="auth-error">{error}</p>}
        <button className="btn primary lg" disabled={busy || !alias.trim() || !pw} data-auth-submit="">{busy ? 'Entrando…' : 'Iniciar sesión'}</button>
        <p className="auth-switch">¿No tienes cuenta? <a href={keepBack('/registro')} onClick={go(keepBack('/registro'))}>Crear cuenta</a></p>
        <p className="libre-note">¿Olvidaste la contraseña? Pídele a tu profesor una nueva: puede restablecerla desde su panel.</p>
      </form>
    </AuthLayout>
  );
}
