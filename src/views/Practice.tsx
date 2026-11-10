import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { TOPICS } from '../../shared/rules.ts';
import type { Topic } from '../../shared/types.ts';
import { Net, useNet } from '../net.ts';
import { navigate, profileId, store, studentSession } from '../util.ts';
import type { AccountPub } from '../../shared/play.ts';
import { cachedAlias, refreshAccount } from '../play-client.ts';
import '../libre.css';
import '../account.css';
import { PlayScreen } from './Player.tsx';
import { followLearningLink } from '../components/LearningNav.tsx';
import { ErrorBoundary } from '../components/ErrorBoundary.tsx';
import { KlausCompanion } from '../klaus/KlausCompanion.tsx';
import { KlausPracticeStage } from '../klaus/KlausPracticeStage.tsx';
import { TopicPicker } from '../components/TopicPicker.tsx';
import { Segmented, type SegOption } from '../components/Segmented.tsx';
import { getCatalog, type Catalog } from '../play-client.ts';
import type { Level } from '../../shared/play.ts';
import '../practice-setup.css';

type Hello = Extract<ConstructorParameters<typeof Net>[0], { role: 'practice' }>;
interface Opts { topics: Topic[]; focus: boolean; size: number; level?: Level }
/** `account`: la práctica se abrió con la cuenta de alumno (cuenta para el ranking semanal). */
interface Saved { room: string; token: string; opts?: Opts; account?: boolean }

export const PRACTICE_SIZES = [10, 15, 25] as const;
/** Niveles del selector. Solo A1 y A2 tienen contenido propio; B1–C2 quedan como «Próximamente». */
type LevelPick = 'all' | 'A1' | 'A2' | 'soon';
const KEY = 'bc:practice';

function readSaved(): Saved | null {
  try {
    const v = JSON.parse(store.get(KEY) ?? 'null');
    return v && typeof v.room === 'string' && typeof v.token === 'string' ? v : null;
  } catch { return null; }
}

/** ?temas=dativ,akkusativ (enlaces del curso) preselecciona temas. */
export function topicsFromQuery(search: string): Topic[] {
  const raw = new URLSearchParams(search).get('temas') ?? '';
  return [...new Set(raw.split(',').map((t) => t.trim()).filter((t): t is Topic => Object.hasOwn(TOPICS, t)))];
}

export function Practice() {
  const saved = readSaved();
  const [hello, setHelloRaw] = useState<Hello | null>(null);
  const [run, setRun] = useState(0);
  const setHello = (h: Hello | null) => { setRun((x) => x + 1); setHelloRaw(h); };
  const [name, setName] = useState(store.get('bc:name') ?? '');
  const [topics, setTopics] = useState<Topic[]>(() => topicsFromQuery(typeof location !== 'undefined' ? location.search : ''));
  const [focus, setFocus] = useState(false);
  const [size, setSize] = useState<number>(() => Number(store.get('bc:psize')) || 15);
  const [pcode, setPcode] = useState('');
  const [level, setLevel] = useState<LevelPick>(() => (store.get('bc:plevel') === 'A1' || store.get('bc:plevel') === 'A2' ? store.get('bc:plevel') as LevelPick : 'all'));
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  useEffect(() => { void getCatalog().then(setCatalog).catch(() => setCatalog(null)); }, []);
  const myCode = store.get('bc:pcode');

  // Con cuenta, la práctica va por la cuenta: sus respuestas cuentan para el ranking semanal (ver /ranking).
  const [account, setAccount] = useState<AccountPub | null>(() => (cachedAlias() && studentSession() ? { alias: cachedAlias()!, rankingOptIn: false } : null));
  useEffect(() => {
    void refreshAccount().then(setAccount);
    const on = () => setAccount(cachedAlias() ? { alias: cachedAlias()!, rankingOptIn: false } : null);
    addEventListener('dt:account', on);
    return () => removeEventListener('dt:account', on);
  }, []);
  const asAccount = () => { const session = studentSession(); return session ? { free: true, session } : {}; };
  // Pasar del formulario a la partida es un cambio de pantalla: se empieza arriba, sin animar el salto
  // (el formulario puede estar desplazado; un scroll suave movería los controles mientras se usan).
  const toTop = () => scrollTo({ top: 0, behavior: 'instant' });
  const resume = (s: Saved) => { toTop(); setHello({
    t: 'hello', role: 'practice', room: s.room, token: s.token, profile: profileId(), name: store.get('bc:name') ?? undefined,
    ...(s.opts ? { topics: s.opts.topics, focus: s.opts.focus, size: s.opts.size, ...(s.opts.level ? { level: s.opts.level } : {}) } : {}),
    ...(s.account ? asAccount() : {}),
  }); };
  // Recarga a mitad de práctica: se ofrece «Continuar», pero primero se ve el selector de temas.


  if (hello) {
    const again = () => setHello({ t: 'hello', role: 'practice', profile: profileId(), name: store.get('bc:name') ?? hello.name, topics: hello.topics, focus: hello.focus, size: hello.size, ...(hello.level ? { level: hello.level } : {}), ...(hello.free ? asAccount() : {}) });
    const toForm = () => { store.del(KEY); setHello(null); };
    return <PracticeConn key={run} hello={hello} onAgain={again} onForm={toForm} />;
  }

  const start = (e: FormEvent) => {
    toTop();
    e.preventDefault();
    store.set('bc:psize', String(size));
    store.set('bc:plevel', level);
    // Con cuenta: el servidor usa la cuenta (y suma el historial de repaso de este dispositivo). profile = este dispositivo.
    // El nivel (banda de dificultad del banco) solo lo aplica el servidor con cuenta.
    if (account && studentSession()) { setHello({ t: 'hello', role: 'practice', topics, focus, size, profile: profileId(), ...(lv ? { level: lv } : {}), ...asAccount() }); return; }
    if (!name.trim() && !pcode.trim()) return;
    store.set('bc:name', name.trim());
    setHello({ t: 'hello', role: 'practice', name: name.trim(), topics, focus, size, profile: profileId(), ...(pcode.trim() ? { profileCode: pcode.trim().toUpperCase() } : {}) });
  };
  const lv: Level | undefined = account && (level === 'A1' || level === 'A2') ? level : undefined;
  // Preguntas reales del banco por tema para el nivel elegido (catálogo del servidor). «Todos» = fácil ∪ (media, difícil, especial).
  const counts = catalog ? Object.fromEntries(catalog.topics.map((t) => [t.id, lv ? t.pool[lv] : t.pool.A1 + t.pool.B1])) as Partial<Record<Topic, number>> : undefined;
  const available = counts ? (topics.length ? topics : (Object.keys(counts) as Topic[])).reduce((n, t) => n + (counts[t] ?? 0), 0) : undefined;
  const tooFew = lv !== undefined && available !== undefined && available < 5;
  const levels: SegOption<LevelPick>[] = [
    { id: 'all', label: 'Todos', tag: 'mezcla' },
    { id: 'A1', label: 'A1', tag: account ? 'básico' : 'con cuenta', disabled: !account },
    { id: 'A2', label: 'A2', tag: account ? 'elemental' : 'con cuenta', disabled: !account },
    { id: 'soon', label: 'B1–C2', tag: 'próximamente', disabled: true, title: 'Próximamente: el contenido de B1 a C2 aún no está completo' },
  ];
  const canStart = (!!account || !!name.trim() || !!pcode.trim()) && !tooFew;
  const summary = [`${size} preguntas`, topics.length ? (topics.length > 2 ? `${topics.length} temas` : topics.map((t) => TOPICS[t].de).join(' · ')) : 'todos los temas', lv ?? 'todos los niveles'].join(' · ');
  return (
    <div className="setup-stage practice-setup">
      <div className="setup-main">
        <header className="pr-head" data-m="rise">
          <p className="m-label"><i>Üben</i>Práctica sin reloj</p>
          <h1>Elige qué repasar<b className="dt-punkt">.</b></h1>
          <p>Todo el banco de preguntas, sin tiempo: cada sesión trae preguntas nuevas y vuelve sobre lo que fallaste.</p>
        </header>
        {saved && (
          <div className="pr-resume" role="region" aria-label="Práctica a medias" data-m="rise" style={{ '--m-i': 1 } as CSSProperties}>
            <span className="pr-resume-dot" aria-hidden="true" />
            <div>
              <b>Tienes una práctica a medias</b>
              <small>{saved.opts?.topics.length ? saved.opts.topics.map((t) => TOPICS[t]?.de ?? t).join(' · ') : 'Todos los temas'}{saved.opts ? ` · ${saved.opts.size} preguntas` : ''}</small>
            </div>
            <button type="button" className="btn primary" onClick={() => resume(saved)}>Continuar</button>
            <button type="button" className="btn ghost sm" onClick={() => { store.del(KEY); location.reload(); }}>Empezar otra</button>
          </div>
        )}
        <form className="pr-form" data-practice-form="" onSubmit={start}>
          <section className="pr-step" aria-labelledby="pr-level" data-m="rise" style={{ '--m-i': 2 } as CSSProperties}>
            <div className="pr-step-head">
              <h2 id="pr-level" className="m-label"><i>01</i>Nivel</h2>
              <small>{account ? 'A1 y A2 usan las preguntas de ese nivel.' : 'Sin cuenta se mezclan todos los niveles.'}</small>
            </div>
            <Segmented label="Nivel" options={levels} value={level} onChange={setLevel} className="pr-levels" />
          </section>
          <section className="pr-step" data-m="rise" style={{ '--m-i': 3 } as CSSProperties}>
            <TopicPicker value={topics} onChange={setTopics} counts={counts} step="02" />
          </section>
          <section className="pr-step pr-session" aria-labelledby="pr-session" data-m="rise" style={{ '--m-i': 4 } as CSSProperties}>
            <div className="pr-step-head"><h2 id="pr-session" className="m-label"><i>03</i>Sesión</h2></div>
            <div className="pr-session-row">
              <div className="pr-field">
                <span className="pr-field-k" id="pr-size">Preguntas</span>
                <Segmented label="Preguntas por sesión" options={PRACTICE_SIZES.map((n) => ({ id: n, label: String(n) }))} value={size} onChange={setSize} />
              </div>
              <label className="m-switch pr-focus"><input type="checkbox" checked={focus} onChange={(e) => setFocus(e.target.checked)} /><span>Repasar sobre todo mis fallos</span></label>
            </div>
            {!account && <div className="pr-who">
              <input className="field" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" aria-label="Tu nombre" />
              <input className="field dot" value={pcode} maxLength={8} onChange={(e) => setPcode(e.target.value.toUpperCase())} placeholder={myCode ? `código: ${myCode}` : 'código'} aria-label="Código de alumno (opcional)" />
            </div>}
          </section>
          <div className="pr-go">
            <div className="pr-go-sum">
              <span className="pr-go-k">Tu sesión</span>
              <b>{summary}</b>
              {tooFew
                ? <small className="pr-warn" role="status">Hay muy pocas preguntas para esa combinación. Elige más temas u otro nivel.</small>
                : <section className="practice-account" aria-label="Tu cuenta">
                  {account ? (
                    <small className="libre-note" data-practice-account="">Practicas como <b>{account.alias}</b>: cuenta para tu progreso y el <a href="/ranking" onClick={followLearningLink}>ranking</a>.</small>
                  ) : (
                    <small className="libre-note" data-practice-gate="">Sin cuenta no cuenta para el ranking. <a href="/entrar?volver=/practica" onClick={(e) => { e.preventDefault(); navigate('/entrar?volver=/practica'); }}>Iniciar sesión</a> · <a href="/registro?volver=/practica" onClick={(e) => { e.preventDefault(); navigate('/registro?volver=/practica'); }}>Crear cuenta</a></small>
                  )}
                </section>}
            </div>
            <button className="btn primary lg pr-start" disabled={!canStart}>Empezar práctica <span aria-hidden="true">→</span></button>
          </div>
        </form>
        <div className="setup-links"><a className="btn ghost sm" href="/tema/1" onClick={followLearningLink}>Materiales de Tema 1</a><a className="btn ghost sm" href="/tema/1/taller" onClick={followLearningLink}>Escritura y escenas</a></div>
      </div>
      <aside className="setup-side"><KlausCompanion /><a className="btn ghost sm" href="/klaus" onClick={followLearningLink}>Cambiar de Klaus</a></aside>
    </div>
  );
}

function PracticeConn({ hello, onAgain, onForm }: { hello: Hello; onAgain: () => void; onForm: () => void }) {
  const net = useMemo(() => new Net(hello, (m) => {
    const opts: Opts = { topics: hello.topics ?? [], focus: !!hello.focus, size: hello.size ?? 15, ...(hello.level ? { level: hello.level } : {}) };
    store.set(KEY, JSON.stringify({ room: m.room, token: m.token, opts, ...(hello.free ? { account: true } : {}) } satisfies Saved));
    if (m.profile) store.set('bc:profile', m.profile);
    if (m.profileCode) store.set('bc:pcode', m.profileCode);
  }), [hello]);
  useEffect(() => () => net.close(), [net]);
  const st = useNet(net);
  if (st.fatal) {
    return (
      <div className="home" role="alert">
        <p className="err-msg">{st.error}</p>
        <div className="row">
          <button className="btn primary" onClick={onForm}>Volver al formulario</button>
        </div>
      </div>
    );
  }
  return (
    <ErrorBoundary onReset={onForm} resetLabel="Empezar otra práctica">
      {st.notice && <p className="panel practice-notice" role="status">{st.notice}</p>}
      {st.error && <p className="err-msg" role="alert">{st.error}</p>}
      <KlausPracticeStage state={st}>
        <PlayScreen net={net} st={st} onNewPractice={onAgain} onChangeTopics={onForm} />
      </KlausPracticeStage>
    </ErrorBoundary>
  );
}
