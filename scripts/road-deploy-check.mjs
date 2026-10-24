// Read back the deployed build and exercise a synthetic three-role exam room.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const base=process.env.ROAD_BASE||'https://deutschtrainer-cg76.onrender.com';
const remote=await(await fetch(base+'/road-to-b1/level-1')).text();
const assets=s=>[...s.matchAll(/(?:src|href)="(\/assets\/[^\"]+\.(?:js|css))"/g)].map(x=>x[1]).sort();
assert.deepEqual(assets(remote),assets(readFileSync(new URL('../dist/index.html',import.meta.url),'utf8')),'deployed build differs from locally verified build');
const post=async(route,body,token)=>{const response=await fetch(base+'/api/road/'+route,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});assert.equal(response.status,200,route+' HTTP status');return response.json()};
const teacher=await post('create',{levelId:'level-1'}),player=await post('join',{code:teacher.code,name:'Deployment QA'}),projector=await post('projector',{code:teacher.code},teacher.token);
const act=(who,action)=>post('action',{code:teacher.code,action},who.token);
const state=async who=>{const response=await fetch(base+'/api/road/state?code='+teacher.code,{headers:{Authorization:'Bearer '+who.token}});assert.equal(response.status,200);return response.json()};
let s=await state(player);assert.equal(s.level.reading.flatMap(p=>p.questions).length,30);assert.equal(s.level.listening.flatMap(p=>p.questions).length,10);assert.equal(s.level.listening.length,5);assert.equal(s.solutions,undefined);assert.equal(s.level.dictation.rubric.length,0);
await act(teacher,{type:'section',section:'lesen'});await act(player,{type:'answer',questionId:'l1',value:'Falsch'});assert.equal((await state(teacher)).players[0].progress.lesen,1);assert.equal((await state(projector)).players[0].answers,undefined);
await act(teacher,{type:'section',section:'horen'});
const {audioGrant}=await act(player,{type:'listen',audioId:'h1'});const audio=await fetch(base+audioGrant.url);assert.equal(audio.status,200);assert.equal(audio.headers.get('content-type'),'audio/mpeg');assert((await audio.arrayBuffer()).byteLength>1000);await act(player,{type:'audioStarted',grantId:audioGrant.id});
await act(teacher,{type:'release',activity:'lesen',released:true});s=await state(projector);assert.equal(Object.keys(s.solutions.answers).length,30);assert.equal(s.solutions.scripts,undefined);assert.equal(s.solutions.dictation,undefined);await act(teacher,{type:'pause'});
console.log(JSON.stringify({ok:true,origin:base,verifiedAssets:assets(remote),roles:3,reading:30,listening:10,recordings:5,answerPersisted:true,protectedAudioDelivered:true,noPrematureSecrets:true,readingOnlyRelease:true}));
