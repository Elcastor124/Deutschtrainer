import assert from 'node:assert/strict';
import {launch} from './cdp.mjs';
const env=await launch({shots:'shots/road-layout'});
try{
 const post=async(p,b,t)=>(await fetch(env.base+'/api/road/'+p,{method:'POST',headers:{'Content-Type':'application/json',...(t?{Authorization:'Bearer '+t}:{})},body:JSON.stringify(b)})).json();
 const t=await post('create',{levelId:'level-1'});const a=await post('join',{code:t.code,name:'Layout QA'});await post('action',{code:t.code,action:{type:'section',section:'lesen'}},t.token);
 const p=await env.newPage('layout',1366,768);await p.go('/road-to-b1');await p.until(`!!document.querySelector('[data-road-create]')`,'landing');await p.eval(`localStorage.setItem('dt:road:player:${a.code}',JSON.stringify(${JSON.stringify(a)}));true`);await p.go('/road-to-b1/level-1?code='+a.code);await p.until(`!!document.querySelector('.road-reading')`,'reading');
 const m=await p.eval(`({textTop:document.querySelector('.road-reading').getBoundingClientRect().top,titleHeight:document.querySelector('.road>.stack .home-title').getBoundingClientRect().height,overflow:document.documentElement.scrollWidth>innerWidth})`);await p.shot('chromebook-fold');assert.ok(m.textTop<650,JSON.stringify(m));assert.ok(m.titleHeight<80,JSON.stringify(m));assert.equal(m.overflow,false);console.log(JSON.stringify({ok:true,...m}));
}finally{await env.close()}
