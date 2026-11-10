// Selector de temas compartido (práctica y juegos).
// Categorías a la izquierda (pestañas con indicador que se desliza), temas de la categoría a la derecha como lista,
// y debajo un resumen de lo elegido. Ninguno marcado = todos. La selección múltiple cruza categorías.
import { useState, type CSSProperties, type KeyboardEvent } from 'react';
import { TOPICS } from '../../shared/rules.ts';
import type { Topic } from '../../shared/types.ts';
import { TOPIC_GROUPS } from './topic-groups.ts';
import '../topicpicker.css';

export function TopicPicker({ value, onChange, exclude = [], counts, step }: {
  value: Topic[]; onChange: (t: Topic[]) => void; exclude?: Topic[];
  /** Preguntas reales por tema (catálogo del servidor). Sin dato no se muestra número. */
  counts?: Partial<Record<Topic, number>>;
  /** Índice editorial («02») cuando el selector es un paso de un formulario. */
  step?: string;
}) {
  const groups = TOPIC_GROUPS.map((g) => ({ ...g, topics: g.topics.filter((t) => !exclude.includes(t)) })).filter((g) => g.topics.length);
  const [active, setActive] = useState(() => (groups.find((g) => g.topics.some((t) => value.includes(t))) ?? groups[0]).id);
  const ai = Math.max(0, groups.findIndex((g) => g.id === active));
  const toggle = (t: Topic) => onChange(value.includes(t) ? value.filter((x) => x !== t) : [...value, t]);
  const onTabs = (e: KeyboardEvent<HTMLDivElement>) => {
    const dir = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const j = (ai + dir + groups.length) % groups.length;
    setActive(groups[j].id);
    e.currentTarget.querySelectorAll<HTMLButtonElement>('[role=tab]')[j]?.focus();
  };
  return (
    <fieldset className="tp">
      <legend className="tp-head">
        <span className="m-label">{step && <i>{step}</i>}Temas</span>
        <small aria-live="polite">{value.length ? `${value.length} elegido${value.length > 1 ? 's' : ''}` : 'Ninguno marcado = todos'}</small>
      </legend>
      <div className="tp-body">
        <div className="tp-rail" role="tablist" aria-label="Categorías de temas" aria-orientation="vertical" onKeyDown={onTabs}
          style={{ '--tp-i': ai, '--tp-n': groups.length } as CSSProperties}>
          <i className="tp-rail-ind" aria-hidden="true" />
          {groups.map((g) => {
            const n = g.topics.filter((t) => value.includes(t)).length;
            return (
              <button key={g.id} type="button" role="tab" id={`tp-tab-${g.id}`} aria-controls={`tp-panel-${g.id}`} aria-selected={g.id === active}
                tabIndex={g.id === active ? 0 : -1} className={`tp-cat${n ? ' has' : ''}`} onClick={() => setActive(g.id)}>
                <b lang="de">{g.de}</b><small>{g.es}</small>
                <em className="tp-cat-n" aria-label={n ? `${n} de ${g.topics.length} elegidos` : `${g.topics.length} temas`}>{n ? `${n}/${g.topics.length}` : g.topics.length}</em>
              </button>
            );
          })}
        </div>
        {groups.map((g) => {
          const allOn = g.topics.every((t) => value.includes(t));
          return (
            <div key={g.id} className="tp-panel" role="tabpanel" id={`tp-panel-${g.id}`} aria-labelledby={`tp-tab-${g.id}`} hidden={g.id !== active}>
              <ul className="tp-list">
                {g.topics.map((t, i) => (
                  <li key={t} data-m={g.id === active ? 'rise' : undefined} style={{ '--m-i': i } as CSSProperties}>
                    <button type="button" className={`tp-tile${value.includes(t) ? ' on' : ''}`} aria-pressed={value.includes(t)} onClick={() => toggle(t)}>
                      <i className="tp-check" aria-hidden="true" />
                      <span className="tp-txt"><b lang="de">{TOPICS[t].de}</b><small>{TOPICS[t].es}</small></span>
                      {counts && <em className={`tp-n${counts[t] === 0 ? ' zero' : ''}`}>{counts[t] ?? '—'}<span className="sr"> preguntas</span></em>}
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" className="tp-link" onClick={() => onChange(allOn ? value.filter((t) => !g.topics.includes(t)) : [...new Set([...value, ...g.topics])])}>
                {allOn ? `Quitar todo ${g.de}` : `Marcar todo ${g.de}`}
              </button>
            </div>
          );
        })}
      </div>
      <div className="tp-sum">
        {value.length === 0
          ? <span className="tp-sum-all"><i aria-hidden="true" />Todos los temas del banco</span>
          : <>
            <ul className="tp-chips">{value.map((t) => (
              <li key={t} data-m="pop"><button type="button" className="tp-chip" onClick={() => toggle(t)} aria-label={`Quitar ${TOPICS[t].de}`}><span lang="de">{TOPICS[t].de}</span><span aria-hidden="true">×</span></button></li>
            ))}</ul>
            <button type="button" className="tp-link" onClick={() => onChange([])}>Quitar todos</button>
          </>}
      </div>
    </fieldset>
  );
}
