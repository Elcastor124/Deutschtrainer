import { useEffect, useRef, useState, type PointerEvent as RPE } from 'react';
import { DIFF_LABEL, SOURCES, TOPICS, TYPE_LABEL } from '../../shared/rules.ts';
import type { Answer, PublicQuestion } from '../../shared/types.ts';

export interface QProps {
  q: PublicQuestion;
  /** play = el alumno responde · view = solo lectura (proyector o ya respondida) */
  mode: 'play' | 'view';
  busy?: boolean;
  onSubmit?: (a: Answer) => void;
  /** Respuesta anterior (Second Chance) para no perder lo escrito. */
  initial?: Answer | null;
}

export function QuestionHead({ q, no, total }: { q: PublicQuestion; no?: number; total?: number }) {
  return (
    <div className="qhead">
      {no ? <span className="qnum">{String(no).padStart(2, '0')}<span className="dim">/{String(total ?? 0).padStart(2, '0')}</span></span> : null}
      <span className="chip">{TYPE_LABEL[q.type]}</span>
      <span className="chip">{TOPICS[q.topic].de}</span>
      <span className={`chip diff-${q.diff}`}>{q.bc ? '◆ ' : ''}{DIFF_LABEL[q.diff]}</span>
      <span className="chip pts">+{q.points}</span>
      {q.unlock && <span className="chip bc">Prüfungsfrage · desbloquea la BlackCard</span>}
      {q.review && <span className="chip">Repaso</span>}
      <span className="dim" title="Presentación de origen">{SOURCES[q.src].name}</span>
    </div>
  );
}

export function Question(p: QProps) {
  const { q } = p;
  return (
    <div>
      {q.swatch && <div className="swatch" style={{ background: q.swatch }} aria-label="Color" />}
      {q.type !== 'gap' && <h2 className="prompt">{q.prompt}</h2>}
      {q.type === 'gap' && <p className="dim" style={{ margin: '0 0 6px' }}>{q.prompt}</p>}
      {q.bc && q.why && <p className="why">◆ Por qué es difícil: {q.why}</p>}
      {q.type === 'mc' && <Mc {...p} />}
      {(q.type === 'write' || q.type === 'build') && <Write {...p} />}
      {q.type === 'gap' && <Gap {...p} />}
      {q.type === 'order' && <Order {...p} />}
      {q.type === 'error' && <ErrorHunt {...p} />}
      {q.type === 'match' && <Match {...p} />}
    </div>
  );
}

// ───────── Elección múltiple (teclas 1–4) ─────────
function Mc({ q, mode, busy, onSubmit }: QProps) {
  const [pick, setPick] = useState<number | null>(null);
  const play = mode === 'play' && !busy;
  useEffect(() => {
    if (!play) return;
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT') return;
      const k = Number(e.key);
      if (k >= 1 && k <= (q.options?.length ?? 0)) { setPick(k - 1); onSubmit?.({ choice: k - 1 }); }
    };
    addEventListener('keydown', on);
    return () => removeEventListener('keydown', on);
  }, [play, q.id]);
  return (
    <div className="opts">
      {q.options?.map((o, i) => (
        <button key={i} className={`opt${pick === i ? ' picked' : ''}`} disabled={!play} onClick={() => { setPick(i); onSubmit?.({ choice: i }); }}>
          <span className="k">{i + 1}</span><span>{o}</span>
        </button>
      ))}
    </div>
  );
}

// ───────── Teclado de umlauts (Chromebooks con teclado español) ─────────
function Umlauts({ onChar }: { onChar: (c: string) => void }) {
  return (
    <div className="umlauts" aria-label="Caracteres alemanes">
      {['ä', 'ö', 'ü', 'ß', 'Ä', 'Ö', 'Ü'].map((c) => (
        <button key={c} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onChar(c)}>{c}</button>
      ))}
    </div>
  );
}

function insertInto(el: HTMLInputElement | null, value: string, ch: string, set: (v: string) => void) {
  const s = el?.selectionStart ?? value.length;
  const e = el?.selectionEnd ?? value.length;
  set(value.slice(0, s) + ch + value.slice(e));
  requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(s + 1, s + 1); });
}

// ───────── Escribir / Construir ─────────
function Write({ q, mode, busy, onSubmit, initial }: QProps) {
  const [v, setV] = useState(initial?.text ?? '');
  const ref = useRef<HTMLInputElement>(null);
  const play = mode === 'play';
  useEffect(() => { if (play) ref.current?.focus(); }, [play, q.id]);
  const send = () => v.trim() && onSubmit?.({ text: v });
  return (
    <div>
      {q.parts && <div className="parts">{q.parts.map((x, i) => <span key={i}>{x}</span>)}</div>}
      {play ? (
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="stack">
          <input ref={ref} className="field big" value={v} onChange={(e) => setV(e.target.value)} disabled={busy}
            autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} lang="de" placeholder="Escribe en alemán…" aria-label="Tu respuesta" />
          <div className="row">
            <Umlauts onChar={(c) => insertInto(ref.current, v, c, setV)} />
            <span className="spacer" />
            <button className="btn primary lg" disabled={busy || !v.trim()}>Enviar <kbd>Enter</kbd></button>
          </div>
        </form>
      ) : (
        <div className="field big dim" style={{ display: 'flex', alignItems: 'center' }}>Respuesta escrita…</div>
      )}
    </div>
  );
}

// ───────── Huecos ─────────
function Gap({ q, mode, busy, onSubmit, initial }: QProps) {
  const n = q.gapCount ?? 0;
  const [vals, setVals] = useState<string[]>(() => initial?.gaps ?? Array(n).fill(''));
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const focus = useRef(0);
  const play = mode === 'play';
  useEffect(() => { if (play) refs.current[0]?.focus(); }, [play, q.id]);
  const parts = (q.text ?? '').split('___');
  const send = () => vals.every((x) => x.trim()) && onSubmit?.({ gaps: vals });
  const setAt = (i: number, x: string) => setVals((a) => a.map((y, k) => (k === i ? x : y)));
  return (
    <form onSubmit={(e) => { e.preventDefault(); send(); }}>
      <p className="gaptext" lang="de">
        {parts.map((t, i) => (
          <span key={i}>
            {t}
            {i < n && (play ? (
              <input ref={(el) => { refs.current[i] = el; }} value={vals[i]} disabled={busy} aria-label={`Hueco ${i + 1}`}
                style={{ width: `${Math.max(5, vals[i].length + 2)}ch` }} autoComplete="off" autoCapitalize="off" spellCheck={false}
                onFocus={() => { focus.current = i; }} onChange={(e) => setAt(i, e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && i < n - 1) { e.preventDefault(); refs.current[i + 1]?.focus(); } }} />
            ) : <span className="blank">&nbsp;</span>)}
          </span>
        ))}
      </p>
      {play && (
        <div className="row">
          <Umlauts onChar={(c) => { const i = focus.current; insertInto(refs.current[i], vals[i], c, (x) => setAt(i, x)); }} />
          <span className="spacer" />
          <button className="btn primary lg" disabled={busy || !vals.every((x) => x.trim())}>Enviar <kbd>Enter</kbd></button>
        </div>
      )}
    </form>
  );
}

// ───────── Ordenar: arrastrar fichas (ratón y táctil) o tocar ─────────
function Order({ q, mode, busy, onSubmit, initial }: QProps) {
  const tokens = q.tokens ?? [];
  const [placed, setPlaced] = useState<number[]>(initial?.order ?? []);
  const [drag, setDrag] = useState<{ id: number; x: number; y: number; from: 'bank' | 'line' } | null>(null);
  const [caret, setCaret] = useState<number | null>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const start = useRef<{ id: number; x: number; y: number; from: 'bank' | 'line'; moved: boolean } | null>(null);
  const play = mode === 'play' && !busy;

  const toggle = (id: number) => setPlaced((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  /** Posición de inserción en la frase (sin contar la ficha arrastrada), o null si se suelta fuera. */
  function indexAt(x: number, y: number, skip: number): number | null {
    const line = lineRef.current;
    if (!line) return null;
    const box = line.getBoundingClientRect();
    if (x < box.left - 20 || x > box.right + 20 || y < box.top - 30 || y > box.bottom + 30) return null;
    const els = [...line.querySelectorAll<HTMLElement>('[data-tok]')].filter((el) => Number(el.dataset.tok) !== skip);
    for (let i = 0; i < els.length; i++) {
      const r = els[i].getBoundingClientRect();
      if (y < r.top) return i;
      if (y <= r.bottom && x < r.left + r.width / 2) return i;
    }
    return els.length;
  }

  const down = (e: RPE<HTMLButtonElement>, id: number, from: 'bank' | 'line') => {
    if (!play) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    start.current = { id, x: e.clientX, y: e.clientY, from, moved: false };
  };
  const move = (e: RPE<HTMLButtonElement>) => {
    const s = start.current;
    if (!s) return;
    if (!s.moved && Math.hypot(e.clientX - s.x, e.clientY - s.y) < 6) return;
    s.moved = true;
    setDrag({ id: s.id, x: e.clientX, y: e.clientY, from: s.from });
    setCaret(indexAt(e.clientX, e.clientY, s.id));
  };
  const up = (e: RPE<HTMLButtonElement>) => {
    const s = start.current;
    start.current = null;
    setDrag(null);
    setCaret(null);
    if (!s) return;
    if (!s.moved) return toggle(s.id);
    const idx = indexAt(e.clientX, e.clientY, s.id);
    setPlaced((p) => {
      const without = p.filter((x) => x !== s.id);
      if (idx === null) return s.from === 'line' ? without : p;
      return [...without.slice(0, idx), s.id, ...without.slice(idx)];
    });
  };

  const line = placed;
  const rest = drag ? placed.filter((i) => i !== drag.id) : placed;
  const bank = tokens.map((_, i) => i).filter((i) => !placed.includes(i));
  const tile = (i: number, from: 'bank' | 'line') => (
    <button key={`${from}-${i}`} data-tok={from === 'line' ? i : undefined} type="button"
      className={`tile${from === 'line' ? ' placed' : ''}${drag?.id === i ? ' ghost' : ''}`} disabled={!play}
      onPointerDown={(e) => down(e, i, from)} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { start.current = null; setDrag(null); setCaret(null); }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(i); } }}>
      {tokens[i]}
    </button>
  );
  return (
    <div>
      <div ref={lineRef} className={`drop${drag ? ' hot' : ''}`} aria-label="Tu frase">
        {!line.length && !drag && <span className="hint">{mode === 'play' ? 'Arrastra aquí las fichas o tócalas en orden' : 'Las fichas se ordenan en cada pantalla'}</span>}
        {line.map((i) => (
          <span key={i} style={{ display: 'contents' }}>
            {caret !== null && i !== drag?.id && rest.indexOf(i) === caret && <i className="caret" />}
            {tile(i, 'line')}
          </span>
        ))}
        {caret !== null && caret >= rest.length && <i className="caret" />}
      </div>
      <div className="tiles" lang="de">{bank.map((i) => tile(i, 'bank'))}</div>
      {drag && <div className="tile dragging" style={{ left: drag.x - 30, top: drag.y - 24 }}>{tokens[drag.id]}</div>}
      {mode === 'play' && (
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn ghost" type="button" disabled={!play || !placed.length} onClick={() => setPlaced([])}>Vaciar</button>
          <span className="spacer" />
          <button className="btn primary lg" disabled={!play || placed.length !== tokens.length} onClick={() => onSubmit?.({ order: placed })}>Enviar</button>
        </div>
      )}
    </div>
  );
}

// ───────── Fehlerjagd: tocar la palabra errónea y corregirla ─────────
function ErrorHunt({ q, mode, busy, onSubmit, initial }: QProps) {
  const [sel, setSel] = useState<number | null>(initial?.index ?? null);
  const [fix, setFix] = useState(initial?.fix ?? '');
  const ref = useRef<HTMLInputElement>(null);
  const play = mode === 'play' && !busy;
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (sel !== null && fix.trim()) onSubmit?.({ index: sel, fix }); }}>
      <div className="errline" lang="de">
        {q.tokens?.map((t, i) => (
          <button key={i} type="button" className={`errtok${sel === i ? ' sel' : ''}`} disabled={!play}
            onClick={() => { setSel(i); requestAnimationFrame(() => ref.current?.focus()); }}>{t}</button>
        ))}
      </div>
      {mode === 'play' && (
        <div className="stack">
          <input ref={ref} className="field big" value={fix} onChange={(e) => setFix(e.target.value)} disabled={!play || sel === null}
            placeholder={sel === null ? 'Primero toca la palabra incorrecta' : `Corrige «${q.tokens?.[sel]}»…`} autoComplete="off" autoCapitalize="off" spellCheck={false} />
          <div className="row">
            <Umlauts onChar={(c) => insertInto(ref.current, fix, c, setFix)} />
            <span className="spacer" />
            <button className="btn primary lg" disabled={!play || sel === null || !fix.trim()}>Enviar</button>
          </div>
        </div>
      )}
    </form>
  );
}

// ───────── Relacionar ─────────
function Match({ q, mode, busy, onSubmit, initial }: QProps) {
  const left = q.left ?? [];
  const right = q.right ?? [];
  const [pairs, setPairs] = useState<(number | null)[]>(() => initial?.pairs ?? left.map(() => null));
  const [sel, setSel] = useState<{ side: 'l' | 'r'; i: number } | null>(null);
  const play = mode === 'play' && !busy;
  const link = (l: number, r: number) => {
    setPairs((p) => p.map((x, k) => (k === l ? r : x === r ? null : x)));
    setSel(null);
  };
  const clickL = (i: number) => (sel?.side === 'r' ? link(i, sel.i) : setSel({ side: 'l', i }));
  const clickR = (j: number) => (sel?.side === 'l' ? link(sel.i, j) : setSel({ side: 'r', i: j }));
  return (
    <div>
      <div className="match">
        <div className="col" lang="de">
          {left.map((t, i) => (
            <button key={i} type="button" disabled={!play} className={`mitem${sel?.side === 'l' && sel.i === i ? ' sel' : ''}${pairs[i] !== null ? ' linked' : ''}`} onClick={() => clickL(i)}>
              {t}{pairs[i] !== null && <span className="tag">{i + 1}</span>}
            </button>
          ))}
        </div>
        <div className="col">
          {right.map((t, j) => {
            const l = pairs.indexOf(j);
            return (
              <button key={j} type="button" disabled={!play} className={`mitem${sel?.side === 'r' && sel.i === j ? ' sel' : ''}${l >= 0 ? ' linked' : ''}`} onClick={() => clickR(j)}>
                {t}{l >= 0 && <span className="tag">{l + 1}</span>}
              </button>
            );
          })}
        </div>
      </div>
      {mode === 'play' && (
        <div className="row" style={{ marginTop: 14 }}>
          <span className="dim">Toca una palabra y después su pareja.</span>
          <span className="spacer" />
          <button className="btn primary lg" disabled={!play || pairs.some((x) => x === null)} onClick={() => onSubmit?.({ pairs: pairs as number[] })}>Enviar</button>
        </div>
      )}
    </div>
  );
}
