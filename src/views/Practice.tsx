import { useEffect, useMemo, useState, type FormEvent } from 'react';
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

type Hello = Extract<ConstructorParameters<typeof Net>[0], { role: 'practice' }>;
interface Opts { topics: Topic[]; focus: boolean; size: number }
/** `account`: la práctica se abrió con la cuenta de alumno (cuenta para el ranking semanal). */
interface Saved { room: string; token: string; opts?: Opts; account?: boolean }

export const PRACTICE_SIZES = [10, 15, 25] as const;
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
  const resume = (s: Saved) => setHello({
    t: 'hello', role: 'practice', room: s.room, token: s.token, profile: profileId(), name: store.get('bc:name') ?? undefined,
    ...(s.opts ? { topics: s.opts.topics, focus: s.opts.focus, size: s.opts.size } : {}),
    ...(s.account ? asAccount() : {}),
  });
  // Recarga a mitad de práctica: se ofrece «Continuar», pero primero se ve el selector de temas.


  if (hello) {
    const again = () => setHello({ t: 'hello', role: 'practice', profile: profileId(), name: store.get('bc:name') ?? hello.name, topics: hello.topics, focus: hello.focus, size: hello.size, ...(hello.free ? asAccount() : {}) });
    const toForm = () => { store.del(KEY); setHello(null); };
    return <PracticeConn key={run} hello={hello} onAgain={again} onForm={toForm} />;
  }

  const start = (e: FormEvent) => {
    e.preventDefault();
    store.set('bc:psize', String(size));
    // Con cuenta: el servidor usa la cuenta (y suma el historial de repaso de este dispositivo). profile = este dispositivo.
    if (account && studentSession()) { setHello({ t: 'hello', role: 'practice', topics, focus, size, profile: profileId(), ...asAccount() }); return; }
    if (!name.trim() && !pcode.trim()) return;
    store.set('bc:name', name.trim());
    setHello({ t: 'hello', role: 'practice', name: name.trim(), topics, focus, size, profile: profileId(), ...(pcode.trim() ? { profileCode: pcode.trim().toUpperCase() } : {}) });
  };
  return (
    <div className="setup-stage practice-setup">
      <div className="setup-main">
        <header className="setup-head">
          <h1>Práctica <b>// sin reloj</b></h1>
          <p>Todo el banco de preguntas, sin tiempo. Elige temas y empieza: cada sesión trae preguntas nuevas y repasa lo que fallaste.</p>
        </header>
        {saved && (
          <div className="panel row" style={{ width: '100%' }}>
            <span>Tienes una práctica a medias.</span><span className="spacer" />
            <button type="button" className="btn primary" onClick={() => resume(saved)}>Continuar</button>
            <button type="button" className="btn ghost" onClick={() => { store.del(KEY); location.reload(); }}>Empezar otra</button>
          </div>
        )}
        <form className="panel stack" onSubmit={start}>
          <TopicPicker value={topics} onChange={setTopics} />
          <div className="setup-bar">
            <div className="row" role="radiogroup" aria-label="Preguntas por sesión" style={{ gap: 8 }}>
              <span className="dim">Preguntas</span>
              <div className="chips">
                {PRACTICE_SIZES.map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={size === n} className={`btn sm${size === n ? ' on' : ''}`} onClick={() => setSize(n)}>{n}</button>
                ))}
              </div>
            </div>
            <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={focus} onChange={(e) => setFocus(e.target.checked)} /> Repasar sobre todo mis fallos</label>
          </div>
          {!account && <div className="setup-bar">
            <input className="field" style={{ flex: '1 1 200px' }} value={name} maxLength={16} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" aria-label="Tu nombre" />
            <input className="field dot" style={{ flex: '0 1 170px', letterSpacing: '0.15em' }} value={pcode} maxLength={8} onChange={(e) => setPcode(e.target.value.toUpperCase())} placeholder={myCode ? `código: ${myCode}` : 'código'} aria-label="Código de alumno (opcional)" />
          </div>}
          <div className="setup-go">
            <button className="btn primary lg" disabled={!account && !name.trim() && !pcode.trim()}>Empezar práctica →</button>
            <section className="practice-account" aria-label="Tu cuenta" style={{ flex: 1, minWidth: 220 }}>
              {account ? (
                <span className="libre-note" data-practice-account="">Practicas como <b>{account.alias}</b>: cuenta para tu progreso y el <a href="/ranking" onClick={followLearningLink}>ranking</a>.</span>
              ) : (
                <span className="libre-note" data-practice-gate="">Sin cuenta no cuenta para el ranking. <a href="/entrar?volver=/practica" onClick={(e) => { e.preventDefault(); navigate('/entrar?volver=/practica'); }}>Iniciar sesión</a> · <a href="/registro?volver=/practica" onClick={(e) => { e.preventDefault(); navigate('/registro?volver=/practica'); }}>Crear cuenta</a></span>
              )}
            </section>
          </div>
        </form>
        <div className="setup-links"><a className="btn ghost sm" href="/tema/1" onClick={followLearningLink}>Materiales de Tema 1</a><a className="btn ghost sm" href="/tema/1/taller" onClick={followLearningLink}>Escritura y escenas</a></div>
      </div>
      <aside className="setup-side"><KlausCompanion /></aside>
    </div>
  );
}

function PracticeConn({ hello, onAgain, onForm }: { hello: Hello; onAgain: () => void; onForm: () => void }) {
  const net = useMemo(() => new Net(hello, (m) => {
    const opts: Opts = { topics: hello.topics ?? [], focus: !!hello.focus, size: hello.size ?? 15 };
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
