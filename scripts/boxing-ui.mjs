import assert from 'node:assert/strict';
import { launch, sleep } from './cdp.mjs';
import { BOXING_BANK } from '../server/boxing-bank.ts';
const env=await launch({shots:'shots/boxing'});
const bank=Array.isArray(BOXING_BANK)?BOXING_BANK:Object.values(BOXING_BANK);
try {
 const T=await env.newPage('profesor',1366,768),A=await env.newPage('jugador-a',1366,768),B=await env.newPage('jugador-b',390,844,true);
 await T.go('/');
 await T.until('!!document.querySelector("[aria-labelledby=boxing-title] a[href=\\"/boxeo\\"]")','actividad de repaso en portada');
 await T.click('[aria-labelledby=boxing-title] a[href="/boxeo"]');
 for(const p of [A,B])await p.go('/boxeo');
 await T.until('!!document.querySelector("[data-box-create]")','crear combate');await T.click('[data-box-create]');
 await T.until('!!document.querySelector("[data-box-room]")','código');
 const code=(await T.eval('document.querySelector("[data-box-room]").textContent')).trim();
 for(const [p,name] of [[A,'Ana'],[B,'Tomás']]){
  await p.until('!!document.querySelector("[data-box-name]")','formulario alumno');
  await p.type('[data-box-name]',name);await p.type('[data-box-code]',code);await p.click('[data-box-join]');
  await p.until('!!document.querySelector("[data-box-phase=lobby]")','jugador conectado');
 }
 await T.until('!document.querySelector("[data-box-control=start]").disabled','dos alumnos');await T.shot('lobby');
 await T.click('[data-box-control=start]');
 const phase=async(p,w)=>p.until(`!!document.querySelector('[data-box-phase="${w}"]')`,w,12000);
 const answer=async(p,correct=true)=>{
  await phase(p,'question');
  await p.until(`!!document.querySelector('[data-box-option]:not(:disabled)')`,'opciones habilitadas después de la pausa',12000);
  const s=await p.eval(`Array.from(document.querySelectorAll('[data-box-option]')).map(x=>x.textContent)`);
  const prompt=await p.eval(`document.querySelector('[data-box-prompt]')?.textContent||document.body.innerText`);
  const q=bank.find(q=>prompt.includes(q.prompt));assert(q,'pregunta del banco encontrada');
  let i=q.answer;if(!correct)i=q.options.findIndex((_,k)=>k!==q.answer);
  assert(i>=0&&i<s.length);await p.click('[data-box-option="'+i+'"]');
 };
 const sessions=[];
 for(const [am,bm] of [['jab','guard'],['hook','dodge'],['cross','jab']]){
  await answer(A);await answer(B);await phase(A,'action');await phase(B,'action');
  await A.click('[data-box-move="'+am+'"]');await B.click('[data-box-move="'+bm+'"]');
  await phase(T,'result');await phase(A,'result');await phase(B,'result');
  await T.shot('result-'+am+'-'+bm);sessions.push([am,bm]);
  await T.click('[data-box-control=next]');
 }
 await phase(T,'question');await T.click('[data-box-control=pause]');
 await A.until('document.body.innerText.includes("Pausa")||document.body.innerText.includes("pausa")','pausa');
 await T.click('[data-box-control=resume]');await answer(A,false);await answer(B,true);await phase(B,'action');await B.click('[data-box-move=jab]');await phase(T,'result');
 const before=await A.eval('document.body.innerText');await A.reload();await phase(A,'result');assert((await A.eval('document.body.innerText')).includes('Ana'));
 await T.click('[data-box-control=next]');await answer(A,false);await answer(B,false);await phase(T,'result');
 for(let k=0;k<10;k++){
  const finished=await T.eval('!!document.querySelector("[data-box-phase=finished]")');if(finished)break;
  await T.click('[data-box-control=next]');
  const f=await T.eval('!!document.querySelector("[data-box-phase=finished]")');if(f)break;
  await phase(T,'question');await T.click('[data-box-control=reveal]');await sleep(500);
 }
 await phase(T,'finished');await T.shot('finished');
 assert(await B.eval('document.documentElement.scrollWidth<=innerWidth+1'),'sin desborde horizontal móvil');await B.shot('mobile-finished');
 const errors=[...T.errors(),...A.errors(),...B.errors()];assert.equal(errors.length,0,JSON.stringify(errors));
 console.log(JSON.stringify({ok:true,clients:3,realUi:true,moves:sessions,wrongAnswerRecovery:true,pause:true,reload:true,finish:true,mobileOverflow:false,consoleErrors:0}));
} finally {await env.close();}
