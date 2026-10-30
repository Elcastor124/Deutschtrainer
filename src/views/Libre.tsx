// MODO LIBRE: el alumno elige juego, nivel y temas y juega sin profesor (en solitario o con un amigo por código).
// Cuenta opcional: con cuenta se guarda el progreso; como invitado se practica igual pero no se guarda nada.
import { useEffect, useState } from 'react';
import { LEVEL_LABEL, type AccountPub, type Level, type PlayGame, type RankingEntry } from '../../shared/play.ts';
import { boxingRequest, saveBoxingSession } from '../boxing-client.ts';
import type { BoxingWelcome } from '../../shared/boxing.ts';
import { cachedAlias, getCatalog, getLeaderboard, playRequest, refreshAccount, type Catalog } from '../play-client.ts';
import { navigate, store } from '../util.ts';
import '../libre.css';
import '../account.css';

export function Libre() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [account, setAccount] = useState<AccountPub | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    void getCatalog().then(setCatalog).catch((e: Error) => setLoadError(e.message));
    void refreshAccount().then(setAccount);
    const on = () => setAccount(cachedAlias() ? { alias: cachedAlias()!, rankingOptIn: false } : null);
    addEventListener('dt:account', on);
    return () => removeEventListener('dt:account', on);
  }, []);
  return (
    <main className="libre" data-libre="">
      <header>
        <p className="dt-eyebrow">Modo libre · sin profesor</p>
        <h1>Practica a tu ritmo.</h1>
        <p className="libre-lead">Elige un juego, tu nivel y los temas que quieres trabajar. Recibes corrección y explicación en cada respuesta. Si tienes cuenta, el servidor guarda tu progreso; si no, practicas igual como invitado.</p>
        <p className="libre-note">¿Eres profesor? <a href="/jugar" onClick={(e) => { e.preventDefault(); navigate('/jugar'); }}>Crea una sala de clase</a>. El modo libre no tiene controles de profesor.</p>
      </header>
      <AccountStrip account={account} />
      {loadError && <p className="libre-err" role="alert">No se pudo cargar el catálogo: {loadError}</p>}
      {catalog && <Picker catalog={catalog} account={account} />}
      <Leaderboard />
    </main>
  );
}

function Picker({ catalog, account }: { catalog: Catalog; account: AccountPub | null }) {
  const available = catalog.games.filter((g) => g.available);
  // ?juego=boxing (desde «Mi espacio») preselecciona el juego.
  const [gameId, setGameId] = useState<PlayGame>(() => { const g = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('juego') : null; return catalog.games.some((x) => x.id === g && x.available) ? g as PlayGame : 'blackcard'; });
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
    // Las salas privadas usan la vista de alumno de siempre (/p/CÓDIGO): le pasamos el nombre del invitado para no volver a pedirlo.
    if (name.trim()) store.set('bc:name', name.trim());
    if (gameId !== 'boxing' && kind === 'join') { navigate(`/p/${code.trim().toUpperCase()}`); return; }
    if (gameId !== 'boxing' && kind === 'create') {
      setBusy(true);
      try {
        const r = await playRequest<{ code: string; token: string }>('/api/play/room', { game: gameId, level: eff, topics, name: name.trim() });
        store.set(`bc:p:${r.code}`, r.token);
        navigate(`/p/${r.code}`);
      } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
      return;
    }
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
      <p className="libre-note">{gameId === 'boxing' ? 'El sparring del sistema acierta el 60 % de las preguntas y sigue reglas fijas y públicas. La sala privada de boxeo es para dos personas.' : 'La sala privada es para 2–6 personas: el servidor corrige y avanza solo, sin profesor.'} Solo entra quien tenga el código: sin chat y sin emparejamiento con desconocidos.</p>
      {error && <p className="libre-err" role="alert">{error}</p>}
    </section>
  );
}

function AccountStrip({ account }: { account: AccountPub | null }) {
  const go = (e: { preventDefault: () => void }) => { e.preventDefault(); navigate('/registro?volver=/libre'); };
  return account ? (
    <section className="libre-card acc-strip" aria-label="Tu cuenta">
      <span className="acc-avatar small" aria-hidden="true">{account.alias.slice(0, 1).toUpperCase()}</span>
      <div><b>Juegas como {account.alias}</b><span className="libre-note">Tus resultados se guardan solos al completar cada actividad.</span></div>
      <a className="btn" href="/cuenta" onClick={(e) => { e.preventDefault(); navigate('/cuenta'); }}>Ver mi progreso</a>
    </section>
  ) : (
    <section className="libre-card acc-strip" aria-label="Cuenta">
      <span className="acc-avatar small guest" aria-hidden="true">?</span>
      <div><b>Juegas como invitado</b><span className="libre-note">Todo funciona, pero no se guarda tu progreso. Con una cuenta (solo alias y contraseña) sí.</span></div>
      <a className="btn primary" href="/cuenta" onClick={go}>Crear cuenta</a>
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
