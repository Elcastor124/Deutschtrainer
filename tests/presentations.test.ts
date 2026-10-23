import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..');
const entries=JSON.parse(readFileSync(resolve(root,'public/presentaciones/catalogo.json'),'utf8')) as {id:string;title:string;file:string;pdf?:string;topics:string[];sha256:string}[];
describe('Biblioteca de presentaciones',()=>{
 it('incluye siete versiones actuales y cuatro PDF, sin backups',()=>{
  expect(entries).toHaveLength(7);expect(entries.filter(e=>e.pdf)).toHaveLength(4);
  expect(new Set(entries.map(e=>e.id)).size).toBe(entries.length);
  expect(entries.some(e=>/backup|original|90min/i.test(e.file))).toBe(false);
 });
 for(const e of entries) it(e.id+' tiene HTML íntegro y recursos locales empaquetados',()=>{
  expect(e.file.startsWith('/presentaciones/')).toBe(true);
  const data=readFileSync(resolve(root,'public'+e.file));
  expect(createHash('sha256').update(data).digest('hex')).toBe(e.sha256);
  const html=data.toString('utf8');expect(html).toMatch(/<html/i);expect(html).toMatch(/<script/i);
  expect(html).not.toMatch(/(?:ghp_|github_pat_|sk-proj-)[A-Za-z0-9_]{15,}/);
  if(e.pdf){expect(existsSync(resolve(root,'public'+e.pdf))).toBe(true);expect(readFileSync(resolve(root,'public'+e.pdf)).subarray(0,4).toString()).toBe('%PDF');}
 });
});
