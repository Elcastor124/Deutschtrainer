// MODO LIBRE: el alumno elige juego, nivel y temas y juega sin profesor (en solitario o con un amigo por código).
// Cuenta opcional: con cuenta se guarda el progreso; como invitado se practica igual pero no se guarda nada.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ALIAS_RULES, LEVEL_LABEL, PASSWORD_MIN, type AccountPub, type Level, type PlayGame, type ProgressSummary, type RankingEntry } from '../../shared/play.ts';
import { boxingRequest, saveBoxingSession } from '../boxing-client.ts';
import type { BoxingWelcome } from '../../shared/boxing.ts';
import { deleteAccount, getCatalog, getLeaderboard, getMe, getProgress, setRanking, signIn, signOut, type Catalog } from '../play-client.ts';
import { navigate, store, studentSession } from '../util.ts';
import '../libre.css';

export function Libre() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [account, setAccount] = useState<AccountPub | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const refreshAccount = useCallback(async () => {
    if (!studentSession()) { setAccount(null); return; }
    try { setAccount((await getMe()).account); } catch { setAccount(null); }
  }, []);
  useEffect(() => {
    void getCatalog().then(setCatalog).catch((e: Error) => setLoadError(e.message));
    void refreshAccount();
  }, [refreshAccount]);
  return (
    <main className="libre" data-libre="">
      <header>
        <p className="dt-eyebrow">Modo libre · sin profesor</p>
        <h1>Practica a tu ritmo.</h1>
        <p className="libre-lead">Elige un juego, tu nivel y los temas que quieres trabajar. Recibes corrección y explicación en cada respuesta. Si tienes cuenta, el servidor guarda tu progreso; si no, practicas igual como invitado.</p>
        <p className="libre-note">¿Eres profesor? <a href="/jugar" onClick={(e) => { e.preventDefault(); navigate('/jugar'); }}>Crea una sala de clase</a>. El modo libre no tiene controles de profesor.</p>
      </header>
      <AccountPanel account={account} onChange={refreshAccount} />
      {loadError && <p className="libre-err" role="alert">No se pudo cargar el catálogo: {loadError}</p>}
      {catalog && <Picker catalog={catalog} account={account} />}
      {account && <ProgressPanel />}
      <Leaderboard />
    </main>
  );
}

function AccountPanel({ account, onChange }: { account: AccountPub | null; onChange: () => Promise<void> }) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [alias, setAlias] = useState('');
  const [password, setPassword] = useState('');
  const [optIn, setOptIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    try { await signIn(tab, alias.trim(), password, optIn); setPassword(''); await onChange(); } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  };
  if (account) {
    return (
      <section className="libre-card" aria-label="Tu cuenta">
        <h2>Sesión iniciada como <b>{account.alias}</b></h2>
        <label className="libre-row"><input type="checkbox" checked={account.rankingOptIn} onChange={async (e) => { try { await setRanking(e.target.checked); await onChange(); } catch (cause) { setError((cause as Error).message); } }} /> Aparecer en el ranking semanal con mi alias <span className="libre-note">(solo alias y puntos; nunca tu nombre ni tus estadísticas)</span></label>
        <div className="libre-row">
          <button className="btn" onClick={async () => { await signOut(); await onChange(); }}>Cerrar sesión</button>
          {confirmDelete
            ? <form className="libre-row" onSubmit={async (e) => { e.preventDefault(); const pw = new FormData(e.currentTarget).get('pw') as string; try { await deleteAccount(pw); await onChange(); } catch (cause) { setError((cause as Error).message); } }}>
                <input className="field" type="password" name="pw" placeholder="Tu contraseña" autoComplete="current-password" required /><button className="btn ghost">Eliminar cuenta y progreso</button>
              </form>
            : <button className="btn ghost" onClick={() => setConfirmDelete(true)}>Eliminar mi cuenta…</button>}
        </div>
        {error && <p className="libre-err" role="alert">{error}</p>}
      </section>
    );
  }
  return (
    <section className="libre-card" aria-label="Cuenta de alumno">
      <h2>¿Tienes cuenta? <span className="libre-note">Opcional</span></h2>
      <div className="libre-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'login'} className={`btn sm${tab === 'login' ? ' on' : ''}`} onClick={() => setTab('login')}>Entrar</button>
        <button role="tab" aria-selected={tab === 'register'} className={`btn sm${tab === 'register' ? ' on' : ''}`} onClick={() => setTab('register')}>Crear cuenta</button>
      </div>
      <form className="libre-card" style={{ padding: 0, border: 0, boxShadow: 'none', background: 'none' }} onSubmit={submit}>
        <label>Alias<input className="field" value={alias} maxLength={16} autoComplete="username" required onChange={(e) => setAlias(e.target.value)} /></label>
        <label>Contraseña<input className="field" type="password" value={password} minLength={PASSWORD_MIN} maxLength={128} autoComplete={tab === 'login' ? 'current-password' : 'new-password'} required onChange={(e) => setPassword(e.target.value)} /></label>
        {tab === 'register' && <>
          <p className="libre-note">{ALIAS_RULES} Contraseña: mínimo {PASSWORD_MIN} caracteres. No hay recuperación por correo: guárdala bien.</p>
          <label className="libre-row"><input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} /> Quiero aparecer en el ranking semanal (solo mi alias)</label>
        </>}
        <div className="libre-row"><button className="btn primary" disabled={busy}>{tab === 'login' ? 'Entrar' : 'Crear cuenta'}</button></div>
        {error && <p className="libre-err" role="alert">{error}</p>}
      </form>
      <p className="libre-note">Sin cuenta juegas como <b>invitado</b>: todo funciona, pero no se guarda progreso ni puntos.</p>
    </section>
  );
}

function Picker({ catalog, account }: { catalog: Catalog; account: AccountPub | null }) {
  const available = catalog.games.filter((g) => g.available);
  const [gameId, setGameId] = useState<PlayGame>('blackcard');
  const game = catalog.games.find((g) => g.id === gameId) ?? available[0];
  const [level, setLevel] = useState<Level>('A1');
  const [topics, setTopics] = useState<string[]>([]);
  const [name, setName] = useState(() => store.get('dt:free:name') ?? '');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const eff: Level = game.levels.includes(level) ? level : game.levels[0] ?? 'A1';
  const modes = game.modes;
  const topicList = gameId === 'boxing' ? catalog.boxingTopics.map((t) => ({ id: t.id, label: t.name, pool: t.pool })) : catalog.topics.map((t) => ({ id: t.id, label: t.de, pool: t.pool[eff] }));
  const pick = (id: string) => setTopics((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));
  const needName = !account;

  const start = async (kind: 'solo' | 'create' | 'join') => {
    setError(null);
    if (needName && !name.trim()) { setError('Escribe un nombre para jugar como invitado.'); return; }
    store.set('dt:free:name', name.trim());
    if (gameId !== 'boxing') {
      const q = new URLSearchParams({ juego: gameId, nivel: eff, n: '10' });
      if (topics.length) q.set('temas', topics.join(','));
      navigate(`/libre/jugar?${q.toString().replace(/%2C/g, ',')}`);
      return;
    }
    setBusy(true);
    try {
      const body = kind === 'join' ? { code: code.trim().toUpperCase(), name: name.trim() } : { topics, name: name.trim() };
      const w = await boxingRequest<BoxingWelcome>(kind === 'solo' ? 'solo' : kind, body, undefined, undefined, true);
      saveBoxingSession(w);
      navigate(`/boxeo?code=${encodeURIComponent(w.code)}`);
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  };

  return (
    <section className="libre-card" aria-label="Elige tu partida">
      <h2>1 · Juego</h2>
      <div className="libre-games" role="radiogroup" aria-label="Juego">
        {catalog.games.map((g) => (
          <button key={g.id} type="button" role="radio" aria-checked={g.id === gameId} disabled={!g.available} className="libre-game" onClick={() => setGameId(g.id)}>
            <b>{g.name}</b><span>{g.available ? g.solo : 'Próximamente'}</span>
            <small>{g.available ? g.modes.map((m) => (m === 'solo' ? 'Solo' : 'Con amigo por código')).join(' · ') : g.note}</small>
          </button>
        ))}
      </div>
      {game.note && game.available && <p className="libre-note">{game.note}</p>}

      <h2>2 · Nivel</h2>
      <div className="libre-row" role="radiogroup" aria-label="Nivel">
        {(['A1', 'A2', 'B1'] as Level[]).map((l) => (
          <button key={l} type="button" role="radio" aria-checked={eff === l} disabled={!game.levels.includes(l)} className={`btn sm${eff === l ? ' on' : ''}`} onClick={() => setLevel(l)}>{LEVEL_LABEL[l]}</button>
        ))}
      </div>
      <p className="libre-note">El nivel selecciona una banda de dificultad del banco de preguntas (A1 fácil · A2 fácil y media · B1 Training media y difícil).</p>

      <h2>3 · Temas <span className="libre-note">(sin marcar = todos)</span></h2>
      <div className="chips">
        {topicList.map((t) => (
          <button key={t.id} type="button" className={`btn sm${topics.includes(t.id) ? ' on' : ''}`} aria-pressed={topics.includes(t.id)} disabled={t.pool === 0} title={`${t.pool} preguntas`} onClick={() => pick(t.id)}>{t.label} <small>{t.pool}</small></button>
        ))}
      </div>

      {needName && <label>Tu nombre de invitado<input className="field" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} /></label>}

      <h2>4 · Jugar</h2>
      <div className="libre-row">
        <button className="btn primary lg" disabled={busy} onClick={() => start('solo')}>{gameId === 'boxing' ? 'Combatir contra el sparring' : 'Empezar en solitario'}</button>
        {modes.includes('private') && <button className="btn" disabled={busy} onClick={() => start('create')}>Crear sala privada</button>}
      </div>
      {modes.includes('private') && (
        <form className="libre-row" onSubmit={(e) => { e.preventDefault(); void start('join'); }}>
          <input className="field dot" style={{ letterSpacing: '0.15em', width: '9ch' }} placeholder="CÓDIGO" maxLength={4} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} aria-label="Código de sala privada" />
          <button className="btn" disabled={busy || code.trim().length !== 4}>Unirme con código</button>
        </form>
      )}
      {gameId === 'boxing' && <p className="libre-note">El sparring del sistema acierta el 60 % de las preguntas y sigue reglas fijas y públicas (ver docs/FREE_PLAY.md). Las salas privadas son para dos personas con código: sin chat, sin emparejamiento con desconocidos.</p>}
      {error && <p className="libre-err" role="alert">{error}</p>}
    </section>
  );
}

function ProgressPanel() {
  const [p, setP] = useState<ProgressSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void getProgress().then(setP).catch((e: Error) => setError(e.message)); }, []);
  if (error) return <p className="libre-err" role="alert">{error}</p>;
  if (!p) return null;
  return (
    <section className="libre-card" aria-label="Tu progreso">
      <h2>Tu progreso</h2>
      <div className="libre-stats">
        <div className="libre-stat"><span>Puntos esta semana</span><b>{p.weekPoints}</b></div>
        <div className="libre-stat"><span>Racha de días</span><b>{p.streak}</b></div>
        <div className="libre-stat"><span>Ranking</span><b>{p.rank ?? '—'}</b></div>
      </div>
      {p.advice.length > 0 && <><h2>Recomendaciones de repaso</h2><ul className="libre-list">{p.advice.map((a) => <li key={a}>{a}</li>)}</ul></>}
      {p.accuracy.some((a) => a.accuracy !== null) && <><h2>Evolución de tu precisión</h2>{p.accuracy.filter((a) => a.accuracy !== null).map((a) => (
        <div key={a.week} className="libre-bar"><span>{a.week.slice(5)}</span><i style={{ width: `${Math.round((a.accuracy ?? 0) * 100)}%` }} /><span>{Math.round((a.accuracy ?? 0) * 100)} %</span></div>
      ))}</>}
      {p.frequentErrors.length > 0 && <><h2>Errores frecuentes</h2><ul className="libre-list">{p.frequentErrors.map((e) => <li key={e.qid} lang="de">{e.prompt} <span className="libre-note">({e.wrong} fallos)</span></li>)}</ul></>}
      {p.activities.length > 0 && <><h2>Actividades completadas</h2><ul className="libre-list">{p.activities.map((a) => <li key={a.at}>{a.game} {a.level ?? ''} · {a.correct}/{a.total} · {new Date(a.at).toLocaleDateString()}</li>)}</ul></>}
    </section>
  );
}

function Leaderboard() {
  const [rows, setRows] = useState<RankingEntry[] | null>(null);
  useEffect(() => { void getLeaderboard().then((r) => setRows(r.entries)).catch(() => setRows([])); }, []);
  if (!rows) return null;
  return (
    <section className="libre-card" aria-label="Ranking semanal">
      <h2>Ranking semanal <span className="libre-note">(opcional: solo alias que han decidido aparecer)</span></h2>
      {rows.length === 0 ? <p className="libre-note">Todavía nadie. Los puntos salen de actividades completadas y respuestas validadas por el servidor, con un límite diario; estar conectado no puntúa.</p>
        : <ol className="libre-list">{rows.map((r) => <li key={r.alias}><b>{r.alias}</b> · {r.points} puntos</li>)}</ol>}
    </section>
  );
}
