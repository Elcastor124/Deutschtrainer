// Presentaciones escritas directamente en public/presentaciones (no importadas de ../*.html):
// calcula su huella SHA-256 (con saltos LF, como exige tests/presentations.test.ts) y las inserta o actualiza en catalogo.json
// sin tocar el resto de entradas. Uso: node scripts/catalog-native.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
const dir = resolve(import.meta.dirname, '../public/presentaciones');
const NATIVE = [{
  id: 'drei-regeln', unit: 8, minutes: 75, title: 'Drei Regeln, ein Satz',
  description: 'Possessivartikel, Modalverben und trennbare Verben.',
  topics: ['Possessivartikel', 'Modalverben', 'Trennbare Verben', 'Satzbau'], level: 'A1–A2', source: 'drei-regeln.html (escrita en el repositorio)',
}];
const file = join(dir, 'catalogo.json');
const crlf = readFileSync(file, 'utf8').includes('\r\n');
const catalog = JSON.parse(readFileSync(file, 'utf8'));
for (const e of NATIVE) {
  const path = join(dir, e.id + '.html');
  const html = readFileSync(path, 'utf8').replace(/\r\n?/g, '\n');
  if (/(?:ghp_|github_pat_|sk-proj-)[A-Za-z0-9_]{15,}/.test(html)) throw new Error('Posible credencial en ' + e.id);
  writeFileSync(path, html);
  const item = { id: e.id, unit: e.unit, title: e.title, description: e.description, file: `/presentaciones/${e.id}.html`, topics: e.topics, level: e.level, minutes: e.minutes, source: e.source, sha256: createHash('sha256').update(html).digest('hex') };
  const i = catalog.findIndex((c) => c.id === e.id);
  if (i >= 0) catalog[i] = item; else catalog.push(item);
}
const out = JSON.stringify(catalog, null, 2) + '\n';
writeFileSync(file, crlf ? out.replace(/\n/g, '\r\n') : out);
console.log(JSON.stringify({ presentaciones: catalog.length, nativas: NATIVE.map((e) => e.id) }));
