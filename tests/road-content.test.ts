import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { RoadQuestion } from '../shared/road.ts';

const audioDir = new URL('../server/road-audio/', import.meta.url);
const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

// Frozen UTF-8 SHA-256 references independently extracted from the user's original
// synthetic exam specification. No dependency on that private prompt's local path.
const textDigests: Record<string, string> = {
  blog: 'c60a06fb6b260050660563206421dc36f08ec49154c5b829033e0ad781769892',
  sportkurse: '80b7c7c615e8a43ca64f9f8b253d745b78d358d5425a0dcee3bc4cedf5f94062',
  bibliothek: 'f8878503e96522465d82ce3f959ca53d7ebabb11e4540a022de70aed2f9210a2',
  hausordnung: 'b6833c6b9a5537e2604aa5662e4c1d85f85de70c7b841f235c56c3f65fb88a59',
  'anzeige-a': '79ec329599c5766ca19c296d46619725d24310918c3f3285df339664dd206135',
  'anzeige-b': '7f8943f69ad108b59b82493fa89a5bb6884a4b67ea7decc6841f430310a38d48',
  'anzeige-c': '8a94c2b45f2b93e3e17fe56d577086b1683e2e69518353136dcd2e1034c78868',
  'anzeige-d': '9ad13b01131f73ec7ab00411155a2f41c4c54adb550e66d555e7bce99974c39f',
  'anzeige-e': '4cc618bb829b6247c43dfe48ede941aa3e796d1a5d2a2ad2144558fa55e793e2',
  'anzeige-f': '77fdee8ff77228cf391ad23975bae5c49307a1db80da9b8e383a536886e2abc8',
  'anzeige-g': 'ad3df955d9b506e612fe8876afdf6a1195fb12f6807003c7ed5f2997b7760326',
  'anzeige-h': '84d93a619e8fd78176edf1ab8d43c22c98e6a8df6cee930b51ce56ea46041388',
  'anzeige-i': '2683cfa0bb1568df090f9592b0c6e5aeb118eed131ca1dc5afa4203ef0b155fb',
  'anzeige-j': 'fa122aa8df86bc99854b2aa432516256a8033de98ccc956ce10733920f7b60bc',
  'meinung-20': '1d6bb503ca07b8f71934399c56a87f972d8a990392516adc26f2888e54134ac6',
  'meinung-21': 'b281996407f9199576310659525962966ca65b0bb3b44c460507013875cb40bb',
  'meinung-22': '41de43f334e8c3242528505f7cc6a3fd4446a30e69d5106c97a58ee43c4a098e',
  'meinung-23': 'aade877d87e75030ba8b45d6637f49bbfbcd32305157c3dfe1ece5d836bd4452',
  'meinung-24': 'cdbad57a449ebc60ac62b82e95b55ee4686c9d2c6f3a37fb400babca1b38f85b',
  'meinung-25': '6ce7e96ba21550e9cdb38efbc2f46c929566b793b241ab28a20e3ca2a1dcfb2d',
  'meinung-26': '4e57c6c94a22ba6d8d0c687092926daf0310c990251928c609f8f9566ed37fb0',
};
const scriptDigests = {
  h1: '75db5049a9e9da5f0a6288553846d63230fe96917793271023c42c4a1d0d5eb4',
  h2: 'bcffe1769560bca6c2c4d76c9e6dcb3be3394d11de61dfd2c8dc83694d06a803',
  h3: '115775692dd18e38051f68291b4e51aab47b7e38e2cfc375241a60374c06d8e5',
  h4: '7c5f40c2d826d0cbec1bcbb07483c1825221210a9525c2c6a3798b6fe412b4f2',
  h5: '7909fe9528139fd1a500a3080ff94658272078d715e79aff1e0782ee067a5a77',
};

describe('Road to B1 original Level 1 content', () => {
  it('exports the complete versioned level and server-only correction key', async () => {
    const { ROAD_LEVEL, ROAD_SECRET } = await import('../server/road-content.ts');
    expect(ROAD_LEVEL.id).toBe('level-1');
    expect(ROAD_LEVEL.version).toBe('1.0.0');
    expect(ROAD_LEVEL.reading.map(p => p.questions.length)).toEqual([6, 6, 7, 7, 4]);
    expect(ROAD_LEVEL.reading.map(p => p.id)).toEqual(['lesen-1', 'lesen-2', 'lesen-3', 'lesen-4', 'lesen-5']);
    const reading = ROAD_LEVEL.reading.flatMap(p => p.questions);
    const hearing = ROAD_LEVEL.listening.flatMap(p => p.questions);
    expect(reading.map(q => q.id)).toEqual(Array.from({ length: 30 }, (_, i) => `l${i + 1}`));
    expect(reading.map(q => q.number)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    expect(ROAD_LEVEL.listening.map(p => p.audio.id)).toEqual(['h1', 'h2', 'h3', 'h4', 'h5']);
    expect(hearing.map(q => q.number)).toEqual(Array.from({ length: 10 }, (_, i) => i + 1));
    expect(hearing.map(q => q.id)).toEqual(Array.from({ length: 5 }, (_, i) => [`h${i + 1}q1`, `h${i + 1}q2`]).flat());
    expect(Object.keys(ROAD_SECRET.answers).sort()).toEqual([...reading, ...hearing].map(q => q.id).sort());
    for (const q of [...reading, ...hearing]) {
      expect(q.options.filter(o => o === ROAD_SECRET.answers[q.id])).toHaveLength(1);
      expect(new Set(q.options).size).toBe(q.options.length);
      if (q.type === 'boolean') expect(q.options).toEqual(['Richtig', 'Falsch']);
      if (q.type === 'yesno') expect(q.options).toEqual(['Ja', 'Nein']);
      if (q.textId) expect(ROAD_LEVEL.reading.flatMap(p => p.texts).some(t => t.id === q.textId)).toBe(true);
    }
    const matching = ROAD_LEVEL.reading[2];
    expect(matching.texts.map(t => t.label)).toEqual('ABCDEFGHIJ'.split(''));
    matching.questions.forEach(q => expect(q.options).toEqual(['0', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']));
    const matches = matching.questions.map(q => ROAD_SECRET.answers[q.id]);
    expect(new Set(matches).size).toBe(7);
    expect(matches.filter(a => a === '0')).toHaveLength(1);
    expect(matches).not.toContain('A');
    expect(matching.example).toBe('Sara möchte am Freitag um 17 Uhr Gitarre lernen. → A.');
    expect(ROAD_LEVEL.reading[3].example).toBe('Hanna: „Am Wochenende möchte ich frei haben. Die Schule ist von Montag bis Freitag. Hausaufgaben am Samstag oder Sonntag finde ich nicht gut.“\n→ Ja.');
    expect(ROAD_LEVEL.dictation.rubric).toEqual(['Montag', 'acht Uhr', 'Bus', 'Fahrrad', 'ersten Stunde', 'Deutsch', 'halb elf', 'Freunden', 'Hausaufgaben', 'Familie']);
    expect(ROAD_SECRET.dictationFragments).toHaveLength(9);
    expect(ROAD_SECRET.dictationFragments.join('')).toBe(ROAD_SECRET.dictation);
    expect(ROAD_LEVEL.maxPoints).toBe(50);
    expect(reading.length + hearing.length + ROAD_LEVEL.dictation.rubric.length).toBe(50);
    expect(ROAD_LEVEL.schedule.map(s => s.minutes)).toEqual([5, 50, 8, 15, 22, 5]);
    expect(ROAD_LEVEL.schedule.reduce((sum, s) => sum + s.minutes, 0)).toBe(105);
    const publicJson = JSON.stringify(ROAD_LEVEL);
    for (const text of [...Object.values(ROAD_SECRET.scripts), ROAD_SECRET.dictation]) expect(publicJson).not.toContain(text);
    expect(ROAD_LEVEL).not.toHaveProperty('answers');
    expect(ROAD_LEVEL).not.toHaveProperty('scripts');
  });

  it('preserves every original text, question, option and correction key exactly', async () => {
    const { ROAD_LEVEL, ROAD_SECRET } = await import('../server/road-content.ts');
    const texts = ROAD_LEVEL.reading.flatMap(p => p.texts);
    expect(Object.fromEntries(texts.map(t => [t.id, sha256(t.body)]))).toEqual(textDigests);
    expect(Object.fromEntries(Object.entries(ROAD_SECRET.scripts).map(([id, script]) => [id, sha256(script)]))).toEqual(scriptDigests);
    expect(sha256(ROAD_SECRET.dictation)).toBe('89a68ea53be22f123694b133c05428e95b9848710cd6eab177d0c44d3e704807');
    const fingerprint = (questions: RoadQuestion[]) => sha256(JSON.stringify(questions.map(q => [q.number, q.type, q.prompt, q.options, ROAD_SECRET.answers[q.id]])));
    expect(fingerprint(ROAD_LEVEL.reading.flatMap(p => p.questions))).toBe('5568784bbfeb45d7a765043fe4f2060f4cf277ba68a6df0749da20313075e9eb');
    expect(fingerprint(ROAD_LEVEL.listening.flatMap(p => p.questions))).toBe('91322c74df0f2fc34f951887acf6e21b756813379d4868b60fbd73fae4629367');
  });

  it('ships real private MP3 assets matching their exact synthetic scripts', async () => {
    const { ROAD_SECRET } = await import('../server/road-content.ts');
    expect(existsSync(new URL('manifest.json', audioDir))).toBe(true);
    const manifest = JSON.parse(readFileSync(new URL('manifest.json', audioDir), 'utf8'));
    const sources: Record<string, string> = { ...ROAD_SECRET.scripts, diktat: ROAD_SECRET.dictation };
    ROAD_SECRET.dictationFragments.forEach((text, i) => { sources[`diktat-${i + 1}`] = text; });
    expect(manifest.assets.map((a: { id: string }) => a.id).sort()).toEqual(Object.keys(sources).sort());
    for (const asset of manifest.assets) {
      const bytes = readFileSync(new URL(`${asset.id}.mp3`, audioDir));
      expect(bytes.length).toBeGreaterThan(1000);
      expect(asset.bytes).toBe(bytes.length);
      expect(asset.sha256).toBe(sha256(bytes));
      expect(asset.sourceSha256).toBe(sha256(sources[asset.id]));
      expect(asset.duration).toBeGreaterThan(1);
      expect(asset.codec).toBe('mp3');
      expect(asset.decoded).toBe(true);
      expect(asset.voice).toMatch(/^de-DE-(Katja|Conrad)Neural$/);
      expect(existsSync(new URL(`../../public/road-audio/${asset.id}.mp3`, audioDir))).toBe(false);
    }
  });
});
