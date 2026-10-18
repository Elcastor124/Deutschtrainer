// Convierte los eventos que confirma el servidor (registro «log» y resultados) en animaciones.
// Solo anima lo que el servidor ya ha validado: no hay efectos «optimistas».
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { CHESTS, ITEMS } from '../../shared/rules.ts';
import type { ChestTier, Fx, ItemId, RoomView } from '../../shared/types.ts';
import { CHEST_ROWS, DotGlyph, Glyph } from '../components/Glyph.tsx';
import { itemColor } from '../components/Inventory.tsx';
import { flash, flyText, mark, punch, rectOf, ring, shake, sleep, stream } from './juice.ts';
import { takeOrigin } from './origin.ts';
import { burst, burstAt } from './particles.ts';
import { sfx } from './sound.ts';

interface Toast { id: number; text: string; tone: '' | 'alarm' | 'good' | 'gold'; glyph?: ItemId | 'chest' }
interface ItemShow { key: number; item: ItemId; caption: string; attack: boolean; from: { x: number; y: number; w: number } | null }
interface ChestShow { key: number; tier: ChestTier; item: ItemId; who: string; coins: number }
interface BcShow { key: number; mode: 'activate' | 'burn'; result?: 'win' | 'lose'; caption: string; sub: string }

const TIER_COLOR: Record<ChestTier, string> = { bronze: '#B9763F', silver: '#CFCFCB', gold: '#E9B949', black: '#FF3832' };

/** Elemento del marcador de un jugador en esta pantalla (para que los efectos «aterricen» en él). */
export function scoreEl(pid: string | undefined, me?: string): Element | null {
  if (!pid) return null;
  if (pid === me) return document.getElementById('my-score');
  return document.querySelector(`[data-lb="${pid}"] .sc`) ?? document.querySelector(`[data-lb="${pid}"]`);
}

export function FxLayer({ view, me, lite }: { view: RoomView | null; me?: string; lite: boolean }) {
  const seen = useRef<number | null>(null);
  const lastReveal = useRef<string | null>(null);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [item, setItem] = useState<ItemShow | null>(null);
  const [chest, setChest] = useState<ChestShow | null>(null);
  const [bc, setBc] = useState<BcShow | null>(null);
  const bcDone = useRef<(() => void) | null>(null);

  const pushToast = (text: string, tone: Toast['tone'] = '', glyph?: Toast['glyph']) => {
    const id = Math.random();
    setToasts((t) => [...t.slice(-1), { id, text, tone, glyph }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  };
  const enqueue = (fn: () => Promise<void>, maxWait = 3500) => {
    const queued = Date.now();
    chain.current = chain.current.then(() => (Date.now() - queued > maxWait ? undefined : fn())).catch(() => undefined);
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
      const relevant = teacherView ? true : mine || targetMe || f.kind === 'unlock' || (f.kind === 'info' && !f.by);
      const toast = (text: string, tone: Toast['tone'] = '', glyph?: Toast['glyph']) => { if (relevant) pushToast(text, tone, glyph); };
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
          const it = f.item;
          const attack = ITEMS[it].kind === 'attack';
          if (targetMe) { sfx.alarm(); pushToast(`${name(f.by)} te ataca con ${ITEMS[it].name}. Solo un SHIELD lo bloquea.`, 'alarm', it); }
          // Origen: la carta que acaba de tocar este alumno, o su fila en el ranking.
          const r = (mine ? takeOrigin(it) : null) ?? rectOf(scoreEl(f.by, me));
          const from = r ? { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width } : null;
          const caption = attack ? `${name(f.by)} → ${ITEMS[it].name} → ${name(f.target)}` : `${name(f.by)} activa ${ITEMS[it].name}`;
          enqueue(async () => {
            sfx.whoosh();
            setItem({ key: f.id, item: it, caption, attack, from });
            await sleep(560);
            sfx.slam();
            shake(attack ? 1.3 : 0.7);
            ring(document.querySelector('.itemfx .fxcard'), attack ? '#FF3832' : '#F2F1EE', 900);
            itemSignature(it);
            await sleep(1150);
            setItem(null);
            if (attack) {
              const tgt = scoreEl(f.target, me);
              mark(tgt?.closest('[data-lb]') ?? tgt, 'bad', 1200);
              punch(tgt, 1.15);
            } else mark(scoreEl(f.by, me)?.closest('[data-lb]') ?? scoreEl(f.by, me), 'hot', 1200);
          }, 4000);
          return;
        }
        case 'steal': {
          toast(f.text, targetMe ? 'alarm' : mine ? 'good' : '', 'thief');
          const a = scoreEl(f.target, me), b = scoreEl(f.by, me);
          enqueue(async () => {
            sfx.steal();
            if (targetMe) { shake(1.6); flash('red', 380); }
            await stream(a, b, Math.min(14, 4 + (f.amount ?? 0) * 2));
            sfx.coin();
          }, 5000);
          return;
        }
        case 'block': {
          sfx.shield();
          toast(f.text, 'good', 'shield');
          const el = scoreEl(f.by, me);
          ring(el, '#F2F1EE', 360);
          mark(el?.closest('[data-lb]') ?? el, 'good', 1200);
          if (f.by === me) flash('white', 300);
          return;
        }
        case 'sabotaged':
          if (targetMe) { sfx.glitch(); glitch(900); shake(1); }
          return toast(f.text, targetMe ? 'alarm' : '', 'sabotage');
        case 'fizzle': return toast(f.text, '', 'thief');
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
          if (mine) { sfx.chestOpen('black'); flash('red', 500); burst(innerWidth / 2, innerHeight / 2, 'ember', 80); }
          return toast(`◆ ${f.text}`, 'gold', 'chest');
        case 'chest':
          if (mine) { sfx.star(); burstAt(document.querySelector('.chest-tray'), 'pixel', 18, { colors: [TIER_COLOR[f.tier ?? 'bronze'], '#F2F1EE'] }); }
          return toast(f.text, mine ? 'gold' : '', 'chest');
        case 'chest-open':
          // El alumno que abre lo ve en su propia escena; el resto (y el proyector) ven el resultado.
          if (!mine && f.item && f.tier) {
            const show: ChestShow = { key: f.id, tier: f.tier, item: f.item, who: name(f.by), coins: f.amount ?? 0 };
            if (teacherView) enqueue(async () => { sfx.chestOpen(show.tier); setChest(show); await sleep(1900); setChest(null); }, 6000);
            else toast(f.text, '', 'chest');
          }
          if (f.amount) setTimeout(() => punch(scoreEl(f.by, me), 1.2), 400);
          return;
        case 'star':
          if (mine) sfx.star();
          if (teacherView || mine) {
            const el = scoreEl(f.by, me);
            if (el && (f.amount ?? 0) > 0) burstAt(el, 'pixel', 10, { colors: ['#E9B949', '#F2F1EE'], speed: 0.5 });
          }
          return toast(f.text, (f.amount ?? 0) > 0 ? 'gold' : '');
        case 'jenga-pull':
          if (!mine) sfx.pull();
          return;
        case 'jenga-fall': return toast(f.text, 'alarm');
        case 'reward': return toast(f.text, mine ? 'good' : '');
        case 'manual': return toast(f.text);
        case 'join': return teacherView ? toast(f.text) : undefined;
        case 'expire': return toast(f.text, '', f.item);
        default: return toast(f.text);
      }
    }

    // Puntos de la corrección
    const rv = view.reveal;
    if (rv && rv.qid !== lastReveal.current) {
      lastReveal.current = rv.qid;
      if (me && rv.results[me]) {
        const r = rv.results[me];
        const run = async () => {
          await sleep(140); // pequeña pausa dramática antes del veredicto
          const verdict = document.querySelector('.verdict .big');
          if (r.status === 'correct') {
            sfx.good();
            flash('white', 260);
            burstAt(verdict, 'pixel', 46);
            if (r.delta > 0) { await sleep(380); await flyText(document.querySelector('.verdict .delta'), document.getElementById('my-score'), `+${r.delta}`); sfx.coin(); }
          } else if (r.status !== 'none' || r.delta) {
            sfx.bad();
            shake(1.4);
            flash('red', 380);
            glitch(380);
            if (r.delta < 0) { await sleep(300); await flyText(document.querySelector('.verdict .delta'), document.getElementById('my-score'), `${r.delta}`, 'neg'); }
          }
        };
        void run();
      } else if (!me && !rv.skipped) {
        const any = Object.values(rv.results).some((x) => x.status === 'correct');
        if (any) sfx.good(); else sfx.bad();
        // Cada alumno: su puntuación vuela desde su fila de corrección hasta el ranking.
        (async () => {
          await sleep(500);
          for (const [pid, x] of Object.entries(rv.results)) {
            if (!x.delta) continue;
            void flyText(document.querySelector(`[data-res="${pid}"] .d`), scoreEl(pid), x.delta > 0 ? `+${x.delta}` : `${x.delta}`, x.delta < 0 ? 'neg' : '');
            await sleep(220);
          }
        })();
      }
    } else if (!rv) lastReveal.current = null;
  }, [view, me]);

  return (
    <>
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`}>
            {t.glyph && (t.glyph === 'chest'
              ? <DotGlyph rows={CHEST_ROWS} className="tg" color="#E9B949" dim="transparent" />
              : <Glyph item={t.glyph} className="tg" color={itemColor(t.glyph)} dim="transparent" />)}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
      {item && <ItemOverlay show={item} />}
      {chest && (
        <div key={chest.key} className={`chestfx t-${chest.tier}`} aria-hidden="true" style={{ '--c': TIER_COLOR[chest.tier] } as CSSProperties}>
          <div className="cf-box"><DotGlyph rows={CHEST_ROWS} className="cg" color="currentColor" dim="transparent" /></div>
          <div className="cf-item"><Glyph item={chest.item} className="glyph" color={itemColor(chest.item)} /><b>{ITEMS[chest.item].name}</b></div>
          <div className="cap">{chest.who} abre un {CHESTS[chest.tier].name.toLowerCase()}{chest.coins ? ` · +${chest.coins} puntos` : ''}</div>
        </div>
      )}
      {bc && <BcStage key={bc.key} show={bc} lite={lite} onDone={() => { setBc(null); bcDone.current?.(); bcDone.current = null; }} />}
    </>
  );
}

/** Interferencia de pantalla completa (SABOTAGE, fallos). */
function glitch(ms: number) {
  if (document.documentElement.dataset.lite === '1') return;
  document.body.classList.add('glitching');
  setTimeout(() => document.body.classList.remove('glitching'), ms);
}

/** Cada objeto tiene su firma visual sobre toda la pantalla. */
function itemSignature(it: ItemId) {
  switch (it) {
    case 'shield': sfx.shield(); flash('white', 500); break;
    case 'double': sfx.double(); flash('gold', 450); burst(innerWidth / 2, innerHeight / 2, 'pixel', 60, { colors: ['#E9B949', '#F2F1EE'] }); break;
    case 'sabotage': sfx.glitch(); glitch(700); break;
    case 'thief': sfx.alarm(); flash('red', 350); break;
    case 'second': sfx.rewind(); document.body.classList.add('rewinding'); setTimeout(() => document.body.classList.remove('rewinding'), 700); break;
    case 'wildcard': sfx.shuffle(); burst(innerWidth / 2, innerHeight / 2, 'confetti', 40); break;
    default: break;
  }
}

function ItemOverlay({ show }: { show: ItemShow }) {
  const d = ITEMS[show.item];
  const from = show.from;
  const style = (from ? { '--fx': `${from.x - innerWidth / 2}px`, '--fy': `${from.y - innerHeight / 2}px`, '--fs': Math.max(0.2, from.w / 240) } : { '--fx': '0px', '--fy': '40vh', '--fs': 0.4 }) as CSSProperties;
  return (
    <div className={`itemfx sig-${show.item}${show.attack ? ' attack' : ''}`} aria-hidden="true" style={style}>
      {show.item === 'double' && <div className="sig-x2">×2</div>}
      {show.item === 'shield' && <div className="sig-hex" />}
      {show.item === 'thief' && <div className="sig-scan" />}
      {show.item === 'second' && <div className="sig-rewind">◀◀</div>}
      <div className="fxcard">
        <span className="kind">{d.tag}</span>
        <span className="name">{d.name}</span>
        <Glyph item={show.item} className="glyph" color={itemColor(show.item)} />
        <span className="tagline">{d.short}</span>
      </div>
      {show.item === 'wildcard' && <><div className="fxcard ghost g1" /><div className="fxcard ghost g2" /></>}
      <div className="cap">{show.caption}</div>
    </div>
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
            ? <span className="dotnum" style={{ fontSize: '4.5rem', color: show.result === 'win' ? '#F2F1EE' : '#FF3832' }}>{show.caption}</span>
            : <Glyph item="blackcard" color="#FF3832" className="glyph" />}
        </div>
      )}
      <div className="cap">{show.mode === 'activate' ? 'BLACKCARD' : show.caption}<small>{show.sub}</small></div>
    </div>
  );
}
