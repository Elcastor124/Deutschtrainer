// /mision — Tägliche Mission · 5 Minuten Deutsch. Una pregunta por pantalla; si fallas, Klaus ayuda con pistas
// progresivas (pista → regla → solución). El servidor corrige, guarda y decide qué repasar mañana.
import { useEffect, useState } from 'react';
import { playRequest } from '../play-client.ts';
import { navigate, prefersReducedMotion, store } from '../util.ts';
import { sfx } from '../fx/sound.ts';
import { KlausFigure } from '../klaus/KlausFigure.tsx';
import { useKlausSkin } from '../klaus/skin-client.ts';
import '../mission.css';

export interface MissionItemView { qid: string; slot: 'repaso' | 'error' | 'nivel' | 'vocab'; reason: string; topic: string; topicName: string; prompt: string; options: string[]; tries: number[]; hints: number; final: boolean; ok: boolean; assisted: boolean; solution?: number; explain?: string }
export interface MissionView { id: string; day: string; level: string; guest: boolean; completedAt: number | null; items: MissionItemView[]; topics: string[]; weekDays: boolean[]; summary?: { independent: number; assisted: number; wrong: number; total: number; reinforced: string[]; recover: string[]; next: string } }
interface Hint { level: 1 | 2 | 3; text: string; example?: string; solution?: string }
const SLOT: Record<MissionItemView['slot'], string> = { repaso: 'Repaso', error: 'Error a recuperar', nivel: 'Consolidar', vocab: 'Vocabulario' };
const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const TUTOR_KEY = 'dt:klaus-tutor';
export const getMission = () => playRequest<MissionView>('/api/mission');

export function WeekDots({ days }: { days: boolean[] }) {
  return <div className="ms-week" aria-label={`Has practicado ${days.filter(Boolean).length} día(s) esta semana`}>{days.map((on, i) => <span key={i} className={on ? 'on' : ''} aria-hidden="true">{DAYS[i]}</span>)}</div>;
}

export function Mission() {
  const [m, setM] = useState<MissionView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [phase, setPhase] = useState<'start' | 'play' | 'end'>('start');
  const [i, setI] = useState(0);
  const [hint, setHint] = useState<Hint | null>(null);
  const [klausMsg, setKlausMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState(() => store.get(TUTOR_KEY) !== 'off');
  const look = useKlausSkin();
  useEffect(() => { getMission().then((x) => { setM(x); if (x.completedAt) setPhase('end'); }).catch((e: Error) => setErr(e.message)); }, []);
  if (err) return <main className="dt-page ms-page"><p className="err-msg" role="alert">{err}</p></main>;
  if (!m) return <main className="dt-page ms-page"><p role="status">Klaus está preparando tu misión…</p></main>;

  const item = m.items[i];
  const answered = m.items.filter((x) => x.final).length;
  const patch = (it: MissionItemView) => setM((cur) => cur && { ...cur, items: cur.items.map((x) => (x.qid === it.qid ? it : x)) });
  const start = () => { const first = m.items.findIndex((x) => !x.final); setI(first < 0 ? 0 : first); setPhase('play'); setHint(null); setKlausMsg(null); };

  const choose = async (choice: number) => {
    if (busy || item.final || item.tries.includes(choice)) return;
    setBusy(true);
    try {
      const r = await playRequest<{ correct: boolean; final: boolean; klaus?: string; item: MissionItemView }>('/api/mission/answer', { id: m.id, qid: item.qid, choice });
      patch(r.item);
      if (r.correct) { sfx.good(); setKlausMsg(r.item.assisted ? 'Genau! Lo has sacado con ayuda: mañana te lo vuelvo a proponer para que quede fijo.' : 'Sehr gut! 👌'); setHint(null); }
      else {
        sfx.bad(); setKlausMsg(r.klaus ?? null);
        if (r.final) setHint(null);
        else if (auto && r.item.hints < 1) await askHint(1, r.item);
      }
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const askHint = async (level: 1 | 2 | 3, it = item) => {
    try { const r = await playRequest<{ hint: Hint; item: MissionItemView }>('/api/mission/hint', { id: m.id, qid: it.qid, level }); setHint(r.hint); patch(r.item); }
    catch (e) { setKlausMsg((e as Error).message); }
  };
  const next = async () => {
    setHint(null); setKlausMsg(null);
    const rest = m.items.findIndex((x, k) => k > i && !x.final);
    const any = rest >= 0 ? rest : m.items.findIndex((x) => !x.final);
    if (any >= 0) { setI(any); return; }
    try { const done = await playRequest<MissionView>('/api/mission/complete', { id: m.id }); setM(done); setPhase('end'); if (!prefersReducedMotion()) sfx.star(); } catch (e) { setErr((e as Error).message); }
  };
  const toggleAuto = () => { const v = !auto; setAuto(v); store.set(TUTOR_KEY, v ? 'on' : 'off'); };

  if (phase === 'start') return (
    <main className="dt-page ms-page">
      <section className="ms-start">
        <div className="ms-klaus-big" aria-hidden="true"><KlausFigure reaction="waving" look={look} /></div>
        <div className="ms-start-body">
          <p className="dt-eyebrow">Tägliche Mission · 5 Minuten Deutsch</p>
          <h1>{greeting()}<b className="dt-punkt">.</b></h1>
          <p className="ms-lead">Hoy toca: <b>{m.items.length} ejercicios</b> · unos 5 minutos · nivel {m.level}. Si te equivocas, te echo una mano.</p>
          <ul className="ms-topics">{m.topics.map((t) => <li key={t}>{t}</li>)}</ul>
          <ol className="ms-plan">{m.items.map((x) => <li key={x.qid} className={x.final ? 'done' : ''}><b>{SLOT[x.slot]}</b><span>{x.reason}</span></li>)}</ol>
          <div className="ms-row"><button type="button" className="dt-btn dt-btn-primary" onClick={start}><span className="dt-btn-label">{answered ? `Continuar misión (${answered}/${m.items.length})` : 'Comenzar misión'} →</span></button><WeekDots days={m.weekDays} /></div>
          {m.guest && <p className="ms-note">Estás como invitado: puedes hacer la misión, pero el progreso no se guarda ni se adapta. <a href="/entrar?volver=/mision" onClick={(e) => { e.preventDefault(); navigate('/entrar?volver=/mision'); }}>Inicia sesión</a> para que Klaus recuerde tus errores.</p>}
        </div>
      </section>
    </main>
  );

  if (phase === 'end' && m.summary) {
    const s = m.summary;
    return (
      <main className="dt-page ms-page">
        <section className="ms-end">
          <svg className="ms-check" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="28" /><path d="M20 33l8 8 16-17" /></svg>
          <p className="dt-eyebrow">Mission erfüllt</p>
          <h1>Misión completada<b className="dt-punkt">.</b></h1>
          <ul className="ms-score"><li><b>{s.independent}</b><span>bien a la primera</span></li><li><b>{s.assisted}</b><span>con ayuda de Klaus</span></li><li><b>{s.wrong}</b><span>a recuperar</span></li></ul>
          {s.reinforced.length > 0 && <p><span className="ms-k">Has reforzado</span> {s.reinforced.join(' · ')}</p>}
          {s.recover.length > 0 && <p><span className="ms-k">Para recuperar</span> {s.recover.join(' · ')}</p>}
          <p className="ms-next">{s.next}</p>
          <WeekDots days={m.weekDays} />
          {m.guest && <p className="ms-note">Como invitado, este resultado no se ha guardado.</p>}
          <div className="ms-row">
            <a className="dt-btn dt-btn-primary" href={m.guest ? '/practica' : '/mi#misiones'} onClick={(e) => { e.preventDefault(); navigate(m.guest ? '/practica' : '/mi#misiones'); }}><span className="dt-btn-label">{m.guest ? 'Seguir practicando' : 'Ver mi progreso'} →</span></a>
            <a className="dt-link" href="/practica" onClick={(e) => { e.preventDefault(); navigate('/practica'); }}>Practicar más</a>
          </div>
        </section>
      </main>
    );
  }

  const wrongTried = item.tries.filter((t) => t !== item.solution);
  return (
    <main className="dt-page ms-page">
      <header className="ms-top">
        <a className="ms-exit" href="/mision" onClick={(e) => { e.preventDefault(); setPhase('start'); }}>← Misión</a>
        <div className="ms-progress" role="progressbar" aria-valuemin={0} aria-valuemax={m.items.length} aria-valuenow={answered} aria-label="Progreso de la misión">
          {m.items.map((x, k) => <span key={x.qid} className={`${x.final ? (x.ok && !x.assisted ? 'ok' : x.ok ? 'help' : 'ko') : ''}${k === i ? ' cur' : ''}`} />)}
        </div>
        <span className="ms-count">{i + 1}/{m.items.length}</span>
      </header>
      <div className="ms-layout">
        <section className="ms-card" aria-live="polite">
          <p className="ms-slot"><b>{SLOT[item.slot]}</b> · {item.topicName}</p>
          <h2 className="ms-prompt" lang="de">{item.prompt}</h2>
          <div className="ms-opts" role="group" aria-label="Opciones">
            {item.options.map((o, k) => {
              const isSol = item.final && item.solution === k, tried = item.tries.includes(k);
              return <button key={k} type="button" lang="de" disabled={busy || item.final || tried} className={`${isSol ? 'sol' : ''}${tried && !isSol ? ' ko' : ''}`} onClick={() => choose(k)}>{o}</button>;
            })}
          </div>
          {item.final && <div className={`ms-feedback ${item.ok ? 'ok' : 'ko'}`} role="status">
            <b>{item.ok ? (item.assisted ? '✓ Richtig (con ayuda)' : '✓ Richtig!') : `La respuesta era: ${item.options[item.solution ?? 0]}`}</b>
            {item.explain && <p>{item.explain}</p>}
          </div>}
          <div className="ms-row">
            {item.final ? <button type="button" className="dt-btn dt-btn-primary" onClick={() => void next()}><span className="dt-btn-label">{answered === m.items.length ? 'Terminar misión' : 'Siguiente'} →</span></button>
              : wrongTried.length > 0 && <span className="ms-note">Inténtalo otra vez: quedan {3 - item.tries.length} intento(s).</span>}
          </div>
        </section>

        <aside className={`ms-klaus${klausMsg || hint ? ' open' : ''}`} aria-label="Klaus, tu tutor">
          <div className="ms-klaus-fig" aria-hidden="true"><KlausFigure reaction={item.final && item.ok ? 'correct' : wrongTried.length ? 'thinking' : 'idle'} look={look} reducedMotion={prefersReducedMotion()} /></div>
          <div className="ms-bubble">
            <p className="ms-k">Klaus</p>
            {klausMsg && <p>{klausMsg}</p>}
            {hint && <div className={`ms-hint l${hint.level}`}><small>{hint.level === 1 ? 'Pista' : hint.level === 2 ? 'La regla' : 'Solución razonada'}</small><p>{hint.text}</p>{hint.example && <p className="ms-ex" lang="de">Ejemplo: {hint.example}</p>}{hint.solution && <p className="ms-ex" lang="de">✓ {hint.solution}</p>}</div>}
            {!klausMsg && !hint && <p>{item.final ? 'Cuando quieras, seguimos.' : 'Tómate tu tiempo. Si necesitas una pista, aquí estoy.'}</p>}
            {!item.final && <div className="ms-hint-actions">
              {item.hints < 1 && <button type="button" className="dt-btn dt-btn-ghost sm" onClick={() => void askHint(1)}><span className="dt-btn-label">Una pista</span></button>}
              {item.hints === 1 && <button type="button" className="dt-btn dt-btn-ghost sm" onClick={() => void askHint(2)}><span className="dt-btn-label">Otra pista</span></button>}
              {(item.hints >= 2 || item.tries.length > 0) && <button type="button" className="dt-btn dt-btn-ghost sm" onClick={() => void askHint(3)}><span className="dt-btn-label">Ver la solución</span></button>}
            </div>}
            <label className="ms-auto"><input type="checkbox" checked={auto} onChange={toggleAuto} /> Pista automática al fallar</label>
          </div>
        </aside>
      </div>
    </main>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Guten Morgen' : h < 19 ? 'Hallo! Hoy toca misión' : 'Guten Abend';
}
