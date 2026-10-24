// Native Node + actual server/index.ts integration, no Vitest transform or mocked HTTP.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { once } from 'node:events';

const root = resolve(import.meta.dirname, '..');
const dataDir = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'road-e2e-'));
const reserve = createServer(); reserve.listen(0, '127.0.0.1'); await once(reserve, 'listening');
const port = reserve.address().port; await new Promise(r=>reserve.close(r));
const base = `http://127.0.0.1:${port}`;
let child, output = '';
async function start() {
  child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server/index.ts'], { cwd:root, env:{...process.env,PORT:String(port),DATA_DIR:dataDir}, stdio:['ignore','pipe','pipe'] });
  child.stdout.on('data',b=>output+=b); child.stderr.on('data',b=>output+=b);
  const deadline = Date.now()+20000;
  while (Date.now()<deadline) {
    if (child.exitCode !== null) throw new Error(`Server exited: ${output}`);
    try { if ((await fetch(base+'/api/health')).ok) return; } catch {}
    await new Promise(r=>setTimeout(r,100));
  }
  throw new Error(`Server readiness timeout: ${output}`);
}
async function stop() { if (child && child.exitCode === null) { const closed=once(child,'exit'); child.kill(); await closed; } }
async function request(route, input, who, expected=200) {
  const res = await fetch(`${base}/api/road/${route}`,{ method:input===undefined?'GET':'POST', headers:{...(who?{Authorization:`Bearer ${who.token}`} : {}),...(input===undefined?{}:{'Content-Type':'application/json'})},...(input===undefined?{}:{body:JSON.stringify(input)}) });
  const body=await res.json(); assert.equal(res.status,expected,`${route}: ${JSON.stringify(body)}`); return body;
}
try {
  await start();
  const teacher=await request('create',{levelId:'level-1'});
  const player=await request('join',{code:teacher.code,name:'HTTP Student'});
  const other=await request('join',{code:teacher.code,name:'Other',profileId:player.pid});
  const projector=await request('projector',{code:teacher.code},teacher);
  const state=who=>request(`state?code=${teacher.code}`,undefined,who);
  const act=(who,action,expected=200)=>request('action',{code:teacher.code,action},who,expected);
  await request(`state?code=${teacher.code}`,undefined,undefined,401);
  await act(player,{type:'section',section:'lesen'},403);
  await act(projector,{type:'pause'},403);
  const privateView=await state(teacher);
  for (const path of ['/server/road-content.ts','/server/road-audio/h1.mp3','/road-audio/h1.mp3','/api/road/audio/h1.mp3','/api/road/audio?audioId=h1']) {
    const res=await fetch(base+path), bytes=await res.arrayBuffer();
    assert.notEqual(res.headers.get('content-type'),'audio/mpeg',`direct audio bypass: ${path}`);
    assert.notEqual(Buffer.from(bytes).subarray(0,3).toString(),'ID3');
    const text=Buffer.from(bytes).toString(); assert(!text.includes(privateView.solutions.dictation)); assert(!text.includes(privateView.solutions.scripts.h1));
  }
  await act(teacher,{type:'section',section:'lesen'});
  for (const part of privateView.level.reading) for (const q of part.questions) await act(player,{type:'answer',questionId:q.id,value:privateView.solutions.answers[q.id]});
  await act(player,{type:'submit',activity:'lesen'});
  await act(teacher,{type:'section',section:'korrektur'});
  assert.equal((await state(projector)).solutions,undefined);
  await act(teacher,{type:'release',activity:'lesen',released:true});
  assert.equal(Object.keys((await state(projector)).solutions.answers).length,30);
  assert.equal((await state(projector)).solutions.scripts,undefined);
  await act(teacher,{type:'section',section:'diktat'});
  await act(player,{type:'dictation',text:'Private draft recovered across process restart.'});
  await act(teacher,{type:'section',section:'horen'});
  for (const part of privateView.level.listening) for (const q of part.questions) await act(player,{type:'answer',questionId:q.id,value:privateView.solutions.answers[q.id]});
  for (let i=0;i<2;i++) {
    const {audioGrant}=await act(player,{type:'listen',audioId:'h1'});
    assert(!audioGrant.url.includes(player.token));
    const res=await fetch(base+audioGrant.url); assert.equal(res.status,200); assert((await res.arrayBuffer()).byteLength>1000);
    assert.equal((await fetch(base+audioGrant.url)).status,410);
    await act(player,{type:'audioStarted',grantId:audioGrant.id});
  }
  await act(player,{type:'listen',audioId:'h1',exceptional:true},409);
  await act(teacher,{type:'listen',audioId:'h1',exceptional:true});
  const otherView=await state(other); assert(!JSON.stringify(otherView).includes('Private draft recovered')); assert.equal(otherView.history,undefined);
  await act(teacher,{type:'pause'});
  const paused=await state(teacher);
  await stop(); await start();
  const recovered=await state(player); assert.equal(recovered.ownDictation,'Private draft recovered across process restart.'); assert.equal(recovered.listens.h1,2); assert.equal(recovered.elapsedMs,paused.elapsedMs);
  await act(teacher,{type:'resume'});
  await act(teacher,{type:'section',section:'ergebnisse'});
  assert.equal((await state(player)).ownScore.total,null);
  await act(teacher,{type:'review',pid:player.pid,rubric:Array(10).fill(true)});
  assert.deepEqual((await state(player)).ownScore,{lesen:30,horen:10,diktat:10,total:50,outOf:50,grade:10,percent:100,pending:false});
  assert((await state(projector)).players.every(p=>!p.score&&!p.answers&&!p.dictation&&!p.rubric));
  const persisted=JSON.parse(readFileSync(join(dataDir,'road.json'),'utf8'));
  assert.equal(persisted.rooms[teacher.code].players[0].listens.h1,2);
  console.log('Road HTTP e2e passed: native server, three roles, privacy, release boundaries, all 40 answers, manual 50/50, media grants, real process restart.');
} finally { await stop(); rmSync(dataDir,{recursive:true,force:true}); }
