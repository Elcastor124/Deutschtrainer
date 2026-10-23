import { useState } from 'react';
import { FEATURES, FREE_PROMPTS, ROLLE_POOL, ROLLE_PROMPT, SCENES, WORD_THEMES, WORT_MIN, countWords, features, usedWords, type LearnedWord } from '../../shared/activities.ts';
import { READINGS } from '../../shared/reading.ts';
import { followLearningLink } from '../components/LearningNav.tsx';
import { Reading } from '../components/Reading.tsx';
import { store } from '../util.ts';

type Mode = 'rolle' | 'wort' | 'frei' | 'szene';
const MODES: { id: Mode; label: string }[] = [
  { id: 'rolle', label: 'Reescritura' }, { id: 'wort', label: 'Palabras dadas' },
  { id: 'frei', label: 'Escritura libre' }, { id: 'szene', label: 'Ensayo de escenas' },
];
const REVIEW = ['He revisado el orden del verbo.', 'He comprobado artículos y terminaciones.', 'He leído mi texto en voz alta.'];

export function Workshop() {
  const [mode, setMode] = useState<Mode>('rolle');
  const [choice, setChoice] = useState(0);
  const [role, setRole] = useState(0);
  const options = mode === 'rolle' ? READINGS.map((r) => r.title) : mode === 'wort' ? WORD_THEMES.map((theme) => theme.title) : mode === 'frei' ? FREE_PROMPTS : SCENES.map((scene) => scene.title);
  const scene = SCENES[choice];
  const card = mode === 'szene' ? scene.roles[role] : null;
  const words = mode === 'rolle' ? Array.from({ length: 8 }, (_, i) => ROLLE_POOL[(choice * 4 + i) % ROLLE_POOL.length]) : mode === 'wort' ? WORD_THEMES[choice].words : [];
  const prompt = mode === 'rolle' ? ROLLE_PROMPT : mode === 'wort' ? `Escribe una historia de al menos ${WORT_MIN} palabras usando las palabras dadas.` : mode === 'frei' ? FREE_PROMPTS[choice] : card!.situation;
  return (
    <main className="home learning-home">
      <header className="stack">
        <a className="learning-back" href="/tema/1" onClick={followLearningLink}>← Tema 1</a>
        <h1 className="home-title learning-title">Taller personal<b>// Tema 1</b></h1>
        <p className="home-sub">Escritura y ensayo con las consignas originales de clase. Guarda un borrador por actividad en este navegador, sin enviarlo al profesor.</p>
        <p className="home-sub small">Es un espacio de autoevaluación: los indicadores de palabras y estructuras son orientativos, no una corrección automática ni una nota.</p>
      </header>
      <div className="chips" role="group" aria-label="Tipo de taller">{MODES.map((item) => <button type="button" className={`btn${mode === item.id ? ' on' : ''}`} aria-pressed={mode === item.id} key={item.id} onClick={() => { setMode(item.id); setChoice(0); setRole(0); }}>{item.label}</button>)}</div>
      <section className="panel stack learning-section">
        <label className="stack">{mode === 'rolle' ? 'Lectura para reescribir' : mode === 'szene' ? 'Escena' : 'Consigna'}
          <select className="field" value={choice} onChange={(event) => { setChoice(Number(event.target.value)); setRole(0); }}>{options.map((title, i) => <option value={i} key={title}>{title}</option>)}</select>
        </label>
        {mode === 'rolle' && <details open><summary>Lectura original</summary><Reading key={choice} id={READINGS[choice].id} /></details>}
        {mode === 'szene' && <>
          <p>{scene.setup}</p><p className="dim">{scene.place}</p>
          <label className="stack">Tu papel<select className="field" value={role} onChange={(event) => setRole(Number(event.target.value))}>{scene.roles.map((item, i) => <option key={item.role} value={i}>{item.role}</option>)}</select></label>
          <p>{card!.who}</p><p className="dim">Ensaya ambas voces, escribe tu diálogo y marca los objetivos cuando los hayas practicado. No es una conversación con un compañero conectado.</p>
          <div className="chips">{card!.phrases.map((phrase) => <span className="badge" key={phrase} lang="de">{phrase}</span>)}</div>
        </>}
        <WorkshopEditor key={`${mode}:${choice}:${role}`} draftKey={`bc:workshop:1:${mode}:${choice}:${role}`} prompt={prompt} words={words} review={card ? card.goals : REVIEW} free={mode === 'frei'} />
      </section>
      <aside className="panel stack learning-section">
        <h2>¿Y Wort-Jenga?</h2><p>La torre y la evaluación oral siguen siendo una actividad multijugador en clase, con profesor. Aquí puedes ensayar escritura y escenas, pero no se simula una partida de Jenga individual.</p>
        <div className="row"><a className="btn" href="/jugar" onClick={followLearningLink}>Ir al juego en clase</a><a className="btn" href="/practica?tema=1" onClick={followLearningLink}>Practicar preguntas</a></div>
      </aside>
    </main>
  );
}

function WorkshopEditor({ draftKey, prompt, words, review, free }: { draftKey: string; prompt: string; words: LearnedWord[]; review: string[]; free: boolean }) {
  const [saved] = useState(() => {
    try { const value: unknown = JSON.parse(store.get(draftKey) ?? 'null');
      if (value && typeof value === 'object' && 'text' in value && typeof value.text === 'string' && 'checked' in value && Array.isArray(value.checked)) return { text: value.text, checked: value.checked.filter((v): v is string => typeof v === 'string') };
    } catch { /* Un borrador antiguo o corrupto no bloquea el taller. */ }
    return { text: '', checked: [] as string[] };
  });
  const [text, setText] = useState(saved.text);
  const [checked, setChecked] = useState(saved.checked);
  const [status, setStatus] = useState('Los borradores se guardan al escribir.');
  const update = (value: string, checks: string[]) => {
    setText(value); setChecked(checks);
    try { localStorage.setItem(draftKey, JSON.stringify({ text: value, checked: checks })); setStatus('Borrador guardado en este navegador.'); }
    catch { setStatus('No se ha podido guardar. Copia tu texto antes de salir de esta página.'); }
  };
  const used = usedWords(text, words);
  const found = features(text);
  return <div className="stack">
    <p>{prompt}</p>
    {words.length > 0 && <div className="wchips">{words.map((word) => <span className={`wchip${used.includes(word.de) ? ' on' : ''}`} key={word.de}><b lang="de">{word.de}</b><small>{word.es} · {used.includes(word.de) ? 'detectada' : 'pendiente'}</small></span>)}</div>}
    <label className="stack" htmlFor="workshop-text">Tu borrador en alemán<textarea id="workshop-text" className="field paper" lang="de" value={text} maxLength={20000} onChange={(event) => update(event.target.value, checked)} /></label>
    <div className="row"><span>{countWords(text)} palabras{free ? ' · metas orientativas: 30 / 50 / 80' : ''}</span>{words.length > 0 && <span>{used.length}/{words.length} palabras de la lista detectadas</span>}</div>
    <p className="small dim" role="status">{status}</p>
    {free && <div className="chips">{FEATURES.map((feature) => <span className="badge" key={feature.id}>{feature.label}: {found.includes(feature.id) ? 'indicio detectado' : feature.hint}</span>)}</div>}
    <fieldset className="stack learning-review"><legend>Autoevaluación · marca lo que has revisado</legend>{review.map((item) => <label className="row" key={item}><input type="checkbox" checked={checked.includes(item)} onChange={() => update(text, checked.includes(item) ? checked.filter((check) => check !== item) : [...checked, item])} />{item}</label>)}</fieldset>
  </div>;
}
