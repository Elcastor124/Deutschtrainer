// Convierte los eventos que confirma el servidor (registro «log» y resultados) en animaciones.
// Solo anima lo que el servidor ya ha validado: no hay efectos «optimistas».
import { useEffect, useRef, useState } from 'react';
import { ITEMS } from '../../shared/rules.ts';
import type { Fx, ItemId, RoomView } from '../../shared/types.ts';
import { Glyph } from '../components/Glyph.tsx';
import { burst, burstAt } from './particles.ts';
import { sfx } from './sound.ts';

interface Toast { id: number; text: string; tone: '' | 'alarm' | 'good' }
interface ItemShow { key: number; item: ItemId; caption: string; attack: boolean }
interface BcShow { key: number; mode: 'activate' | 'burn'; result?: 'win' | 'lose'; caption: string; sub: string }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function FxLayer({ view, me, lite }: { view: RoomView | null; me?: string; lite: boolean }) {
  const seen = useRef<number | null>(null);
  const lastReveal = useRef<string | null>(null);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [item, setItem] = useState<ItemShow | null>(null);
  const [bc, setBc] = useState<BcShow | null>(null);
  const bcDone = useRef<(() => void) | null>(null);
  const [floats, setFloats] = useState<{ id: number; text: string; x: number; y: number; neg: boolean }[]>([]);

  const pushToast = (text: string, tone: Toast['tone'] = '') => {
    const id = Math.random();
    setToasts((t) => [...t.slice(-3), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  };
  const enqueue = (fn: () => Promise<void>, maxWait = 3500) => {
    const queued = Date.now();
    chain.current = chain.current.then(() => (Date.now() - queued > maxWait ? undefined : fn())).catch(() => undefined);
  };
  const float = (el: Element | null, text: string, neg = false) => {
    const r = el?.getBoundingClientRect();
    const id = Math.random();
    setFloats((f) => [...f, { id, text, neg, x: r ? r.left + r.width / 2 - 30 : innerWidth / 2, y: r ? r.top : innerHeight / 2 }]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1300);
  };
  const shake = () => {
    document.body.classList.remove('screen-shake');
    void document.body.offsetWidth;
    document.body.classList.add('screen-shake');
    setTimeout(() => document.body.classList.remove('screen-shake'), 500);
  };

  useEffect(() => {
    if (!view) return;
    const name = (id?: string) => view.players.find((p) => p.id === id)?.name ?? '¿?';
    const maxId = view.log.length ? view.log[view.log.length - 1].id : 0;
    if (seen.current === null) {
      // Primera instantánea (o reconexión): no se reproducen efectos antiguos.
      seen.current = maxId;
      lastReveal.current = view.reveal?.qid ?? null;
      return;
    }
    const fresh = view.log.filter((f) => f.id > (seen.current as number));
    seen.current = Math.max(seen.current, maxId);

    for (const f of fresh) handle(f);

    function handle(f: Fx) {
      const mine = f.by === me, targetMe = f.target === me;
      const teacherView = !me;
      // Un alumno solo ve avisos que le afectan o avisos generales del profesor (pausa, objetos…).
      const relevant = teacherView ? f.kind !== 'join' : mine || targetMe || f.kind === 'unlock' || (f.kind === 'info' && !f.by);
      const toast = (text: string, tone: Toast['tone'] = '') => { if (relevant) pushToast(text, tone); };
      switch (f.kind) {
        case 'item': {
          if (!f.item) return toast(f.text);
          if (f.item === 'blackcard') {
            sfx.bc();
            enqueue(() => new Promise<void>((res) => {
              bcDone.current = res;
              setBc({ key: f.id, mode: 'activate', caption: 'BLACKCARD', sub: `${name(f.by)} arriesga: +10 o −10` });
            }), 8000);
            return;
          }
          const attack = ITEMS[f.item].kind === 'attack';
          if (targetMe) { sfx.alarm(); shake(); pushToast(`⚠ ${name(f.by)} te ataca con ${ITEMS[f.item].name}. Un SHIELD lo bloquea.`, 'alarm'); }
          else sfx.item();
          const caption = attack ? `${name(f.by)} → ${ITEMS[f.item].name} → ${name(f.target)}` : `${name(f.by)} activa ${ITEMS[f.item].name}`;
          enqueue(async () => { setItem({ key: f.id, item: f.item as ItemId, caption, attack }); await sleep(1750); setItem(null); });
          return;
        }
        case 'steal':
          toast(f.text, targetMe ? 'alarm' : mine ? 'good' : '');
          if (targetMe) { shake(); float(document.getElementById('my-score'), `−${f.amount}`, true); }
          if (mine) { burstAt(document.getElementById('my-score'), 'spark', 40); float(document.getElementById('my-score'), `+${f.amount}`); }
          return;
        case 'block': sfx.good(); return toast(f.text, 'good');
        case 'sabotaged': if (targetMe) shake(); return toast(f.text, targetMe ? 'alarm' : '');
        case 'fizzle': return toast(f.text);
        case 'bc-win':
        case 'bc-lose': {
          const win = f.kind === 'bc-win';
          enqueue(() => new Promise<void>((res) => {
            bcDone.current = res;
            sfx.burn();
            setBc({ key: f.id, mode: 'burn', result: win ? 'win' : 'lose', caption: win ? '+10' : '−10', sub: `${name(f.by)} ${win ? 'gana' : 'pierde'} la BlackCard` });
          }), 10000);
          return;
        }
        case 'unlock':
          if (mine) { sfx.good(); burst(innerWidth / 2, innerHeight / 2, 'ember', 80); }
          return toast(`◆ ${f.text}`, 'good');
        case 'reward': return toast(f.text, mine ? 'good' : '');
        case 'manual': return toast(f.text);
        case 'join': return toast(f.text);
        default: return toast(f.text);
      }
    }

    // Puntos de la corrección
    const rv = view.reveal;
    if (rv && rv.qid !== lastReveal.current) {
      lastReveal.current = rv.qid;
      if (me && rv.results[me]) {
        const r = rv.results[me];
        const el = document.getElementById('my-score');
        if (r.status === 'correct') { sfx.good(); burstAt(el, 'spark', 50); } else if (r.status !== 'none') sfx.bad();
        if (r.delta) float(el, r.delta > 0 ? `+${r.delta}` : `${r.delta}`, r.delta < 0);
      } else if (!me && !rv.skipped) {
        const any = Object.values(rv.results).some((x) => x.status === 'correct');
        if (any) { sfx.good(); burstAt(document.getElementById('lb'), 'spark', 60); } else sfx.bad();
      }
    } else if (!rv) lastReveal.current = null;
  }, [view, me]);

  return (
    <>
      <div className="toasts" aria-live="polite">{toasts.map((t) => <div key={t.id} className={`toast ${t.tone}`}>{t.text}</div>)}</div>
      {floats.map((f) => <div key={f.id} className={`float-pts${f.neg ? ' neg' : ''}`} style={{ left: f.x, top: f.y }}>{f.text}</div>)}
      {item && (
        <div key={item.key} className={`itemfx${item.attack ? ' attack' : ''}`} aria-hidden="true">
          <div className="fxcard">
            <span className="name">{ITEMS[item.item].name}</span>
            <Glyph item={item.item} color={item.attack ? '#FF3832' : '#F2F1EE'} />
            <span className="dim">{ITEMS[item.item].tag}</span>
          </div>
          <div className="cap">{item.caption}</div>
        </div>
      )}
      {bc && <BcStage key={bc.key} show={bc} lite={lite} onDone={() => { setBc(null); bcDone.current?.(); bcDone.current = null; }} />}
    </>
  );
}

function BcStage({ show, lite, onDone }: { show: BcShow; lite: boolean; onDone: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [out, setOut] = useState(false);
  const [fallback, setFallback] = useState(lite);
  useEffect(() => {
    let alive = true;
    (async () => {
      let ok = false;
      if (!lite && host.current) {
        try {
          const m = await import('./blackcard3d.ts');
          await m.playBlackCard(host.current, { mode: show.mode, result: show.result, lite });
          ok = true;
        } catch (e) {
          console.warn('[blackcard] WebGL no disponible, se usa la versión ligera', e);
        }
      }
      if (!ok && alive) {
        setFallback(true);
        if (show.mode === 'burn') { await sleep(500); burst(innerWidth / 2, innerHeight * 0.45, 'ember', 120); await sleep(2300); }
        else { burst(innerWidth / 2, innerHeight * 0.45, 'ember', 60); await sleep(2000); }
      }
      if (!alive) return;
      setOut(true);
      await sleep(450);
      if (alive) onDone();
    })();
    return () => { alive = false; };
  }, []);
  return (
    <div ref={host} className={`bcfx${out ? ' out' : ''}`} aria-live="assertive">
      {fallback && (
        <div className={`bc-lite${show.mode === 'burn' ? ' burn' : ''}`}>
          {show.mode === 'burn'
            ? <span className="dot" style={{ fontSize: '4.5rem', color: show.result === 'win' ? '#F2F1EE' : '#FF3832' }}>{show.caption}</span>
            : <Glyph item="blackcard" color="#FF3832" className="glyph" />}
        </div>
      )}
      <div className="cap">{show.mode === 'activate' ? 'BLACKCARD' : show.caption}<small>{show.sub}</small></div>
    </div>
  );
}
