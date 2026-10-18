import { useEffect, useMemo, useRef, useState } from 'react';
import { ITEMS, SOURCES } from '../../shared/rules.ts';
import { READING_GLOSSARY } from '../../shared/reading.ts';
import type { ItemId, RoomView } from '../../shared/types.ts';
import { PERFEKT_VERBS, VOCAB, deNum } from '../../shared/vocab.ts';
import { Leaderboard } from './Leaderboard.tsx';
import { ItemCard } from './Inventory.tsx';

interface Entry { de: string; es: string; src: string; extra?: string }

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');

function buildDict(): Entry[] {
  const out: Entry[] = VOCAB.map((v) => ({
    de: v.de, es: v.es, src: SOURCES[v.src].name, extra: v.pl && v.pl !== 'only' ? `pl. ${v.pl}` : v.pl === 'only' ? 'solo plural' : undefined,
  }));
  for (const [inf, aux, part, es] of PERFEKT_VERBS) {
    if (!out.some((e) => e.de === inf)) out.push({ de: inf, es, src: SOURCES.warum.name, extra: `${aux === 'sein' ? 'ist' : 'hat'} ${part}` });
    else out.find((e) => e.de === inf)!.extra = `${aux === 'sein' ? 'ist' : 'hat'} ${part}`;
  }
  for (const g of READING_GLOSSARY) out.push({ de: g.de, es: g.es, src: SOURCES.lesen.name });
  for (let n = 0; n <= 20; n++) out.push({ de: deNum(n), es: String(n), src: SOURCES.bruecke.name });
  for (const n of [30, 40, 50, 60, 70, 80, 90, 100]) out.push({ de: deNum(n), es: String(n), src: SOURCES.bruecke.name });
  return out.sort((a, b) => fold(a.de.replace(/^(der|die|das) /, '')).localeCompare(fold(b.de.replace(/^(der|die|das) /, ''))));
}

function Article({ de }: { de: string }) {
  const m = /^(der|die|das) (.*)$/.exec(de);
  if (!m) return <>{de}</>;
  return <><span className={`art-${m[1]}`}>{m[1]}</span> {m[2]}</>;
}

/** Diccionario alemán–español (tecla D). Durante una pregunta abierta está bloqueado para los alumnos. */
export function Dictionary({ onClose, locked }: { onClose: () => void; locked: boolean }) {
  const all = useMemo(buildDict, []);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const f = fold(q.trim());
  const list = f ? all.filter((e) => fold(e.de).includes(f) || fold(e.es).includes(f)) : all;
  return (
    <div className="ovl" role="dialog" aria-modal="true" aria-label="Diccionario" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="box">
        <div className="stack">
          <div className="row"><h2>Wörterbuch</h2><span className="dim">alemán ⇄ español · {all.length} entradas</span><span className="spacer" /><button className="btn sm" onClick={onClose}>Cerrar <kbd>Esc</kbd></button></div>
          {locked ? <p className="err-msg">El diccionario está bloqueado mientras la pregunta está abierta. Se abre al corregir.</p>
            : <input ref={ref} className="field" placeholder="Busca en alemán o en español…" value={q} onChange={(e) => setQ(e.target.value)} />}
        </div>
        {!locked && (
          <div className="dict-list">
            {list.slice(0, 300).map((e, i) => (
              <div key={i} className="dict-row">
                <span className="de" lang="de"><Article de={e.de} />{e.extra && <span className="dim"> · {e.extra}</span>}</span>
                <span>{e.es}</span>
                <span className="src">{e.src}</span>
              </div>
            ))}
            {!list.length && <p className="dim">No hay ninguna palabra con «{q}». Prueba con otra forma (infinitivo, singular…).</p>}
          </div>
        )}
      </div>
    </div>
  );
}

/** Marcador global (tecla P). */
export function Scoreboard({ view, onClose }: { view: RoomView; onClose: () => void }) {
  return (
    <div className="ovl" role="dialog" aria-modal="true" aria-label="Marcador" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="box">
        <div className="row"><h2>Marcador</h2><span className="spacer" /><button className="btn sm" onClick={onClose}>Cerrar <kbd>Esc</kbd></button></div>
        <div style={{ overflow: 'auto' }}><Leaderboard players={view.players} me={view.me?.id} /></div>
      </div>
    </div>
  );
}

/** Inventario lleno: el alumno elige qué descartar. */
export function PickupModal({ view, onPick }: { view: RoomView; onPick: (discard: number) => void }) {
  const me = view.me;
  if (!me || !me.pickups.length) return null;
  const item = me.pickups[0] as ItemId;
  return (
    <div className="ovl" role="dialog" aria-modal="true" aria-label="Inventario lleno">
      <div className="box">
        <div className="stack">
          <h2>Has ganado {ITEMS[item].name}</h2>
          <p className="dim" style={{ margin: 0 }}>Tu inventario está lleno (máximo 3). Toca el objeto que quieres cambiar por {ITEMS[item].name}, o renuncia a él.</p>
        </div>
        <div className="stack">
          <div className="cards" style={{ maxWidth: 520 }}>
            {me.inventory.map((it, i) => <ItemCard key={i} item={it} onClick={() => onPick(i)} />)}
          </div>
          <div className="row">
            <button className="btn" onClick={() => onPick(-1)}>Renunciar a {ITEMS[item].name}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function KeysHelp({ teacher, onClose }: { teacher: boolean; onClose: () => void }) {
  const keys: [string, string][] = [
    ['D', 'Diccionario alemán–español'], ['P', 'Marcador global'], ['L', 'Modo ligero (menos efectos)'], ['M', 'Sonido sí / no'], ['F', 'Pantalla completa'],
    ...(teacher ? [['Espacio', 'Siguiente'], ['C', 'Cerrar la pregunta'], ['S', 'Pausa / continuar'], ['+', '15 segundos más'], ['V (mantener)', 'Ver la solución'], ['H', 'Ocultar controles (proyector)']] as [string, string][]
      : [['1–4', 'Elegir opción'], ['Enter', 'Enviar respuesta']] as [string, string][]),
  ];
  return (
    <div className="ovl" role="dialog" aria-modal="true" aria-label="Atajos de teclado" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="box">
        <div className="row"><h2>Atajos</h2><span className="spacer" /><button className="btn sm" onClick={onClose}>Cerrar <kbd>Esc</kbd></button></div>
        <div className="stack">{keys.map(([k, d]) => <div key={k} className="row"><kbd>{k}</kbd><span>{d}</span></div>)}</div>
      </div>
    </div>
  );
}
