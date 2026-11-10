import assert from 'node:assert/strict';
import { studentPlus } from '../tests/helpers/plus-browser.mjs';
import {launch} from './cdp.mjs';
const env=await launch({shots:'shots/progress',...(process.env.BASE?{base:process.env.BASE}:{})});
try {
 const p=await env.newPage('points',1366,768);
 // Practicar exige cuenta (plan Free con límite diario): cuenta de prueba con Plus. Ver docs/test-contract-notes.md.
 await p.go('/?intro=0'); await studentPlus(p, env.base);
 await p.go('/practica?temas=dativ');
 await p.until(`!!document.querySelector('form .btn.primary.lg:not(:disabled)')`,'practice');
 await p.eval(`document.querySelector('form').requestSubmit()`);
 await p.until(`globalThis.__bcNet?.state?.view?.phase==='question'`,'question');
 await p.eval(`globalThis.__bcNet.request({t:'answer',qid:globalThis.__bcNet.state.view.q.id,a:{choice:0,text:'x',gaps:['x'],order:[],index:0,fix:'x',pairs:[]}})`);
 await p.until(`globalThis.__bcNet.state.view.phase==='reveal'`,'graded');
 // Con cuenta (practicar ya la exige) el progreso va a la cuenta, no al perfil del dispositivo.
 const r=await p.eval(`fetch('/api/account/progress',{headers:{'x-student-session':'cookie'}}).then(x=>x.json())`);
 assert(r.weekPoints>0); assert.equal(r.topics.length,1);assert.equal(r.topics[0].topic,'dativ');
 await p.go('/');
 await p.until(`Number(document.querySelector('[data-points]')?.dataset.points)>0`,'actual points widget',15000);
 await p.eval(`document.querySelector('[data-points]').scrollIntoView({block:'center'})`);
 await p.shot('weekly-live');
 assert.equal(p.errors().length,0,JSON.stringify(p.errors()));
 console.log(JSON.stringify({ok:true,weekPoints:r.weekPoints,topic:'dativ',widget:true,realServerAnswer:true}));
}finally{await env.close();}
