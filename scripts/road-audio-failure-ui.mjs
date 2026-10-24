import assert from 'node:assert/strict';
import {launch,sleep} from './cdp.mjs';
const env=await launch({shots:'shots/road-audio-failures'});
const T=await env.newPage('audio-teacher',1366,768),A=await env.newPage('audio-pupil',1366,768);
const post=async(path,body,token)=>(await fetch(env.base+'/api/road/'+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)})).json();
let pauseSafe=false,retriesSafe=false;
try{
 const teacher=await post('create',{levelId:'level-1'}),player=await post('join',{code:teacher.code,name:'Audio recovery QA'});
 for(const [p,s]of[[T,teacher],[A,player]]){await p.go('/road-to-b1');await p.until(`!!document.querySelector('[data-road-create]')`,'landing');await p.eval(`localStorage.setItem('dt:road:${s.role}:${s.code}',JSON.stringify(${JSON.stringify(s)}));true`);await p.go('/road-to-b1/level-1?code='+s.code+(s.role==='teacher'?'&view=teacher':''));await p.until(`!!document.querySelector('[data-road-section="intro"]')`,'session');}
 await T.click('[data-road-section-nav="horen"]');await A.until(`!!document.querySelector('[data-road-play="h1"]')`,'listening');
 await A.eval(`window.__played=[];window.__nativeFetch=window.fetch.bind(window);const oldPlay=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){window.__played.push(this);return oldPlay.call(this)};window.fetch=async(...args)=>{const response=await window.__nativeFetch(...args);if(String(args[0]).includes('/api/road/audio?')){const blob=response.blob.bind(response);response.blob=async()=>{const b=await blob();await new Promise(r=>window.__releaseAudio=r);return b;};}return response};true`);
 await A.click('[data-road-play="h1"]');await A.until(`typeof window.__releaseAudio==='function'`,'audio body pending');
 await T.click('[data-road-pause]');await A.until(`document.querySelector('.road-board > .panel').textContent.includes('Pause')`,'pause propagated');await A.eval('window.__releaseAudio();true');await sleep(800);
 pauseSafe=await A.eval('window.__played.every(x=>x.paused)');
 await A.shot('paused-during-loading');
 await T.click('[data-road-pause]');await A.until(`document.querySelector('.road-board > .panel').textContent.includes('Unterricht läuft')`,'resume propagated');
 await A.eval(`window.fetch=window.__nativeFetch;window.__played.forEach(x=>x.pause());true`);
 await A.click('[data-road-audio-tab="h2"]');
 await A.eval(`window.__fault=0;window.fetch=async(...args)=>{const path=String(args[0]);const response=await window.__nativeFetch(...args);if(path==='/api/road/action'&&JSON.parse(args[1]?.body||'{}').action?.type==='listen'&&window.__fault===0){window.__fault=1;throw Error('QA lost listen response');}if(path.includes('/api/road/audio?')&&window.__fault===1){window.__fault=2;response.blob=async()=>{throw Error('QA interrupted audio body');};}return response};true`);
 await A.click('[data-road-play="h2"]');await A.until(`document.querySelector('[role="alert"]')?.textContent.includes('QA lost')`,'lost response reported');
 await A.until(`!document.querySelector('[data-road-play="h2"]').disabled`,'first retry enabled');await A.click('[data-road-play="h2"]');
 await A.until(`document.querySelector('[role="alert"]')?.textContent.includes('QA interrupted')`,'body interruption reported');
 const response=await fetch(env.base+'/api/road/state?code='+player.code,{headers:{Authorization:'Bearer '+player.token}});const view=await response.json();
 retriesSafe=view.listens.h2===1 && await A.eval(`!document.querySelector('[data-road-play="h2"]').disabled`);
 if(retriesSafe){await A.click('[data-road-play="h2"]');await A.until(`window.__played.at(-1)?.currentTime>0`,'third attempt recovers actual sound',12000);}
 await A.shot('recovered-audio');
 assert.equal(pauseSafe,true,'audio started while the class was paused');assert.equal(retriesSafe,true,'network failures consumed two listening attempts');
 assert.equal(A.errors().length,0);assert.equal(T.errors().length,0);console.log(JSON.stringify({ok:true,pauseDuringPendingBody:pauseSafe,lostActionResponse:true,interruptedBody:true,singleLogicalAttempt:retriesSafe,realPlaybackRecovered:true}));
}finally{console.log(JSON.stringify({pauseSafe,retriesSafe}));await env.close()}
