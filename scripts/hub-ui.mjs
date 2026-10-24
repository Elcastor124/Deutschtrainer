import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { launch, sleep } from './cdp.mjs';
const env=await launch({shots:'shots/hub'});
try {
 const catalog=JSON.parse(readFileSync('public/presentaciones/catalogo.json','utf8'));
 const p=await env.newPage('hub',1366,768);
 await p.go('/');
 await p.until(`!!document.querySelector('a[href="/tema/1"]')`,'enlace tema 1');
 assert.match(await p.eval('document.body.innerText'),/Aprende alemán/);
 await p.until(`!document.querySelector('[data-intro]') && !document.querySelector('.dt-intro')`,'intro final',5000);
 await p.shot('hub-desktop');
 await p.click('a[href="/tema/1"]');
 await p.until(`document.querySelectorAll('a[href^="/presentaciones/"][href$=".html"]').length===8`,'ocho lecciones');
 await p.shot('tema1-desktop');
 const routes=await p.eval(`Array.from(document.querySelectorAll('a[href^="/presentaciones/"]')).map(a=>a.getAttribute('href'))`);
 for(const x of catalog){
  assert(routes.includes(x.file),x.file+' no está en el hub');
  const r=await fetch(env.base+x.file);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/text\/html/);
  const html=await r.text();assert(!html.includes('/src/main.tsx'));
  const deck=await env.newPage(x.id,1366,768);await deck.go(x.file);await deck.until('!!document.title','presentación');await sleep(300);
  assert.equal(deck.errors().length,0,JSON.stringify(deck.errors()));
  if(x.pdf){const pdf=await fetch(env.base+x.pdf);assert.match(pdf.headers.get('content-type'),/application\/pdf/);assert.equal((await pdf.text()).slice(0,4),'%PDF');}
 }
 const m=await env.newPage('hub-mobile',390,844,true);await m.go('/tema/1');
 await m.until(`document.querySelectorAll('a[href^="/presentaciones/"][href$=".html"]').length===8`,'catálogo móvil');
 assert(await m.eval('document.documentElement.scrollWidth<=innerWidth+1'),'desborde horizontal móvil');await m.shot('tema1-mobile');
 await p.go('/jugar');await p.until(`!!document.querySelector('input[aria-label="Código de sala"]')`,'lobby conservado');
 await p.go('/?sala=TEST');await p.until(`!!document.querySelector('input[aria-label="Código de sala"]')`,'invitación conservada');
 await p.go('/practica?tema=1');await p.until(`!!document.querySelector('input.field')`,'práctica');
 assert.match(await p.eval('document.body.innerText'),/práctica|practica/i);
 await p.type('input.field','QA Hub');await p.eval(`document.querySelector('form').requestSubmit()`);
 await p.until(`!!document.querySelector('#my-score')`,'práctica conectada',15000);
 assert.equal(p.errors().length,0,JSON.stringify(p.errors()));
 console.log(JSON.stringify({ok:true,presentaciones:catalog.length,pdfs:catalog.filter(x=>x.pdf).length,routes:['/','/tema/1','/jugar','/?sala=TEST','/practica?tema=1'],mobileOverflow:false,practiceConnected:true}));
} finally {await env.close();}
