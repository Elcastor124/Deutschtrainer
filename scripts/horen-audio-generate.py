"""One-time German synthesis for Hörverstehen 001 (five exam tracks + five spoken instructions).

Run from the repo:
  uv run --isolated --with edge-tts==7.3.1 python scripts/horen-audio-generate.py [--force]

Requires Node >=22.18, ffmpeg and ffprobe. Only the synthetic exam scripts are sent to Microsoft's
Edge TTS endpoint (no student data). Every speaker turn is synthesised with its own voice at the
natural rate (no slowdown), then joined with short natural gaps. Speaker labels, headings,
question numbers and solutions are never part of the spoken text (they are not in `turns`).
Outputs live in server/horen/audio/ (server-only) with a manifest of REAL decoded durations,
which the app uses to compute the exam timeline. Existing tracks whose source hash matches are reused.
"""
import asyncio, importlib.metadata, json, subprocess, sys, tempfile
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
import edge_tts

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'server' / 'horen' / 'audio'
TURN_GAP = 0.45      # between turns of one conversation
SEGMENT_GAP = 2.2    # between the six conversations / six people (no spoken titles)
LEAD = 0.6           # silence before the first word
RATE = '+0%'         # natural speed, never artificially slowed down


def digest(b): return sha256(b).hexdigest()


def probe(path):
    out = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_name:format=duration', '-of', 'json', str(path)], text=True))
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-xerror', '-i', str(path), '-f', 'null', '-'], check=True, capture_output=True)
    return float(out['format']['duration']), out['streams'][0]['codec_name']


def silence(path, seconds):
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', f'{seconds:.3f}', '-c:a', 'pcm_s16le', str(path)], check=True)


async def tts(text, voice, pitch, target):
    for attempt in range(4):
        try:
            await edge_tts.Communicate(text, voice, rate=RATE, pitch=pitch).save(str(target))
            probe(target)
            return
        except Exception:
            if attempt == 3: raise
            await asyncio.sleep(2 ** attempt)


async def build_track(id, plan, work):
    """plan: list of ('say', text, voice, pitch) | ('gap', seconds). Produces OUT/id.mp3."""
    sem = asyncio.Semaphore(3)
    pieces = []
    async def say(i, text, voice, pitch):
        async with sem:
            mp3 = work / f'{id}-{i:03d}.mp3'; wav = work / f'{id}-{i:03d}.wav'
            await tts(text, voice, pitch, mp3)
            subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', str(mp3), '-ar', '24000', '-ac', '1', '-c:a', 'pcm_s16le', str(wav)], check=True)
            return wav
    jobs = []
    for i, step in enumerate(plan):
        if step[0] == 'say': jobs.append((i, asyncio.create_task(say(i, *step[1:]))))
        else:
            wav = work / f'{id}-{i:03d}-gap.wav'; silence(wav, step[1]); jobs.append((i, wav))
    for i, job in jobs: pieces.append(await job if isinstance(job, asyncio.Task) else job)
    lst = work / f'{id}.txt'
    lst.write_text(''.join(f"file '{p.as_posix()}'\n" for p in pieces), encoding='utf-8')
    target = OUT / f'{id}.mp3'; pending = OUT / f'{id}.pending.mp3'
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', str(lst), '-ar', '24000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '64k', str(pending)], check=True)
    probe(pending); pending.replace(target)


def plan_for(segments):
    plan = [('gap', LEAD)]
    for si, seg in enumerate(segments):
        if si: plan.append(('gap', SEGMENT_GAP))
        for ti, t in enumerate(seg['turns']):
            if ti: plan.append(('gap', TURN_GAP))
            plan.append(('say', t['text'], t['voice'], t['pitch']))
    plan.append(('gap', 0.8))
    return plan


async def main():
    raw = subprocess.check_output(['node', '--disable-warning=ExperimentalWarning', '--input-type=module', '-e', "import { HOREN_SECRET, HOREN_SPEC_SHA256 } from './server/horen/content-001.ts'; console.log(JSON.stringify({ s: HOREN_SECRET, h: HOREN_SPEC_SHA256 }));"], cwd=ROOT)
    data = json.loads(raw); secret = data['s']
    OUT.mkdir(parents=True, exist_ok=True)
    manifest_path = OUT / 'manifest.json'
    old = {a['id']: a for a in json.loads(manifest_path.read_text(encoding='utf-8'))['assets']} if manifest_path.exists() else {}
    tracks = {id: plan_for(segs) for id, segs in secret['scripts'].items()}
    narrator = ('de-DE-FlorianMultilingualNeural', '+0Hz')
    for id, text in secret['spokenInstructions'].items():
        tracks[id] = [('gap', 0.4), ('say', text, *narrator), ('gap', 0.6)]
    assets = []
    with tempfile.TemporaryDirectory(dir=ROOT.parent if False else None) as tmp:
        work = Path(tmp)
        for id, plan in sorted(tracks.items()):
            src = json.dumps({'plan': plan, 'rate': RATE}, ensure_ascii=False, sort_keys=True).encode('utf-8')
            source_hash = digest(src); target = OUT / f'{id}.mp3'; prev = old.get(id, {})
            if '--force' in sys.argv or not (target.exists() and prev.get('sourceSha256') == source_hash and prev.get('sha256') == digest(target.read_bytes())):
                await build_track(id, plan, work)
            duration, codec = probe(target); b = target.read_bytes()
            voices = sorted({s[2] for s in plan if s[0] == 'say'})
            assets.append(dict(id=id, file=f'{id}.mp3', voices=voices, rate=RATE, sourceSha256=source_hash, sha256=digest(b), bytes=len(b), duration=round(duration, 3), codec=codec, decoded=True))
            print(json.dumps(assets[-1]), flush=True)
    manifest = dict(examId='horen-001', specSha256=data['h'], provider='Microsoft Edge TTS (one-time generation)', generator='scripts/horen-audio-generate.py', edgeTtsVersion=importlib.metadata.version('edge-tts'), generatedAt=datetime.now(timezone.utc).isoformat(), assets=assets)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(f'Validated {len(assets)} MP3 files; {sum(a["bytes"] for a in assets)} bytes; exam audio {sum(a["duration"] for a in assets if a["id"].startswith("a")):.1f} s', flush=True)


if __name__ == '__main__':
    asyncio.run(main())
