"""Re-import the original, user-provided Level 1 specification without paraphrasing.
Usage: python scripts/road-audio-import.py /path/to/original-spec.txt
Only synthetic exam content is extracted; no student/session data is used.
"""
import json
from pathlib import Path
import re
import sys

source = Path(sys.argv[1]).read_text(encoding='utf-8')
lines = source.splitlines()
def block(start, end):
    return '\n'.join(lines[start-1:end]).strip()
def line(n):
    return lines[n-1]
def text(id, title, start, end, **extra):
    return dict(id=id, title=title, body=block(start,end), **extra)
answers = {}
def question(number, kind, prompt, options, answer, **extra):
    id = extra.pop('id', f'l{number}')
    answers[id] = answer
    return dict(id=id, number=number, type=kind, prompt=prompt, options=options.copy(), **extra)
binary = ['Richtig', 'Falsch']
matching = ['0','B','C','D','E','F','G','H','I','J']
parts = []
q1 = []
for n in range(168,174):
    m = re.fullmatch(r'(\d+)\. (.+) \[(.+)\]', line(n))
    q1.append(question(int(m[1]), 'boolean', m[2], binary, m[3], textId='blog'))
parts.append(dict(id='lesen-1',title='TEIL 1 — BLOG',instruction=line(142).removeprefix('Instrucción: '),texts=[text('blog',line(144).removeprefix('Título: '),148,164)],questions=q1))

def mc(n, text_id=None, audio_id=None, id=None):
    m = re.fullmatch(r'(\d+)\. (.+)',line(n))
    options = [line(i)[3:] for i in range(n+1,n+4)]
    key = line(n+4).removeprefix('Respuesta: ').rstrip('.')
    extra = {}
    if text_id: extra['textId'] = text_id
    if audio_id: extra['audioId'] = audio_id
    if id: extra['id'] = id
    return question(int(m[1]),'choice',m[2],options,options[ord(key)-ord('a')],**extra)
parts.append(dict(id='lesen-2',title='TEIL 2 — ZEITUNGSARTIKEL',instruction='Lesen Sie die Texte und wählen Sie a, b oder c.',texts=[text('sportkurse','Neue Sportkurse für Jugendliche',181,189),text('bibliothek','Eine neue Bibliothek in Leipzig',211,219)],questions=[mc(n,'sportkurse' if n<210 else 'bibliothek') for n in [191,197,203,221,227,233]]))
ads=[]
for n in range(245,264,2):
    label, rest = line(n).split('. ',1)
    title, body = rest.split(' — ',1)
    # Keep the advertisement verbatim, including its original heading.
    ads.append(dict(id=f'anzeige-{label.lower()}',label=label,title=title,body=rest))
q3=[]
for n in range(272,279):
    m=re.fullmatch(r'(\d+)\. (.+) → (.+)',line(n))
    q3.append(question(int(m[1]),'matching',m[2],matching,m[3]))
parts.append(dict(id='lesen-3',title='TEIL 3 — ANZEIGEN',instruction=line(241).removeprefix('Instrucción: '),texts=ads,questions=q3,example=line(266)))
q4=[]; opinions=[]
for n in range(293,320,4):
    m=re.fullmatch(r'(\d+)\. (.+):',line(n))
    tid=f'meinung-{int(m[1])}'
    opinions.append(dict(id=tid,title=m[2],body=line(n+1)))
    q4.append(question(int(m[1]),'yesno',m[2]+':', ['Ja','Nein'],line(n+2).removeprefix('Respuesta: ').rstrip('.'),textId=tid))
parts.append(dict(id='lesen-4',title='TEIL 4 — MEINUNGEN',instruction=line(284)+'\n\n'+line(286).removeprefix('Instrucción: '),texts=opinions,questions=q4,example=block(290,291)))
parts.append(dict(id='lesen-5',title='TEIL 5 — HAUSORDNUNG',instruction='Lesen Sie die Hausordnung und wählen Sie a, b oder c.',texts=[text('hausordnung',line(323).removeprefix('Título: '),327,345)],questions=[mc(n,'hausordnung') for n in [347,353,359,365]]))
listening=[]; scripts={}
for i, (title_line,script_line,q_line,mc_line) in enumerate([(425,429,433,437),(443,447,451,455),(461,465,469,473),(479,483,487,491),(497,501,505,509)],1):
    aid=f'h{i}'
    scripts[aid]=line(script_line)
    m=re.fullmatch(r'(\d+)\. (.+)',line(q_line))
    first=question(int(m[1]),'boolean',m[2],binary,line(q_line+2).removeprefix('Respuesta: ').rstrip('.'),id=f'{aid}q1',audioId=aid)
    second=mc(mc_line,audio_id=aid,id=f'{aid}q2')
    listening.append(dict(audio=dict(id=aid,title=line(title_line).split(' — ',1)[1]),questions=[first,second]))
dictation=block(379,383)
fragments=re.findall(r'.+?(?:[.!?](?:\s+|$))',dictation,re.S)
assert ''.join(fragments)==dictation
level=dict(id='level-1',version='1.0.0',title='Level 1 — Die erste Prüfung',disclaimer='Simulacro pedagógico original inspirado en el formato del Goethe B1 y adaptado a A1–A2. No es un examen oficial ni una calificación certificadora Goethe.',schedule=[dict(id=id,title=title,minutes=minutes) for id,title,minutes in [('intro','Einführung',5),('lesen','Leseverstehen',50),('korrektur','Korrektur',8),('diktat','Diktat',15),('horen','Hörverstehen',22),('ergebnisse','Ergebnisse',5)]],reading=parts,listening=listening,dictation=dict(title='Mein Schultag',rubric=[line(n).split('. ',1)[1] for n in range(396,406)]),maxPoints=50)
secret=dict(answers=answers,scripts=scripts,dictation=dictation,dictationFragments=fragments)
out=Path(__file__).resolve().parents[1]/'server'/'road-content.ts'
out.write_text('// Original pedagogical adaptation, not an official Goethe examination.\n// Server-only: never import this module from browser code.\nimport type { RoadLevel, RoadSecret } from \'../shared/road.ts\';\n\nexport const ROAD_LEVEL: RoadLevel = '+json.dumps(level,ensure_ascii=False,indent=2)+';\n\nexport const ROAD_SECRET: RoadSecret = '+json.dumps(secret,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
print(json.dumps(dict(reading=[len(p['questions']) for p in parts],listening=len(listening),keys=len(answers),dictationFragments=len(fragments)),indent=2))
