"""One-time German synthesis; classroom playback requires no service or payment.
Run from the repo: uv run --isolated --with edge-tts==7.3.1 python scripts/road-audio-generate.py
Requires Node >=22.18, ffmpeg and ffprobe. Only the synthetic examination scripts
are transmitted to Microsoft's Edge TTS endpoint, never any student/session data.
Existing verified assets are reused; pass --force to regenerate. Every output is
fully decoded by ffmpeg before the manifest is published. Source hashes cover
exact UTF-8 source text (including punctuation and paragraph whitespace).
"""
import asyncio
from datetime import datetime, timezone
from hashlib import sha256
import importlib.metadata
import json
from pathlib import Path
import subprocess
import sys
import edge_tts

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'server' / 'road-audio'

def digest(data):
    return sha256(data).hexdigest()

def validate(path):
    probe = json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','a:0','-show_entries','stream=codec_name:format=duration','-of','json',str(path)],text=True))
    duration = float(probe['format']['duration'])
    codec = probe['streams'][0]['codec_name']
    assert codec == 'mp3' and duration > 1, (path, probe)
    subprocess.run(['ffmpeg','-nostdin','-v','error','-xerror','-i',str(path),'-f','null','-'],check=True,capture_output=True)
    return duration, codec

async def main():
    raw = subprocess.check_output(['node','--disable-warning=ExperimentalWarning','--input-type=module','-e',"import { ROAD_SECRET } from './server/road-content.ts'; console.log(JSON.stringify(ROAD_SECRET));"],cwd=ROOT)
    secret = json.loads(raw)
    sources = dict(secret['scripts'])
    sources['diktat'] = secret['dictation']
    sources.update({f'diktat-{i}': text for i,text in enumerate(secret['dictationFragments'],1)})
    OUT.mkdir(parents=True,exist_ok=True)
    old = {}
    manifest_path = OUT / 'manifest.json'
    if manifest_path.exists():
        old = {a['id']:a for a in json.loads(manifest_path.read_text(encoding='utf-8'))['assets']}
    semaphore = asyncio.Semaphore(2)
    async def synthesize(id,text):
        async with semaphore:
            voice = 'de-DE-ConradNeural' if id in ['h2','h4'] else 'de-DE-KatjaNeural'
            rate = '-20%' if id.startswith('diktat') else '-10%'
            source_hash = digest(text.encode('utf-8'))
            target = OUT / f'{id}.mp3'
            previous = old.get(id,{})
            if '--force' in sys.argv or not (target.exists() and previous.get('sourceSha256')==source_hash and previous.get('voice')==voice and previous.get('rate')==rate and previous.get('sha256')==digest(target.read_bytes())):
                for attempt in range(3):
                    temp = OUT / f'{id}.pending.mp3'
                    try:
                        await edge_tts.Communicate(text,voice,rate=rate).save(str(temp))
                        validate(temp)
                        temp.replace(target)
                        break
                    except Exception:
                        if temp.exists(): temp.unlink()
                        if attempt == 2: raise
                        await asyncio.sleep(2 ** attempt)
            duration,codec = validate(target)
            data = target.read_bytes()
            asset = dict(id=id,file=f'{id}.mp3',voice=voice,rate=rate,sourceSha256=source_hash,sha256=digest(data),bytes=len(data),duration=duration,codec=codec,decoded=True)
            print(json.dumps(asset),flush=True)
            return asset
    assets = await asyncio.gather(*(synthesize(id,text) for id,text in sources.items()))
    manifest = dict(levelId='level-1',version='1.0.0',provider='Microsoft Edge TTS (one-time generation)',generator='scripts/road-audio-generate.py',edgeTtsVersion=importlib.metadata.version('edge-tts'),generatedAt=datetime.now(timezone.utc).isoformat(),assets=assets)
    manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'Validated {len(assets)} MP3 files; {sum(a["bytes"] for a in assets)} bytes total',flush=True)

if __name__ == '__main__':
    asyncio.run(main())
