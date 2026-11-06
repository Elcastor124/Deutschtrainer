"""Builds server/horen/content-001.ts from the teacher's spec (server/horen/spec-001.md).

python scripts/horen-build-content.py

The spec is the single source of truth: questions, options, transcripts and the answer key are
parsed verbatim, never retyped. Evidence sentences (shown only after the exam) must appear
literally in the transcript of the matching audio, and every key must be one of the options;
the build fails otherwise. Output is server-only: never import it from src/.
"""
import hashlib, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT / 'server' / 'horen' / 'spec-001.md'
OUT = ROOT / 'server' / 'horen' / 'content-001.ts'

# Speaker → Edge TTS voice. Voices are distinct within every dialogue; the boy/girl roles get
# the lighter voices. Monologues keep one consistent voice per person.
VOICES = {
    'Mädchen': ('de-DE-AmalaNeural', '+0Hz'), 'Mann': ('de-DE-ConradNeural', '+0Hz'),
    'Mutter': ('de-DE-KatjaNeural', '+0Hz'), 'Junge': ('de-DE-KillianNeural', '+0Hz'),
    'Verkäuferin': ('de-DE-SeraphinaMultilingualNeural', '+0Hz'), 'Trainer': ('de-DE-ConradNeural', '+0Hz'),
    'Lukas': ('de-DE-KillianNeural', '+0Hz'), 'Lehrerin': ('de-DE-KatjaNeural', '+0Hz'),
    'Emma': ('de-DE-AmalaNeural', '+0Hz'), 'Mia': ('de-DE-AmalaNeural', '+0Hz'),
    'Vater': ('de-DE-FlorianMultilingualNeural', '+0Hz'), 'Anna': ('de-DE-AmalaNeural', '+0Hz'),
    'Ben': ('de-DE-KillianNeural', '+0Hz'), 'Nora': ('de-DE-SeraphinaMultilingualNeural', '+0Hz'),
    'Mila': ('de-DE-AmalaNeural', '+0Hz'), 'Jonas': ('de-DE-KillianNeural', '+0Hz'),
    'Ece': ('de-DE-SeraphinaMultilingualNeural', '+0Hz'), 'Luis': ('de-DE-FlorianMultilingualNeural', '+0Hz'),
    'Lea': ('de-DE-KatjaNeural', '+0Hz'), 'Tim': ('de-DE-ConradNeural', '+0Hz'),
    'Sprecher': ('de-DE-FlorianMultilingualNeural', '+0Hz'),
}

# Sentences quoted in the post-exam review. Each must occur literally in its audio's transcript.
EVIDENCE = {
    1: ['Der nächste Bus fährt um zwanzig nach acht.', 'Der Bus um zehn nach acht ist leider schon weg.'],
    2: ['Nein, die gehört meinem Bruder. Meine Jacke ist rot.', 'Ach ja! Deine rote hängt an der Tür.'],
    3: ['Aber Apfelsaft haben wir heute leider nicht mehr.', 'Hm, nein. Dann nehme ich lieber eine Flasche Wasser.'],
    4: ['Nein, mir geht es gut. Aber meine kleine Schwester hat einen Arzttermin.', 'Deshalb muss ich mit meiner Schwester zum Arzt gehen.'],
    5: ['Wir beginnen nur etwas später, nämlich um halb fünf.', 'Um halb fünf? Also um sechzehn Uhr dreißig?'],
    6: ['Samstags öffnet sie um neun Uhr und schließt schon um dreizehn Uhr.', 'Dann gehen wir am besten am Samstagmorgen.'],
    7: ['Am Samstag bin ich erst um neun Uhr aufgestanden.'],
    8: ['Obwohl es geregnet hat, wollten wir nicht nach Hause gehen.'],
    9: ['Sein Fahrrad war kaputt. Wir haben zusammen das Fahrrad repariert.'],
    10: ['Wir haben ihn gar nicht gesehen!', 'Als wir die Karten kaufen wollten, war der Film schon ausverkauft.'],
    11: ['Wir sind ins Schwimmbad gegangen. Dort waren wir ungefähr zwei Stunden.'],
    12: ['Meine Mathehausaufgaben habe ich schon am Samstagabend gemacht.', 'Die Deutschhausaufgaben habe ich noch nicht gemacht.'],
    13: ['Bitte seid um Viertel vor neun dort.'],
    14: ['Wir treffen uns nicht am Bahnhof und auch nicht direkt am Museum, sondern vor dem Haupteingang unserer Schule.'],
    15: ['Von dort fahren wir mit der Straßenbahn zum Museum.'],
    16: ['Bitte vergesst außerdem euren Schülerausweis nicht.'],
    17: ['Unsere Schule bezahlt den Eintritt für alle Schülerinnen und Schüler.'],
    18: ['Wenn das Wetter schön ist, gehen wir in den Park neben dem Museum und machen dort ein Picknick.'],
    19: ['Am liebsten gehe ich mit meiner Kamera durch die Stadt oder in den Park.', 'Besonders gern mache ich Bilder, wenn die Sonne untergeht.'],
    20: ['Ich spiele Basketball in einem Sportverein.'],
    21: ['Jetzt spiele ich schon seit drei Jahren Klavier.'],
    22: ['Sie zeigt mir, wie man verschiedene Gerichte zubereitet.', 'Am liebsten mache ich Pizza oder Nudeln mit Tomatensoße.'],
    23: ['Zusammen mit anderen Jugendlichen helfe ich den Mitarbeitern.', 'Ich finde diese Arbeit wichtig, weil die Tiere unsere Hilfe brauchen.'],
    24: ['Oft sitze ich an meinem Schreibtisch und mache Bilder von Autos, Gebäuden oder Landschaften.'],
    25: ['Meine Cousine Sophie wohnt in Leipzig und hatte Geburtstag.'],
    26: ['Dort konnte ich eine neue Fahrkarte kaufen.', 'Als ich endlich meine Fahrkarte hatte, war mein Zug schon abgefahren.'],
    27: ['Der fuhr erst um halb zehn.'],
    28: ['„Nein, dieser Zug fährt direkt nach Leipzig. Du musst nicht umsteigen.“'],
    29: ['Das Restaurant war an diesem Samstag geschlossen.', '„Komm, wir gehen zu mir nach Hause und kochen zusammen!“'],
    30: ['Am Abend haben wir Brettspiele gespielt.'],
}

# Short spoken section instructions (step 1 of every part), taken from the spec's own part
# instructions. They do not contain titles, numbers, labels or solutions.
SPOKEN_INSTRUCTIONS = {
    1: 'Du hörst sechs kurze Gespräche aus dem Alltag. Wähle die richtige Antwort. Lies jetzt die Aufgaben.',
    2: 'Du hörst ein Gespräch zwischen Anna und Ben. Sind die Aussagen richtig oder falsch? Lies jetzt die Aufgaben.',
    3: 'Du hörst eine Lehrerin. Sie gibt Informationen über einen Schulausflug. Wähle die richtige Antwort. Lies jetzt die Aufgaben.',
    4: 'Du hörst sechs Jugendliche. Sie sprechen über ihre Freizeit. Welches Hobby passt zu welcher Person? Zwei Möglichkeiten bleiben übrig. Lies jetzt die Aufgaben.',
    5: 'Du hörst einen längeren Bericht von Nora. Sie erzählt von einem Samstag, an dem nicht alles nach Plan gelaufen ist. Lies die Fragen zuerst.',
}


def fail(msg):
    print('ERROR:', msg, file=sys.stderr)
    sys.exit(1)


def main():
    raw = SPEC.read_bytes()
    src = raw.decode('utf-8').replace('\r\n', '\n')
    qpart, rest = src.split('# AUDIO-TRANSKRIPTE')
    audio_part, key_part = rest.split('# LÖSUNGSSCHLÜSSEL')
    general = [l.strip() for l in re.search(r'### Allgemeine Anweisungen\n(.*?)---', qpart, re.S)[1].splitlines() if l.strip()]

    parts = []
    for m in re.finditer(r'^# TEIL (\d) — (.+?)\n(.*?)(?=^# TEIL |\Z)', qpart, re.S | re.M):
        n, title, body = int(m[1]), m[2].strip(), m[3]
        head = body.split('### Aufgabe')[0]
        meta = re.search(r'\*\*Aufgaben (\d+)–(\d+) · (\d+) Minuten\*\*', head)
        if not meta: fail(f'Teil {n}: missing Aufgaben/Minuten line')
        instruction = [l.strip() for l in head.splitlines() if l.strip() and not l.startswith('**') and not l.startswith('---') and not re.match(r'^[A-H]\) ', l)]
        bank = [{'id': k, 'text': t.strip()} for k, t in re.findall(r'^([A-H])\) (.+)$', head, re.M)]
        questions = []
        for qm in re.finditer(r'### Aufgabe (\d+)\n(.*?)(?=### Aufgabe|\Z)', body, re.S):
            num, b = int(qm[1]), qm[2].replace('---', '').strip()
            prompt = b.splitlines()[0].strip().strip('*').strip()
            opts = re.findall(r'^([ABC])\) (.+)$', b, re.M)
            if opts:
                questions.append({'id': f'q{num}', 'number': num, 'type': 'choice', 'prompt': prompt, 'options': [{'id': k, 'text': t.strip()} for k, t in opts]})
            elif '- Richtig' in b and '- Falsch' in b:
                questions.append({'id': f'q{num}', 'number': num, 'type': 'truefalse', 'prompt': prompt, 'options': [{'id': 'Richtig', 'text': 'Richtig'}, {'id': 'Falsch', 'text': 'Falsch'}]})
            elif bank:
                questions.append({'id': f'q{num}', 'number': num, 'type': 'matching', 'prompt': prompt, 'options': bank})
            else:
                fail(f'Aufgabe {num}: unknown type')
        if [q['number'] for q in questions] != list(range(int(meta[1]), int(meta[2]) + 1)): fail(f'Teil {n}: numbering')
        part = {'id': f'teil{n}', 'n': n, 'title': title, 'minutes': int(meta[3]), 'instruction': instruction, 'audioId': f'a{n}', 'questions': questions}
        if bank: part['bank'] = bank
        parts.append(part)

    scripts = {}
    for m in re.finditer(r'^## AUDIO (\d) — (.+?)\n(.*?)(?=^## AUDIO |\Z)', audio_part, re.S | re.M):
        n, body = int(m[1]), m[3]
        body = re.split(r'\n---\s*\n', body)[0] if n < 5 else body.split('\n---')[0]
        segments, label, turns, who = [], None, [], None
        def flush():
            if turns: segments.append({'label': label, 'turns': list(turns)})
        for line in body.splitlines():
            l = line.strip()
            if not l: continue
            if l.startswith('### '):
                flush(); turns.clear(); label = l[4:].strip(); who = None
                pm = re.match(r'Person \d+ — (\w+)', label)
                if pm: who = pm[1]
                continue
            sm = re.match(r'^\*\*(.+?):\*\*\s*(.*)$', l)
            if sm:
                who = sm[1]
                if sm[2]: turns.append({'speaker': who, 'text': sm[2]})
            else:
                if who is None: fail(f'Audio {n}: text without speaker: {l[:40]}')
                turns.append({'speaker': who, 'text': l})
        flush()
        for s in segments:
            for t in s['turns']:
                if t['speaker'] not in VOICES: fail(f'No voice for {t["speaker"]}')
                if re.search(r'\*\*|^#|Aufgabe|Lösung', t['text']): fail(f'Non-spoken markup in audio {n}: {t["text"][:40]}')
                t['voice'], t['pitch'] = VOICES[t['speaker']]
        # Dialogue: neighbouring turns must have different voices (so students can tell them apart).
        for s in segments:
            for a, b in zip(s['turns'], s['turns'][1:]):
                if a['speaker'] != b['speaker'] and a['voice'] == b['voice']: fail(f'Audio {n}: {a["speaker"]}/{b["speaker"]} share a voice')
        scripts[f'a{n}'] = segments
    if sorted(scripts) != [f'a{i}' for i in range(1, 6)]: fail('expected five audio blocks')

    key = {int(a): b for a, b in re.findall(r'^\| (\d+) \| (\w+) \|$', key_part, re.M)}
    if sorted(key) != list(range(1, 31)): fail('answer key must list 1–30')
    answers, evidence = {}, {}
    for p in parts:
        flat = ' '.join(t['text'] for s in scripts[p['audioId']] for t in s['turns'])
        for q in p['questions']:
            k = key[q['number']]
            if k not in [o['id'] for o in q['options']]: fail(f'Key {q["number"]}={k} not an option')
            answers[q['id']] = k
            for e in EVIDENCE[q['number']]:
                if e not in flat: fail(f'Evidence for {q["number"]} not in {p["audioId"]}: {e}')
            evidence[q['id']] = EVIDENCE[q['number']]
    matching = [answers[q['id']] for p in parts for q in p['questions'] if q['type'] == 'matching']
    if len(set(matching)) != len(matching): fail('matching keys must be distinct')

    budget = [{'id': p['id'], 'minutes': p['minutes']} for p in parts] + [{'id': 'review', 'minutes': 3}]
    if sum(b['minutes'] for b in budget) != 60: fail('timing must total 60 minutes')

    exam = {
        'id': 'horen-001', 'version': '1.0.0', 'title': 'Hörverstehen 001', 'subtitle': 'Prüfungssimulation · A1+/A2',
        'disclaimer': 'Übung im Stil des DSD I, an A1–A2 angepasst. Kein offizieller DSD-Test, keine Zertifizierung.',
        'general': general, 'reviewMinutes': 3, 'maxPoints': len(answers), 'parts': parts,
    }
    secret = {'answers': answers, 'evidence': evidence, 'scripts': scripts, 'spokenInstructions': {f'i{n}': t for n, t in SPOKEN_INSTRUCTIONS.items()}}
    digest = hashlib.sha256(raw).hexdigest()
    ts = ('// GENERATED by scripts/horen-build-content.py from server/horen/spec-001.md — do not edit by hand.\n'
          '// SERVER ONLY: answer keys and transcripts. Never import from src/ (browser bundle).\n'
          "import type { HorenExam, HorenSecret } from '../../shared/horen.ts';\n"
          f"export const HOREN_SPEC_SHA256 = '{digest}';\n"
          f'export const HOREN_EXAM: HorenExam = {json.dumps(exam, ensure_ascii=False, indent=1)};\n'
          f'export const HOREN_SECRET: HorenSecret = {json.dumps(secret, ensure_ascii=False, indent=1)};\n')
    OUT.write_text(ts, encoding='utf-8', newline='\n')
    print(f'parts={len(parts)} questions={len(answers)} audios={len(scripts)} turns={sum(len(s["turns"]) for v in scripts.values() for s in v)} spec={digest[:12]}')


if __name__ == '__main__':
    main()
