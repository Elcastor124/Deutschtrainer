// Selector de temas compartido (práctica y juegos): tarjetas compactas, «Todos» y contador.
import { TOPICS } from '../../shared/rules.ts';
import type { Topic } from '../../shared/types.ts';
import '../topicpicker.css';

const ICON: Record<Topic, string> = {
  vocab: '📚', perfekt: '⏪', nebensatz: '🔗', dativ: '🎁', akkusativ: '🎯', praesens: '🔧', trennbar: '✂️', satzbau: '🧩',
  alltag: '☕', lesen: '📖', modal: '💪', possessiv: '🏷️', praep: '📍', adjektiv: '📏', imperativ: '📣',
};

export function TopicPicker({ value, onChange, exclude = [] }: { value: Topic[]; onChange: (t: Topic[]) => void; exclude?: Topic[] }) {
  const list = (Object.keys(TOPICS) as Topic[]).filter((t) => !exclude.includes(t));
  const toggle = (t: Topic) => onChange(value.includes(t) ? value.filter((x) => x !== t) : [...value, t]);
  return (
    <fieldset className="tp">
      <legend className="tp-head">
        <span>Elige los temas</span>
        <small>{value.length ? `${value.length} elegido${value.length > 1 ? 's' : ''}` : 'Ninguno marcado = todos'}</small>
      </legend>
      <div className="tp-grid">
        <button type="button" className={`tp-tile tp-all${value.length === 0 ? ' on' : ''}`} onClick={() => onChange([])}>
          <i aria-hidden="true">✨</i><b>Todos</b><small>Mezcla de todo el banco</small>
        </button>
        {list.map((t) => (
          <button key={t} type="button" className={`tp-tile${value.includes(t) ? ' on' : ''}`} aria-pressed={value.includes(t)} onClick={() => toggle(t)}>
            <i aria-hidden="true">{ICON[t]}</i><b>{TOPICS[t].de}</b><small>{TOPICS[t].es}</small>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
