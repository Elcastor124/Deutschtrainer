import { describe,it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..');
describe('Integración del combate final de Mission Stadt',()=>{
 it('conecta la ruta de boxeo sin reemplazar las salas existentes',()=>{
  const app=readFileSync(resolve(root,'src/App.tsx'),'utf8');
  expect(app).toContain('<Boxing');expect(app).toContain('boxeo');expect(app).toContain('<Teacher');
 });
 it('envía las peticiones de boxeo al motor autoritativo antes del cliente estático',()=>{
  const server=readFileSync(resolve(root,'server/index.ts'),'utf8');
  expect(server).toContain('createBoxingHandler');
  expect(server.indexOf('boxingHandler(req, res)')).toBeLessThan(server.indexOf("url.pathname === '/api/info'"));
 });
});
