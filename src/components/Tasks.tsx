// Actividades después del juego: vistas del alumno y del proyector.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { FEATURES, FREE_MILESTONES, LEARNED, WORT_MIN, countWords, features, fold, usedWords } from '../../shared/activities.ts';
import type { CtlAction, RoomView, TaskJengaView, TaskSceneView, TaskView, TaskWriteView, VocabWord } from '../../shared/types.ts';
import { flash, mark, punch, shake } from '../fx/juice.ts';
import { burstAt } from '../fx/particles.ts';
import { sfx } from '../fx/sound.ts';
import type { Net } from '../net.ts';
import { Stars, Timer } from './bits.tsx';
import { Tower } from './Jenga.tsx';
import { Question, QuestionHead, Umlauts, insertInto } from './Question.tsx';

/** «Tema»: instrucción → título y subtítulo. */
const splitTheme = (prompt: string) => {
  const m = /^«(.+?)»:\s*(.*)$/.exec(prompt);
  return m ? { title: m[1], sub: m[2] } : { title: prompt, sub: undefined };
};
const learned = (words: VocabWord[]) => words.map((w) => LEARNED[w.de]).filter(Boolean);
const nameOf = (v: RoomView, pid: string | null | undefined) => v.players.find((p) => p.id === pid)?.name ?? '¿?';

/** Texto con las palabras de la lista resaltadas. */
function Marked({ text, words }: { text: string; words: VocabWord[] }) {
  const res = learned(words).map((w) => new RegExp(w.re, 'i'));
  const parts = text.split(/(\s+)/);
  return (
    <p className="marked" lang="de">
      {parts.map((p, i) => (/\S/.test(p) && res.some((r) => r.test(fold(p))) ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>))}
    </p>
  );
}

function WordChips({ words, used }: { words: VocabWord[]; used: string[] }) {
  return (
    <div className="wchips">
      {words.map((w, k) => (
        <span key={w.de} className={`wchip${used.includes(w.de) ? ' on' : ''}`} style={{ '--k': k } as CSSProperties} title={w.es}>
          <i className="led" aria-hidden="true" /><b lang="de">{w.de}</b><small>{w.es}</small>
        </span>
      ))}
    </div>
  );
}

// ───────────── Alumno ─────────────
export function TaskPlay({ view, net, offset, onAgain }: { view: RoomView; net: Net; offset: number; onAgain?: () => void }) {
  const t = view.task;
  if (!t) return null;
  return (
    <section className={`task task-${t.kind}`}>
      {t.kind === 'jenga' ? <JengaPlay view={view} t={t} net={net} offset={offset} onAgain={onAgain} />
        : t.kind === 'szene' ? <ScenePlay view={view} t={t} offset={offset} />
        : <WritePlay view={view} t={t} net={net} offset={offset} />}
    </section>
  );
}

function WritePlay({ view, t, net, offset }: { view: RoomView; t: TaskWriteView; net: Net; offset: number }) {
  const me = view.me!.id;
  const set = t.sets[me];
  const entry = t.entries[me];
  const [text, setText] = useState(() => entry?.text ?? '');
  const [state, setState] = useState<'ok' | 'dirty' | 'saving' | 'err'>('ok');
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const lastUsed = useRef<string[] | null>(null);
  const chips = useRef<HTMLDivElement>(null);
  const choice = t.choice?.[me] ?? -1;

  // Si el texto llega más tarde (recarga), se carga una vez.
  useEffect(() => { if (!text && entry?.text) setText(entry.text); }, [entry?.text]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const save = async (val: string, done = false) => {
    setState('saving');
    const r = await net.request({ t: 'text', text: val, done });
    if (r.ok) { setState('ok'); setErr(null); if (done) { sfx.lock(); flash('white', 300); } }
    else { setState('err'); setErr(r.error ?? 'No se ha guardado.'); }
  };
  const change = (val: string) => {
    setText(val);
    setState('dirty');
    sfx.type();
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void save(val), 900);
  };

  const words = set?.words ?? [];
  const used = usedWords(text, learned(words));
  const n = countWords(text);
  const feats = t.kind === 'frei' ? features(text) : [];
  // Cada palabra nueva usada se celebra.
  useEffect(() => {
    if (lastUsed.current && used.length > lastUsed.current.length) {
      sfx.star();
      const fresh = used.find((u) => !lastUsed.current!.includes(u));
      const el = chips.current?.querySelector(`[title="${CSS.escape(words.find((w) => w.de === fresh)?.es ?? '')}"]`);
      if (el) { punch(el, 1.25); burstAt(el, 'pixel', 12, { colors: ['#E9B949', '#F2F1EE'], speed: 0.5 }); }
    }
    lastUsed.current = used;
  }, [used.length]);

  if (t.stage === 'show') return <WriteShow view={view} t={t} />;
  if (t.kind === 'frei' && choice < 0) {
    return (
      <div className="stack">
        <TaskHead title="Elige tu consigna" sub="Escribe libremente en alemán. Más palabras y más estructuras = más ★." view={view} offset={offset} />
        <div className="prompt-cards">
          {(t.prompts ?? []).map((p, i) => (
            <button key={p} className="prompt-card" style={{ '--k': i } as CSSProperties}
              onClick={async () => { sfx.lock(); const r = await net.request({ t: 'pick', n: i }); if (!r.ok) setErr(r.error ?? 'Error'); }}>
              <span className="pc-n">{i + 1}</span><span lang="de">{p}</span>
            </button>
          ))}
        </div>
        {err && <p className="err-msg">{err}</p>}
      </div>
    );
  }
  const stars = t.kind === 'rolle' ? used.length : t.kind === 'wort' ? used.length + (n >= WORT_MIN ? 1 : 0) : FREE_MILESTONES.filter((m) => n >= m).length + feats.length;
  const head = t.kind === 'rolle' ? { title: 'Mach es lustiger!', sub: set?.prompt }
    : t.kind === 'wort' ? splitTheme(set?.prompt ?? '')
    : { title: t.prompts?.[choice] ?? '', sub: 'Escribe libremente: 30, 50 y 80 palabras dan ★, y cada estructura que uses también.' };
  return (
    <div className="writer">
      <TaskHead title={head.title} sub={subWithReview(head.sub)} view={view} offset={offset} right={<Stars n={stars + (entry?.bonus ?? 0)} className="big-stars" />} />
      {words.length > 0 && <div ref={chips}><WordChips words={words} used={used} /></div>}
      {t.kind === 'frei' && (
        <div className="feats">
          {FREE_MILESTONES.map((m) => <span key={m} className={`feat${n >= m ? ' on' : ''}`}><i className="led" />{m} palabras</span>)}
          {FEATURES.map((f) => <span key={f.id} className={`feat${feats.includes(f.id) ? ' on' : ''}`} title={f.hint}><i className="led" />{f.label}<small>{f.hint}</small></span>)}
        </div>
      )}
      <textarea ref={ref} className="field paper" lang="de" value={text} onChange={(e) => change(e.target.value)} spellCheck={false}
        placeholder={t.kind === 'wort' ? 'Es war einmal…' : 'Schreib hier…'} aria-label="Tu texto" />
      <div className="row writer-bar">
        <Umlauts onChar={(c) => insertInto(ref.current, text, c, change)} />
        <span className={`count${t.kind === 'wort' && n >= WORT_MIN ? ' ok' : ''}`}><b>{n}</b> palabras{t.kind === 'wort' ? ` / ${WORT_MIN}` : ''}</span>
        <span className={`save s-${state}`}>{state === 'ok' ? (entry?.done ? 'Entregado ✓' : 'Guardado ✓') : state === 'saving' ? 'Guardando…' : state === 'dirty' ? 'Sin guardar' : 'Error al guardar'}</span>
        <span className="spacer" />
        <button className="btn primary lg" disabled={state === 'saving' || !text.trim()} onClick={() => save(text, true)}>{entry?.done ? 'Entregar otra vez' : 'Entregar'}</button>
      </div>
      {err && <p className="err-msg" role="alert">{err}</p>}
    </div>
  );
}

function TaskHead({ title, sub, view, offset, right }: { title: string; sub?: string; view: RoomView; offset: number; right?: React.ReactNode }) {
  return (
    <div className="task-head">
      <div className="th-main">
        <h2 className="th-title" lang="de">{title}</h2>
        {sub && <p className="th-sub">{sub}</p>}
      </div>
      {right}
      {view.timer && <Timer timer={view.timer} offset={offset} />}
    </div>
  );
}

const subWithReview = (sub?: string) => `${sub ?? ''} Las estrellas son posibles hasta que el profesor valore el texto.`;

/** Etapa «mostrar»: los textos de todos, el que se está leyendo en grande. */
function WriteShow({ view, t, teacher }: { view: RoomView; t: TaskWriteView; teacher?: boolean }) {
  const ids = view.players.map((p) => p.id).filter((id) => t.entries[id]);
  const shown = t.showing && t.entries[t.showing] ? t.showing : ids[0];
  return (
    <div className="write-show">
      {shown && (
        <article className="show-main" key={shown}>
          <div className="show-who"><b>{nameOf(view, shown)}</b><span lang="de">{t.kind === 'rolle' ? 'Mach es lustiger!' : t.kind === 'wort' ? splitTheme(t.sets[shown]?.prompt ?? '').title : t.sets[shown]?.prompt}</span><span>{t.judged[shown] === true ? 'Aceptado' : t.judged[shown] === false ? 'No aceptado' : 'Pendiente del profesor'}</span><Stars n={t.judged[shown] === true ? t.entries[shown].stars : 0} /></div>
          <Marked text={t.entries[shown].text || '(sin texto)'} words={t.sets[shown]?.words ?? []} />
          <div className="show-meta">
            <span>{t.entries[shown].words} palabras</span>
            {(t.sets[shown]?.words.length ?? 0) > 0 && <span>{t.entries[shown].used.length}/{t.sets[shown].words.length} palabras de la lista</span>}
            {t.entries[shown].features.length > 0 && <span>{t.entries[shown].features.map((f) => FEATURES.find((x) => x.id === f)?.label).join(', ')}</span>}
          </div>
        </article>
      )}
      {!teacher && ids.length > 1 && (
        <div className="show-others">
          {ids.filter((id) => id !== shown).map((id) => (
            <div key={id} className="show-mini"><b>{nameOf(view, id)}</b><Marked text={t.entries[id].text || '(sin texto)'} words={t.sets[id]?.words ?? []} /></div>
          ))}
        </div>
      )}
    </div>
  );
}

function RoleCardView({ card, goals, title }: { card: NonNullable<TaskSceneView['roles'][string]['card']>; goals?: boolean[]; title?: string }) {
  return (
    <div className="role-card">
      {title && <span className="rc-kicker">{title}</span>}
      <h3 lang="de">{card.role}</h3>
      <p className="rc-who">{card.who}</p>
      <p className="rc-sit">{card.situation}</p>
      <ol className="rc-goals">
        {card.goals.map((g, i) => <li key={g} className={goals?.[i] ? 'done' : ''}><i className="led" />{g}</li>)}
      </ol>
      <div className="rc-phr">{card.phrases.map((p) => <span key={p} lang="de">{p}</span>)}</div>
    </div>
  );
}

const SCENE_STAGE = { prep: 'Preparad la escena (1 min y medio)', play: '¡Acción! Interpretad la escena en alemán', score: 'Objetivos cumplidos' } as const;

function ScenePlay({ view, t, offset }: { view: RoomView; t: TaskSceneView; offset: number }) {
  const me = view.me!.id;
  const mine = t.roles[me];
  const others = Object.entries(t.roles).filter(([id]) => id !== me);
  return (
    <div className="scene">
      <TaskHead title={t.scene.title} sub={`${t.scene.place}. ${t.scene.setup}`} view={view} offset={offset} />
      <p className={`stage-pill st-${t.stage}`}><i className="led" />{SCENE_STAGE[t.stage]}</p>
      {mine?.card ? <RoleCardView card={mine.card} goals={t.goals[me]} title="Tu papel · objetivos secretos" /> : <p className="dim">Esperando tu papel…</p>}
      {others.map(([id, r]) => (
        r.card ? <RoleCardView key={id} card={r.card} goals={t.goals[id]} title={`Papel de ${nameOf(view, id)}`} />
          : <p key={id} className="other-role"><b>{nameOf(view, id)}</b> es <b lang="de">{r.role}</b> · sus objetivos son secretos</p>
      ))}
    </div>
  );
}

function JengaPlay({ view, t, net, offset, onAgain }: { view: RoomView; t: TaskJengaView; net: Net; offset: number; onAgain?: () => void }) {
  const me = view.me!.id;
  const myTurn = t.turn === me;
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pull = async (level: number, slot: number) => {
    if (busy) return;
    setBusy(true);
    sfx.pull();
    const r = await net.request({ t: 'pull', level, slot });
    setBusy(false);
    setErr(r.ok ? null : r.error ?? 'Error');
  };
  return (
    <div className="jenga">
      <div className="jenga-side">
        <JengaStatus view={view} t={t} me={me} />
        {t.stage === 'answer' && myTurn && t.q && (
          <div className="panel qpanel" key={t.q.id}>
            <QuestionHead q={t.q} />
            {view.timer && <Timer timer={view.timer} offset={offset} onLow={() => sfx.tick()} />}
            <Question q={t.q} mode="play" busy={busy} onSubmit={async (a) => {
              setBusy(true);
              const r = await net.request({ t: 'answer', qid: t.q!.id, a });
              setBusy(false);
              setErr(r.ok ? null : r.error ?? 'Error');
            }} />
          </div>
        )}
        {t.stage === 'answer' && myTurn && t.speak && (
          <div className="panel speak">
            <span className="label">Pregunta oral: responde en voz alta</span>
            <p className="speak-q" lang="de">{t.speak}</p>
            {view.timer && <Timer timer={view.timer} offset={offset} />}
            <p className="dim">El profesor decide si la respuesta vale.</p>
          </div>
        )}
        {t.stage === 'answer' && !myTurn && (t.q || t.speak) && (
          <div className="panel watch">
            <span className="label">Turno de {nameOf(view, t.turn)}</span>
            <p className="speak-q" lang="de">{t.speak ?? t.q?.prompt}</p>
          </div>
        )}
        {err && <p className="err-msg" role="alert">{err}</p>}
        {t.stage === 'fallen' && view.mode === 'practice' && onAgain && <button className="btn primary lg" onClick={onAgain}>Jugar otra vez</button>}
      </div>
      <Tower levels={t.levels} canPull={myTurn && t.stage === 'pull' && !busy} onPull={pull} fallen={t.stage === 'fallen'} risk={t.risk} lastPull={t.lastPull} />
    </div>
  );
}

function JengaStatus({ view, t, me }: { view: RoomView; t: TaskJengaView; me?: string }) {
  const turnName = t.turn === me ? 'Tu turno' : `Turno de ${nameOf(view, t.turn)}`;
  return (
    <div className="jenga-status">
      <div className="js-turn">
        <span className="label">Partida {t.games}</span>
        <b>{t.stage === 'fallen' ? '¡La torre se ha caído!' : turnName}</b>
        {t.stage === 'pull' && <span className="pulls">{t.turn === me ? 'Quita' : 'Tiene que quitar'} <b>{t.pulls}</b> {t.pulls === 1 ? 'pieza' : 'piezas'}{t.turn === me ? ': toca una pieza de la torre' : ''}</span>}
        {t.stage === 'fallen' && (view.mode === 'practice'
          ? <span className="pulls red">Fin de la partida. Cada pregunta, con su corrección, queda en tu historial si tienes cuenta.</span>
          : <span className="pulls red">Pierde {nameOf(view, t.loser)} · los demás ganan ★★★</span>)}
        {t.stage === 'judge' && <span className="pulls">El profesor está revisando la respuesta…</span>}
      </div>
      {t.last && t.stage !== 'answer' && (
        <div className={`js-last ${t.last.ok ? 'ok' : 'ko'}`}>
          <b>{t.last.ok ? '✓' : '✗'} {nameOf(view, t.last.pid)}</b>
          <span lang="de">{t.last.given}</span>
          {!t.last.ok && <span className="sol" lang="de">{t.last.solution}</span>}
        </div>
      )}
      <div className="risk" title="Riesgo de que la torre se tambalee y caiga en la próxima pieza">
        <span>Estabilidad</span>
        <span className="risk-bar">{Array.from({ length: 10 }, (_, i) => <i key={i} className={i < Math.round((1 - t.risk / 0.35) * 10) ? 'on' : ''} />)}</span>
      </div>
    </div>
  );
}

// ───────────── Proyector ─────────────
export function TaskStage({ view, offset }: { view: RoomView; offset: number }) {
  const t = view.task;
  if (!t) return null;
  if (t.kind === 'jenga') {
    return (
      <section className="task task-jenga stage-task">
        <div className="jenga big">
          <div className="jenga-side">
            <JengaStatus view={view} t={t} />
            {t.stage === 'answer' && t.q && (
              <div className="panel qpanel" key={t.q.id}>
                <QuestionHead q={t.q} />
                {view.timer && <Timer timer={view.timer} offset={offset} />}
                <Question q={t.q} mode="display" />
              </div>
            )}
            {(t.stage === 'answer' || t.stage === 'judge') && t.speak && (
              <div className="panel speak">
                <span className="label">Pregunta oral para {nameOf(view, t.turn)}</span>
                <p className="speak-q" lang="de">{t.speak}</p>
                {view.timer && <Timer timer={view.timer} offset={offset} />}
              </div>
            )}
            {t.judge && (
              <div className="panel judge-box">
                <span className="label">Respuesta dudosa</span>
                <p lang="de"><b>{t.judge.given}</b></p>
                <p className="dim">Esperada: <span lang="de">{t.judge.expected}</span></p>
              </div>
            )}
          </div>
          <Tower levels={t.levels} canPull={false} fallen={t.stage === 'fallen'} risk={t.risk} lastPull={t.lastPull} big />
        </div>
      </section>
    );
  }
  if (t.kind === 'szene') {
    const reveal = t.stage === 'score';
    return (
      <section className="task task-szene stage-task">
        <TaskHead title={t.scene.title} sub={`${t.scene.place}. ${t.scene.setup}`} view={view} offset={offset} />
        <p className={`stage-pill st-${t.stage}`}><i className="led" />{SCENE_STAGE[t.stage]}</p>
        <div className="roles-grid">
          {Object.entries(t.roles).map(([id, r]) => (
            reveal && r.card ? <RoleCardView key={id} card={r.card} goals={t.goals[id]} title={nameOf(view, id)} />
              : <div key={id} className="role-card closed"><span className="rc-kicker">{nameOf(view, id)}</span><h3 lang="de">{r.role}</h3><p className="rc-who">3 objetivos secretos</p></div>
          ))}
        </div>
      </section>
    );
  }
  return (
    <section className={`task task-${t.kind} stage-task`}>
      {t.stage === 'write' ? (
        <>
          <TaskHead title={t.kind === 'rolle' ? 'Mach es lustiger!' : t.kind === 'wort' ? 'Schreibwerkstatt' : 'Freies Schreiben'}
            sub="Escribid en vuestro dispositivo. La pantalla muestra el progreso; los textos se leen al final." view={view} offset={offset} />
          <div className="progress-grid">
            {view.players.map((p) => {
              const e = t.entries[p.id];
              const set = t.sets[p.id];
              if (!e) return null;
              const target = t.kind === 'wort' ? WORT_MIN : t.kind === 'frei' ? 80 : Math.max(1, set?.words.length ?? 8);
              const val = t.kind === 'rolle' ? e.used.length : e.words;
              return (
                <div key={p.id} className={`prog-card${e.done ? ' done' : ''}`}>
                  <div className="pc-top"><b>{p.name}</b><Stars n={e.stars} />{e.done && <span className="badge">Entregado</span>}</div>
                  {t.kind !== 'rolle' && <p className="pc-prompt" lang="de">{t.kind === 'frei' ? (t.choice?.[p.id] ?? -1) >= 0 ? t.prompts?.[t.choice![p.id]] : 'eligiendo consigna…' : splitTheme(set?.prompt ?? '').title}</p>}
                  {set && set.words.length > 0 && <WordChips words={set.words} used={e.used} />}
                  <div className="pc-bar"><i style={{ width: `${Math.min(100, (val / target) * 100)}%` }} /></div>
                  <span className="pc-count">{e.words} palabras{set?.words.length ? ` · ${e.used.length}/${set.words.length} de la lista` : ''}</span>
                </div>
              );
            })}
          </div>
        </>
      ) : <WriteShow view={view} t={t} teacher />}
    </section>
  );
}

/** Botones del profesor para la actividad en curso (no se proyectan si se ocultan los controles). */
export function TaskControls({ view, ctl }: { view: RoomView; ctl: (a: CtlAction) => void }) {
  const t: TaskView | null = view.task;
  if (!t) return null;
  const op = (o: Extract<CtlAction, { k: 'task' }>['op'], extra: Partial<Extract<CtlAction, { k: 'task' }>> = {}) => ctl({ k: 'task', op: o, ...extra });
  if (t.kind === 'jenga') {
    const judging = t.stage === 'judge' || (t.stage === 'answer' && !!t.speak);
    return (
      <div className="controls task-ctl">
        {judging && <button className="btn primary lg" onClick={() => { op('judge', { ok: true }); }}>✓ Respuesta válida</button>}
        {judging && <button className="btn signal lg" onClick={() => { op('judge', { ok: false }); }}>✗ No vale</button>}
        {t.stage !== 'fallen' && <button className="btn" onClick={() => op('skip')}>Pasar turno</button>}
        {t.stage === 'fallen' && <button className="btn primary lg" onClick={() => op('reset')}>Nueva torre</button>}
      </div>
    );
  }
  if (t.kind === 'szene') {
    return (
      <div className="controls task-ctl">
        {t.stage === 'prep' && <button className="btn" onClick={() => op('reroll')}>Otra escena</button>}
        {t.stage === 'score' && Object.keys(t.roles).map((id) => (
          <div key={id} className="goal-ctl ctl-group">
            <b>{nameOf(view, id)}</b>
            {[0, 1, 2].map((n) => (
              <button key={n} className={`btn sm${t.goals[id]?.[n] ? ' on-good' : ''}`} onClick={() => op('goal', { pid: id, n })} aria-pressed={!!t.goals[id]?.[n]}>
                Objetivo {n + 1} {t.goals[id]?.[n] ? '✓' : ''}
              </button>
            ))}
            <button className="btn sm" onClick={() => op('star', { pid: id, n: 1 })}>+1 ★</button>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="controls task-ctl">
      {t.stage === 'show' && view.players.map((p) => (
        <span key={p.id} className="ctl-group">
          <b>{p.name}</b>
          <button className={`btn sm${t.showing === p.id ? ' on' : ''}`} onClick={() => op('show', { pid: p.id })}>{t.showing === p.id ? 'En pantalla' : 'Mostrar su texto'}</button>
          {t.entries[p.id]?.done && <button className={`btn sm${t.judged[p.id] === true ? ' on-good' : ''}`} onClick={() => op('judgeText', { pid: p.id, ok: true })}>✓ Aceptar texto</button>}
          {t.entries[p.id]?.done && <button className={`btn sm${t.judged[p.id] === false ? ' on' : ''}`} onClick={() => op('judgeText', { pid: p.id, ok: false })}>✗ No aceptar</button>}
          <button className="btn sm" onClick={() => op('star', { pid: p.id, n: 1 })}>+1 ★</button>
          <button className="btn sm ghost" onClick={() => op('star', { pid: p.id, n: -1 })}>−1 ★</button>
        </span>
      ))}
    </div>
  );
}

/** Efectos de la torre para cualquier pantalla (caída y piezas). */
export function useJengaFx(view: RoomView | null) {
  const last = useRef<string>('');
  useEffect(() => {
    const t = view?.task;
    if (t?.kind !== 'jenga') return;
    const key = `${t.games}-${t.stage}`;
    if (key === last.current) return;
    const prev = last.current;
    last.current = key;
    if (prev && t.stage === 'fallen') {
      sfx.fall();
      shake(2.2);
      flash('red', 600);
      mark(document.querySelector('.tower-view'), 'bad', 1500);
    }
  }, [view]);
}
