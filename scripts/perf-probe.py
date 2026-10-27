"""Real Edge frame-pacing probe of the built app: intro + landing hand-off.

Usage: python scripts/perf-probe.py [BASE] [label]
Records rAF frame deltas, long tasks and key milestones from first paint to
landing settled, desktop + throttled-CPU (4x) mobile. Writes shots/perf/<label>.json.
"""
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4799'
LABEL = sys.argv[2] if len(sys.argv) > 2 else 'probe'
OUT = Path(__file__).resolve().parent.parent / 'shots' / 'perf'
OUT.mkdir(parents=True, exist_ok=True)
EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'

INIT = r"""
(() => {
  const t0 = performance.now();
  const p = window.__perf = { frames: [], long: [], marks: {} };
  let last = 0;
  const tick = (now) => { if (last) p.frames.push([Math.round(now), +(now - last).toFixed(1)]); last = now; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => p.long.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: 'longtask', buffered: true }); } catch {}
  p.loaf = [];
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => p.loaf.push({ t: Math.round(e.startTime), d: Math.round(e.duration), block: Math.round(e.blockingDuration), render: Math.round(e.renderStart ? e.startTime + e.duration - e.renderStart : 0), style: Math.round(e.styleAndLayoutStart ? e.startTime + e.duration - e.styleAndLayoutStart : 0), scripts: e.scripts.map((s) => [s.invoker, s.sourceFunctionName, Math.round(s.duration)]).slice(0, 4) }))).observe({ type: 'long-animation-frame', buffered: true }); } catch {}
  const mark = (k) => { if (!(k in p.marks)) p.marks[k] = Math.round(performance.now()); };
  new MutationObserver(() => {
    if (document.querySelector('[data-preloader]')) mark('preloaderSeen');
    if (document.querySelector('[data-preloader="done"]') || (p.marks.preloaderSeen && !document.querySelector('[data-preloader]'))) mark('preloaderGone');
    // The intro may be mounted (paused) behind the preloader: its clock starts when it is unpaused.
    if (document.querySelector('[data-intro]:not(.is-waiting)')) mark('introStart');
    if (p.marks.introStart && !document.querySelector('[data-intro]')) mark('introEnd');
    if (document.querySelector('.dt-hero-3d.is-ready')) mark('hero3dReady');
    if (document.querySelector('.dt-editorial[data-editorial-enter="play"]')) mark('editorialPlay');
  }).observe(document, { subtree: true, childList: true, attributes: true });
})();
"""


def summarize(perf, start, end):
    frames = [d for t, d in perf['frames'] if start <= t <= end]
    if not frames:
        return {'frames': 0}
    s = sorted(frames)
    return {
        'frames': len(frames),
        'p50': s[len(s) // 2],
        'p95': s[int(len(s) * .95) - 1],
        'max': s[-1],
        'over33': sum(1 for d in frames if d > 33.4),
        'over50': sum(1 for d in frames if d > 50),
        'jankMs': round(sum(max(0, d - 16.7) for d in frames)),
    }


def run(p, name, viewport, mobile=False, cpu=1):
    browser = p.chromium.launch(executable_path=EDGE, headless=True, args=['--enable-gpu-rasterization', '--ignore-gpu-blocklist'])
    ctx = browser.new_context(viewport=viewport, is_mobile=mobile, has_touch=mobile, device_scale_factor=2 if mobile else 1)
    ctx.add_init_script(INIT)
    import os
    css = os.environ.get('PERF_CSS')
    if css:
        ctx.add_init_script("document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent=%s;document.head.append(s)})" % json.dumps(css))
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    if cpu > 1:
        cdp = ctx.new_cdp_session(page)
        cdp.send('Emulation.setCPUThrottlingRate', {'rate': cpu})
    metrics_cdp = ctx.new_cdp_session(page)
    metrics_cdp.send('Performance.enable')
    def metrics():
        return {m['name']: m['value'] for m in metrics_cdp.send('Performance.getMetrics')['metrics']}
    page.goto(BASE + '/?intro=1', wait_until='commit')
    page.wait_for_function("window.__perf && window.__perf.marks.introStart", timeout=30000)
    m0 = metrics()
    page.wait_for_function("window.__perf.marks.introEnd", timeout=30000)
    m1 = metrics()
    cost = {k: round((m1[k] - m0[k]) * 1000) for k in ['TaskDuration', 'ScriptDuration', 'RecalcStyleDuration', 'LayoutDuration'] if k in m1}
    cost.update({k: int(m1[k] - m0[k]) for k in ['RecalcStyleCount', 'LayoutCount'] if k in m1})
    page.wait_for_timeout(2500)
    perf = page.evaluate('window.__perf')
    gl = page.evaluate("""(() => { const c = document.createElement('canvas').getContext('webgl'); const d = c && c.getExtension('WEBGL_debug_renderer_info'); return d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'none'; })()""")
    m = perf['marks']
    res = {
        'name': name, 'cpu': cpu, 'introMainThreadMs': cost, 'gl': gl, 'marks': m, 'errors': errors,
        'intro': summarize(perf, m['introStart'], m['introEnd']),
        'handoff': summarize(perf, m['introEnd'] - 600, m['introEnd'] + 2400),
        'longTasks': [lt for lt in perf['long'] if lt[1] >= 50],
        'loaf': [dict(x, t=x['t'] - m['introStart']) for x in perf.get('loaf', []) if m['introStart'] - 100 <= x['t'] <= m['introEnd'] + 2500],
        'slowFrames': [[t - m['introStart'], d] for t, d in perf['frames'] if d > 33.4 and m['introStart'] - 1500 <= t <= m['introEnd'] + 2500],
        # 500 ms buckets from intro start: count of frames > 33 ms, to locate jank by phase
        'introJankByPhase': {str(b * 500): sum(1 for t, d in perf['frames'] if m['introStart'] + b * 500 <= t < m['introStart'] + (b + 1) * 500 and d > 33.4) for b in range(14)},
    }
    browser.close()
    return res


with sync_playwright() as p:
    only = sys.argv[3] if len(sys.argv) > 3 else 'all'
    results = []
    if only in ('all', 'desktop'): results.append(run(p, 'desktop', {'width': 1366, 'height': 768}))
    if only in ('all', 'mobile'): results.append(run(p, 'mobile-cpu4', {'width': 390, 'height': 844}, mobile=True, cpu=4))
(OUT / f'{LABEL}.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
for r in results:
    print(json.dumps({k: r[k] for k in ['name', 'gl', 'marks', 'intro', 'handoff']}))
    print('  longTasks>=50ms:', r['longTasks'][:20], 'errors:', r['errors'])
    for x in r['loaf'][:12]: print('  LoAF', x)
    print('  slow frames rel. intro start:', r['slowFrames'][:30])
    print('  long tasks rel.:', [[t - r['marks']['introStart'], d] for t, d in r['longTasks'] if t > r['marks']['introStart'] - 1500])
    print('  intro main-thread cost:', r['introMainThreadMs'])
    print('  jank by intro phase (ms->frames>33ms):', r['introJankByPhase'])
