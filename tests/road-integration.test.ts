import { describe,it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..');
const source=(p:string)=>readFileSync(resolve(root,p),'utf8');
describe('Road to B1 integration',()=>{
 it('mounts authoritative API before static and old routes',()=>{
  const s=source('server/index.ts');
  expect(s).toContain("import { createRoadHandler } from './road.ts'");
  expect(s).toContain('if (roadHandler(req, res)) return;');
  expect(s.indexOf('if (roadHandler(req, res)) return;')).toBeLessThan(s.indexOf("if (url.pathname === '/api/health')"));
 });
 it('mounts Road inside the existing application and exposes it from the hub and study navigation',()=>{
  expect(source('src/App.tsx')).toContain('<Road />');
  // La navegación genera sus enlaces desde una lista; la portada es ahora la landing de marca.
  expect(source('src/components/LearningNav.tsx')).toContain("href: '/road-to-b1'");
  expect(source('src/views/Landing.tsx')).toContain('href="/road-to-b1"');
  expect(source('src/views/TopicOne.tsx')).toContain('<RoadActivity />');
 });
 it('keeps examination secrets out of browser imports',()=>{
  for(const p of ['src/App.tsx','src/views/Road.tsx','src/road-client.ts']) {
   const s=source(p);expect(s).not.toContain('server/road-content');expect(s).not.toContain('ROAD_SECRET');
  }
 });
});
