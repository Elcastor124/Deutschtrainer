// Real Chromium/Edge exam flow: private teacher, two pupils and a read-only projector.
import assert from 'node:assert/strict';
import { launch, sleep } from './cdp.mjs';
import { ROAD_LEVEL, ROAD_SECRET } from '../server/road-content.ts';

const env=await launch({shots:'shots/road',...(process.env.ROAD_BASE?{base:process.env.ROAD_BASE}:{})});
const T=await env.newPage('road-teacher',1600,900);
const A=await env.newPage('road-chromebook',1366,768);
const B=await env.newPage('road-mobile',390,844,true);
const P=await env.newPage('road-projector',1366,768);
const pages=[T,A,B,P];
const getSession=async(p,role)=>p.eval(`(()=>{for(let i=0;i<localStorage.length;i++){try{const x=JSON.parse(localStorage.getItem(localStorage.key(i)));if(x?.token&&x.role===${JSON.stringify(role)})return x}catch{}}throw Error('No session for role')})()`);
const state=async(p,role)=>{
 const s=await getSession(p,role);
 return p.eval(`fetch('/api/road/state?code='+${JSON.stringify(s.code)},{headers:{Authorization:'Bearer '+${JSON.stringify(s.token)}}}).then(r=>r.json())`);
};
const goSection=async(id)=>{await T.click(`[data-road-section-nav="${id}"]`);for(const p of pages){await p.until(`!!document.querySelector('[data-road-section="${id}"]')`,'section '+id,12000);await noOverflow(p)}};
const noOverflow=async(p)=>assert.equal(await p.eval('document.documentElement.scrollWidth>innerWidth+2'),false,p.label+' horizontal overflow');
try {
 await T.go('/');await T.until(`!!document.querySelector('a[href="/road-to-b1"]')`,'hub link');
 await T.click('a[href="/road-to-b1"]');await T.until(`!!document.querySelector('[data-road-create]')`,'Road landing');
 await T.shot('landing');await T.click('[data-road-create]');
 await T.until(`!!document.querySelector('[data-road-section="intro"]')`,'teacher session');
 const teacher=await getSession(T,'teacher');
 for(const [p,name] of [[A,'Mia QA'],[B,'Tom QA']]){
  await p.go('/road-to-b1/level-1?code='+teacher.code);
  await p.until(`!!document.querySelector('[data-road-name]')`,'join form');
  await p.type('[data-road-name]',name);await p.click('[data-road-join]');
  await p.until(`!!document.querySelector('[data-road-section="intro"]')`,'joined');
 }
 // The production UI creates a separate credential. Isolated context mimics a second projector device.
 const projector=await T.eval(`fetch('/api/road/projector',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+${JSON.stringify(teacher.token)}},body:JSON.stringify({code:${JSON.stringify(teacher.code)}})}).then(r=>r.json())`);
 await P.go('/road-to-b1/level-1');
 await P.eval(`localStorage.setItem('dt:road:projector:'+${JSON.stringify(teacher.code)},JSON.stringify(${JSON.stringify(projector)}));true`);
 await P.go('/road-to-b1/level-1?code='+teacher.code+'&view=projector');
 await P.until(`!!document.querySelector('[data-road-section="intro"]')`,'projector');
 await goSection('lesen');
 let s=await state(A,'player');assert.equal(s.solutions,undefined);assert.equal(s.ownScore,undefined);
 assert.ok(s.players.every(x=>!x.answers&&!x.dictation&&!x.score),'other student data private');
 await B.click('[data-road-answer="l1"][data-value="Richtig"]');
 await B.until(`document.querySelector('[data-road-answer="l2"]')?.disabled===false`,'mobile first answer saved');
 await B.click('[data-road-answer="l2"][data-value="Falsch"]');
 assert.equal((await state(B,'player')).ownAnswers.l1,'Richtig');
 assert.ok((await state(A,'player')).players.every(x=>!x.answers&&!x.dictation&&!x.score),'touch pupil answers remain private');
 assert.equal(await P.eval(`document.querySelectorAll('[data-road-answer]').length`),0,'no student answer controls in projection');
 await T.shot('teacher-reading');await A.shot('chromebook-reading');await P.shot('projector-reading');await B.shot('mobile-reading');
 for(let part=0;part<5;part++){
  await A.click(`[data-road-part="${part}"]`);
  for(const q of ROAD_LEVEL.reading[part].questions){
   if(q.type==='matching'){
    const selector=`select[data-road-answer="${q.id}"]`;
    await A.click(selector);
    await A.key('Home');
    const target=await A.eval(`Array.from(document.querySelector(${JSON.stringify(selector)}).options).filter(x=>!x.disabled).findIndex(x=>x.value===${JSON.stringify(ROAD_SECRET.answers[q.id])})`);
    for(let j=0;j<target;j++)await A.key('ArrowDown');await A.key('Enter');await A.key('Escape');
   }else await A.click(`[data-road-answer="${q.id}"][data-value=${JSON.stringify(ROAD_SECRET.answers[q.id])}]`);
  }
  await noOverflow(A);
  if(part===2)await A.shot('matching');
 }
 s=await state(A,'player');for(const q of ROAD_LEVEL.reading.flatMap(p=>p.questions))assert.equal(s.ownAnswers[q.id],ROAD_SECRET.answers[q.id],q.id+' selected correct answer');assert.equal(Object.keys(s.ownAnswers??{}).filter(x=>x.startsWith('l')).length,30);
 await A.reload();await A.until(`!!document.querySelector('[data-road-section="lesen"]')`,'reload preserves session');
 assert.equal(Object.keys((await state(A,'player')).ownAnswers).length,30);
 await A.click('[data-road-submit="lesen"]');
 await A.until(`!!document.querySelector('[data-road-autoscore="lesen"]')`,'auto-correction card after submit');
 s=await state(A,'player');assert.equal(s.ownScore.lesen,30,'auto-correction 30/30');assert.equal(Object.keys(s.solutions.answers).length,30);
 assert.equal((await state(B,'player')).solutions,undefined,'other student still has no keys');
 await A.shot('autocorrect-lesen');
 await T.click('[data-road-pause]');await B.until(`document.querySelector('[data-road-answer]')?.disabled===true`,'pause disables controls');
 await T.click('[data-road-pause]');
 await goSection('korrektur');
 assert.equal((await state(B,'player')).solutions,undefined,'phase alone does not reveal');
 await T.click('[data-road-release="lesen"]');await A.until(`document.body.textContent.includes('Falsch')`,'reading review');
 s=await state(A,'player');assert.equal(Object.keys(s.solutions.answers).length,30);assert.equal(s.solutions.dictation,undefined);assert.equal(s.solutions.scripts,undefined);
 await goSection('diktat');
 await T.eval(`window.__roadPlayed=[];const orig=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){window.__roadPlayed.push(this);this.playbackRate=8;return orig.call(this)};true`);
 for(const id of ['diktat','diktat-1']){await T.click(`[data-road-play="${id}"]`);await T.until(`window.__roadPlayed.at(-1)?.currentTime>0`,'dictation audio advances',15000);await T.until(`window.__roadPlayed.at(-1)?.ended`,'dictation audio ended',15000)}
 await T.click('[data-road-lock="diktat"]');await A.until(`document.querySelector('[data-road-dictation]')?.disabled===true`,'dictation locked');await T.click('[data-road-lock="diktat"]');await A.until(`document.querySelector('[data-road-dictation]')?.disabled===false`,'dictation unlocked');
 await env.send('Network.enable',{},A.sid);await env.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:-1,uploadThroughput:-1},A.sid);
 const dictation='Am Montag beginnt die Schule um acht Uhr. Ich fahre mit dem Bus. Mein Fahrrad ist kaputt. In der ersten Stunde haben wir Deutsch. Um halb elf bin ich mit meinen Freunden zusammen. Ich mache Hausaufgaben mit meiner Familie.';
 await A.type('[data-road-dictation]',dictation);
 await A.until(`document.body.textContent.includes('Offline')`,'offline draft',12000);
 await env.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1},A.sid);
 await A.until(`document.body.textContent.includes('Gespeichert')||document.body.textContent.includes('Guardado')`,'dictation autosaved',12000);
 assert.equal((await state(A,'player')).ownDictation,dictation);
 await A.reload();await A.until(`document.querySelector('[data-road-dictation]')?.value===${JSON.stringify(dictation)}`,'dictation after reload');
 await A.shot('dictation');await A.click('[data-road-submit="diktat"]');
 await goSection('horen');
 // Real audio decoding and advancing playback, accelerated only in the QA browser.
 await A.eval(`window.__roadPlayed=[];const orig=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){window.__roadPlayed.push(this);this.playbackRate=8;return orig.call(this)};true`);
 for(let i=0;i<5;i++){
  if(i)await A.click(`[data-road-audio-tab="h${i+1}"]`);
  const item=ROAD_LEVEL.listening[i];
  await A.click(`[data-road-play="${item.audio.id}"]`);
  await A.until(`window.__roadPlayed.some(x=>x.duration>0&&x.currentTime>0)`,'audio decodes and advances',15000);
  await A.until(`window.__roadPlayed.at(-1)?.ended`,'audio ended',15000);
  for(const q of item.questions)await A.click(`[data-road-answer="${q.id}"][data-value=${JSON.stringify(ROAD_SECRET.answers[q.id])}]`);
 }
 await A.click('[data-road-audio-tab="h1"]');
 await A.click('[data-road-play="h1"]');await A.until(`window.__roadPlayed.at(-1)?.ended`,'second listening',15000);
 assert.equal((await state(A,'player')).listens.h1,2);
 assert.equal(await A.eval(`document.querySelector('[data-road-play="h1"]').disabled`),true,'two listens locked');
 await A.click('[data-road-submit="horen"]');await goSection('ergebnisse');
 await T.click('[data-road-release="horen"]');await T.click('[data-road-release="diktat"]');
 // Review ten teacher-controlled rubric checkboxes and confirm a definitive score.
 const aid=(await state(A,'player')).me;
 const review=`[data-road-review="${aid}"]`;
 await T.click(`details:has(${review}) > summary`);
 for(let i=0;i<10;i++)await T.click(`details:has(${review}) fieldset input[type="checkbox"]`,i);
 await T.click(review);
 await A.until(`document.body.textContent.includes('50')`,'results');
 s=await state(A,'player');assert.equal(s.ownScore.total,50);assert.equal(s.ownScore.grade,10);assert.equal(s.ownScore.percent,100);assert.equal(s.ownScore.pending,false);
 await T.shot('teacher-results');await A.shot('student-results');await B.shot('mobile-results');await P.shot('projector-results');
 for(const p of pages){await noOverflow(p);assert.equal(p.errors().length,0,p.label+': '+p.errors().join('\n'))}
 console.log(JSON.stringify({ok:true,clients:4,roles:['teacher','player','player','projector'],reading:30,listening:10,audios:5,total:50,grade:10,realClicks:true,touch:true,reload:true,offlineDraftRecovery:true,dictationAudio:true,dictationLock:true,paused:true,noPrematureSolutions:true,noOverflow:true,consoleErrors:0}));
}catch(e){for(const p of pages)try{await p.shot('failure-'+p.label)}catch{}throw e}finally{await env.close()}
