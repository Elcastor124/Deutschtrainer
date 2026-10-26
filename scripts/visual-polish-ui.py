"""Real Edge regression for the visual polish. All gameplay uses an isolated LOCAL server.
Run with the dt-video-env Python (Playwright). No answer keys enter the frontend bundle.
"""
from __future__ import annotations
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time
import urllib.request
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'shots' / 'visual-polish'
EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'


def answer_for(public, private):
    kind = private['type']
    if kind == 'mc': return {'choice': public['options'].index(private['options'][private['answer']])}
    if kind in ('write', 'build'): return {'text': private['accept'][0]}
    if kind == 'gap': return {'gaps': [x[0] for x in private['gaps']]}
    if kind == 'error': return {'index': private['wrong'], 'fix': private['fix'][0]}
    if kind == 'match': return {'pairs': [public['right'].index(pair[1]) for pair in private['pairs']]}
    remaining = list(enumerate(public['tokens']))
    indices = []
    for token in private['tokens']:
        item = next(x for x in remaining if x[1] == token)
        indices.append(item[0]); remaining.remove(item)
    return {'order': indices}


def verify(base):
    assert base.startswith(('http://127.0.0.1:', 'http://localhost:'))
    OUT.mkdir(parents=True, exist_ok=True)
    results = []
    def check(label, value, details=None):
        results.append({'check': label, 'passed': bool(value), 'details': details})
        (OUT / 'results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
        assert value, f'{label}: {details}'
        print('PASS ' + label, flush=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=EDGE, headless=True, args=['--mute-audio', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'])
        try:
            for width, height in [(1366, 768), (1024, 768), (390, 844), (320, 740)]:
                context = browser.new_context(viewport={'width': width, 'height': height}, reduced_motion='no-preference')
                page = context.new_page(); errors = []
                page.on('pageerror', lambda e: errors.append(str(e)))
                page.goto(base + '/?intro=0')
                page.locator('#hero-title').wait_for()
                page.wait_for_timeout(2000)
                await_fonts = page.evaluate('document.fonts.ready.then(() => [...document.fonts].filter(x=>x.status==="loaded").map(x=>x.family))')
                check(f'{width}: local editorial font loaded', any('Barlow' in f for f in await_fonts), await_fonts)
                bounds = page.evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth, h1:document.querySelector("#hero-title").getBoundingClientRect().toJSON(),font:getComputedStyle(document.querySelector("#hero-title")).fontFamily})')
                check(f'{width}: no horizontal overflow', bounds['scroll'] <= width + 1, bounds)
                check(f'{width}: semantic headline fully in viewport', bounds['h1']['left'] >= -1 and bounds['h1']['right'] <= width+1, bounds)
                check(f'{width}: no invisible headline', page.locator('#hero-title').is_visible())
                page.screenshot(path=str(OUT / f'landing-{width}.png'))
                if width > 920:
                    page.locator('.dt-nav-links a[href="/curso"]').click()
                else:
                    page.locator('.dt-nav-toggle').click()
                    page.locator('.dt-nav-links a[href="/curso"]').click()
                page.wait_for_url('**/curso'); page.wait_for_timeout(700)
                check(f'{width}: route entered once, no residual intro locks', page.evaluate('!document.querySelector("[data-intro]") && !document.querySelector("[inert]")'))
                check(f'{width}: no running landing shader in course', page.locator('[data-ambient-field]').count() == 0 or page.evaluate('[...document.querySelectorAll("[data-ambient-field]")].every(e=>e.dataset.ambientStatus!=="running")'))
                check(f'{width}: no runtime errors', not errors, errors)
                context.close()
            context = browser.new_context(viewport={'width':1366,'height':768}, reduced_motion='no-preference')
            page = context.new_page(); page.goto(base + '/practica?temas=dativ')
            page.locator('form.home input.field').first.fill('Gamefeel QA')
            page.locator('form.home .btn.primary.lg').click()
            page.wait_for_function('globalThis.__bcNet?.state.view?.phase === "question"')
            page.wait_for_function('!!document.querySelector("[data-practice-progress]")')
            check('practice: starts honestly at zero', page.locator('[data-practice-progress] [role=progressbar]').get_attribute('aria-valuenow') == '0')
            page.evaluate('globalThis.__qaPlayer=document.querySelector(".player");globalThis.__qaQuestion=document.querySelector(".qpanel")')
            bank_result = subprocess.run(['node','--disable-warning=ExperimentalWarning','--input-type=module','-e',"import {loadBank} from './server/bank/index.ts'; console.log(JSON.stringify([...loadBank().values()]));"],cwd=ROOT,capture_output=True,text=True,check=True)
            bank = {q['id']:q for q in json.loads(bank_result.stdout)}
            for n in range(1,4):
                view = page.evaluate('globalThis.__bcNet.state.view')
                answer = answer_for(view['q'], bank[view['q']['id']])
                result = page.evaluate('a=>globalThis.__bcNet.request({t:"answer",qid:globalThis.__bcNet.state.view.q.id,a})',answer)
                check(f'practice: answer {n} genuinely accepted', result['ok'], result)
                page.wait_for_function('globalThis.__bcNet.state.view.phase === "reveal"')
                page.wait_for_function('(n)=>document.querySelector("[data-practice-progress] [role=progressbar]")?.getAttribute("aria-valuenow")===String(n)',arg=n)
                page.wait_for_function('!!document.querySelector(".qpanel[data-practice-feedback]")')
                kind=page.locator('.qpanel').get_attribute('data-practice-feedback')
                check(f'practice: feedback {n} matches authoritative result',kind == ('milestone' if n==3 else 'correct'),kind)
                check(f'practice: no gameplay remount on result {n}',page.evaluate('globalThis.__qaPlayer===document.querySelector(".player")'))
                if n == 3:
                    page.wait_for_timeout(250);page.screenshot(path=str(OUT/'practice-streak3.png'))
                    break
                page.locator('.qpanel .btn.primary.lg').press('Enter')
                page.wait_for_function('globalThis.__bcNet.state.view.phase === "question"')
            toggle=page.locator('.dt-nav [role=switch]').filter(has_text='Efectos').first
            if not toggle.count(): toggle=page.locator('[data-effects-toggle]')
            toggle.click()
            page.wait_for_function('document.documentElement.dataset.dtEffects === "off"')
            check('practice: pause preserves game tree and progress',page.evaluate('globalThis.__qaPlayer===document.querySelector(".player") && document.querySelector("[role=progressbar]").getAttribute("aria-valuenow")==="3"'))
            page.wait_for_function('!document.querySelector(".qpanel[data-practice-feedback]")')
            toggle.click();page.wait_for_function('document.documentElement.dataset.dtEffects === "on"')
            check('practice: resuming effects does not replay result',page.locator('.qpanel[data-practice-feedback]').count()==0)
            page.reload();page.wait_for_function('globalThis.__bcNet?.state.view?.phase === "reveal"')
            check('practice: restored reveal not a new celebration',page.locator('.qpanel[data-practice-feedback]').count()==0)
            page.screenshot(path=str(OUT/'restored-practice.png'))
            context.close()
            context=browser.new_context(viewport={'width':1366,'height':768},reduced_motion='reduce')
            page=context.new_page();page.goto(base+'/?intro=1');page.locator('#hero-title').wait_for();page.wait_for_timeout(1200)
            check('reduced motion: no intro despite forced URL',page.locator('[data-intro]').count()==0)
            check('reduced motion: root effects are off',page.evaluate('document.documentElement.dataset.dtEffects==="off"'))
            active=page.evaluate('document.getAnimations().filter(a=>a.playState==="running" && a.effect?.getTiming().iterations===Infinity).length')
            check('reduced motion: no infinite animation',active==0,active)
            page.screenshot(path=str(OUT/'reduced-motion.png'));context.close()
            context=browser.new_context(viewport={'width':1366,'height':768})
            page=context.new_page()
            page.add_init_script('const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...rest){if(String(type).includes("webgl"))return null;return original.call(this,type,...rest)}')
            page.goto(base+'/?intro=0');page.locator('#hero-title').wait_for();page.wait_for_timeout(1600)
            check('no WebGL: canonical static logo fallback',page.locator('.dt-hero-static [data-brand-symbol]').count()>0 or page.locator('.dt-hero-static svg').count()>0)
            check('no WebGL: links remain interactive',page.locator('.dt-hero .dt-btn-primary').is_enabled())
            page.screenshot(path=str(OUT/'no-webgl.png'));context.close()
        finally: browser.close()
    print(json.dumps({'passed':True,'checks':len(results),'artifacts':str(OUT)},ensure_ascii=False))


def main():
    scratch=Path(os.environ.get('TMPDIR',str(Path.home()/'AppData/Local/hermes/cache/scratch')))
    with tempfile.TemporaryDirectory(prefix='dt-polish-',dir=scratch) as data:
        with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
        base=f'http://127.0.0.1:{port}'
        with open(Path(data)/'server.log','w',encoding='utf-8') as log:
            server=subprocess.Popen(['node','--disable-warning=ExperimentalWarning','server/index.ts'],cwd=ROOT,env=dict(os.environ,PORT=str(port),DATA_DIR=data),stdout=log,stderr=log)
            try:
                deadline=time.monotonic()+25
                while True:
                    try:
                        with urllib.request.urlopen(base+'/api/health',timeout=1) as r:assert json.load(r)['ok']
                        break
                    except (OSError,ValueError):
                        if server.poll() is not None or time.monotonic()>deadline:raise RuntimeError('isolated server unavailable')
                        time.sleep(.2)
                verify(base)
            finally:server.terminate();server.wait(timeout=15)
if __name__=='__main__':main()
