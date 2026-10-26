"""Real Edge video capture; no generated animation frames or mocked app responses.
Run with an environment containing playwright; uses installed Edge and ffmpeg.
Defaults to an isolated local server and scratch data (never student production data).
"""
from __future__ import annotations
import argparse
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
EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'


def practice_take(page, base: str, output: Path):
    # Bank keys are read by the local recording process only, never injected into
    # the production client. Requests exercise the real grading and event path.
    bank_json = subprocess.run(['node', '--disable-warning=ExperimentalWarning', '--input-type=module', '-e', "import {loadBank} from './server/bank/index.ts'; console.log(JSON.stringify([...loadBank().values()]));"], cwd=ROOT, capture_output=True, text=True, check=True)
    bank = {q['id']: q for q in json.loads(bank_json.stdout)}
    page.goto(base + '/practica?temas=dativ')
    page.locator('form.home input.field').first.fill('Vista previa')
    page.wait_for_timeout(2200)
    page.locator('form .btn.primary.lg').click()
    page.wait_for_function("globalThis.__bcNet?.state.view?.phase === 'question'")
    trace = []
    answer_count = 0
    while answer_count < 35:
        view = page.evaluate('globalThis.__bcNet.state.view')
        if view['phase'] == 'final':
            break
        public = view['q']
        q = bank[public['id']]
        kind = q['type']
        if kind == 'mc':
            answer = {'choice': public['options'].index(q['options'][q['answer']])}
        elif kind in ('write', 'build'):
            answer = {'text': q['accept'][0]}
        elif kind == 'gap':
            answer = {'gaps': [g[0] for g in q['gaps']]}
        elif kind == 'order':
            remaining = list(enumerate(public['tokens']))
            indices = []
            for token in q['tokens']:
                item = next(pair for pair in remaining if pair[1] == token)
                indices.append(item[0])
                remaining.remove(item)
            answer = {'order': indices}
        elif kind == 'error':
            answer = {'index': q['wrong'], 'fix': q['fix'][0]}
        else:
            answer = {'pairs': [public['right'].index(pair[1]) for pair in q['pairs']]}
        if answer_count == 10:
            answer = {'choice': 999, 'text': 'qqq', 'gaps': ['qqq'] * 8, 'order': [], 'index': 999, 'fix': 'qqq', 'pairs': [999] * 8}
        page.wait_for_timeout(350)
        result = page.evaluate("a => globalThis.__bcNet.request({t:'answer', qid:globalThis.__bcNet.state.view.q.id,a})", answer)
        assert result['ok'], result
        page.wait_for_function("globalThis.__bcNet.state.view.phase === 'reveal'")
        answer_count += 1
        expected = {3: 'streak3', 5: 'streak5', 10: 'streak10', 11: 'support'}.get(answer_count)
        if expected:
            page.wait_for_function('(s) => document.querySelector("[data-klaus-panel]")?.dataset.klausState === s', arg=expected)
        observed = page.locator('[data-klaus-panel]').get_attribute('data-klaus-state')
        trace.append({'answer': answer_count, 'reaction': observed, 'comment': page.locator('[data-klaus-comment]').inner_text()})
        page.evaluate('scrollTo({top:0,behavior:"instant"})')
        page.wait_for_timeout(2800 if expected else 650)
        if expected:
            page.screenshot(path=str(output / (expected + '.png')))
        page.locator('.qpanel .btn.primary.lg').press('Enter')
        page.wait_for_function("globalThis.__bcNet.state.view.phase !== 'reveal'")
    assert page.evaluate('globalThis.__bcNet.state.view.phase') == 'final'
    page.wait_for_function('document.querySelector("[data-klaus-panel]")?.dataset.klausState === "complete"')
    page.evaluate('scrollTo({top:0,behavior:"instant"})')
    page.wait_for_timeout(3000)
    page.screenshot(path=str(output / 'complete.png'))
    (output / 'practice-events.json').write_text(json.dumps(trace, ensure_ascii=False, indent=2), encoding='utf-8')
    assert all(any(e['reaction'] == s for e in trace) for s in ['streak3', 'streak5', 'streak10', 'support'])


def record(base: str, output: Path, width: int, height: int, scenario: str):
    output.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=EDGE, headless=True, args=['--autoplay-policy=no-user-gesture-required', '--mute-audio'])
        context = browser.new_context(viewport={'width': width, 'height': height}, record_video_dir=str(output / 'raw'), record_video_size={'width': width, 'height': height}, reduced_motion='no-preference')
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        if scenario == 'practice':
            assert base.startswith(('http://127.0.0.1:', 'http://localhost:')), 'Practice capture must use isolated LOCAL server data'
            practice_take(page, base, output)
        elif scenario == 'navigation':
            page.goto(base + '/?intro=0')
            page.locator('#hero-title').wait_for()
            page.wait_for_timeout(3500)
            page.screenshot(path=str(output / 'hero.png'))
            observed = []
            for label, target in [('Curso', '/curso'), ('Practicar', '/practica'), ('Road to B1', '/road-to-b1'), ('Inicio', '/')]:
                page.locator('.dt-nav-links a').filter(has_text=label).first.click()
                page.wait_for_function('(path) => location.pathname === path', arg=target)
                page.wait_for_timeout(160)
                page.screenshot(path=str(output / ('transition-' + label.replace(' ', '-') + '.png')))
                observed.append({'route': target, 'content': page.locator('#contenido').inner_text()[:150]})
                page.wait_for_timeout(1500)
            page.go_back()
            page.wait_for_timeout(1600)
            (output / 'navigation-events.json').write_text(json.dumps(observed, ensure_ascii=False, indent=2), encoding='utf-8')
        elif scenario == 'showcase':
            page.goto(base + '/preview/klaus')
            page.locator('[data-klaus-showcase]').wait_for()
            for reaction in ['waving', 'thinking', 'correct', 'support', 'streak3', 'streak5', 'streak10', 'complete']:
                page.locator(f'[data-klaus-demo="{reaction}"]').click()
                page.wait_for_timeout(2300)
            page.screenshot(path=str(output / 'showcase.png'))
        else:
            page.goto(base + '/?intro=1')
            page.locator('[data-testid=intro]').wait_for(state='visible')
            page.wait_for_timeout(1800)
            page.screenshot(path=str(output / 'intro-frame.png'))
            page.locator('[data-testid=intro]').wait_for(state='detached', timeout=15000)
            page.wait_for_timeout(4000)
            assert page.locator('#hero-title').is_visible()
            page.screenshot(path=str(output / 'landing.png'))
            page.locator('.dt-hero .dt-btn-primary').hover()
            page.wait_for_timeout(650)
            page.evaluate('window.scrollTo({top:window.innerHeight * .72,behavior:"smooth"})')
            page.wait_for_timeout(1800)
            page.screenshot(path=str(output / 'landing-details.png'))
        video = page.video
        context.close()
        raw = video.path()
        browser.close()
    dest = output / (scenario + '.mp4')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(raw), '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(dest)], check=True)
    probe = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration:stream=width,height,codec_name', '-of', 'json', str(dest)], check=True, text=True, capture_output=True)
    result = {'video': str(dest), 'errors': errors, 'probe': json.loads(probe.stdout)}
    (output / 'capture.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    assert not errors, errors
    print(json.dumps(result, indent=2))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base')
    parser.add_argument('--scenario', choices=['intro', 'practice', 'showcase', 'navigation'], default='intro')
    parser.add_argument('--output', required=True)
    parser.add_argument('--width', type=int, default=1366)
    parser.add_argument('--height', type=int, default=768)
    args = parser.parse_args()
    if args.base:
        record(args.base, Path(args.output), args.width, args.height, args.scenario)
        return
    scratch = Path(os.environ.get('TMPDIR', str(Path.home() / 'AppData/Local/hermes/cache/scratch')))
    with tempfile.TemporaryDirectory(prefix='dt-video-', dir=scratch) as data:
        with socket.socket() as s:
            s.bind(('127.0.0.1', 0))
            port = s.getsockname()[1]
        base = f'http://127.0.0.1:{port}'
        env = dict(os.environ, PORT=str(port), DATA_DIR=data)
        with open(Path(data) / 'server.log', 'w', encoding='utf-8') as log:
            server = subprocess.Popen(['node', '--disable-warning=ExperimentalWarning', 'server/index.ts'], cwd=ROOT, env=env, stdout=log, stderr=log)
            try:
                deadline = time.monotonic() + 25
                while True:
                    try:
                        with urllib.request.urlopen(base + '/api/health', timeout=1) as r:
                            assert json.load(r)['ok']
                        break
                    except (OSError, ValueError):
                        if server.poll() is not None or time.monotonic() > deadline:
                            raise RuntimeError('Local preview server failed; inspect server log')
                        time.sleep(.2)
                record(base, Path(args.output), args.width, args.height, args.scenario)
            finally:
                server.terminate()
                server.wait(timeout=15)


if __name__ == '__main__':
    main()
