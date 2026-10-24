import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RoadWelcome } from '../shared/road.ts';

const servers: Server[] = [], dirs: string[] = [];
afterEach(async () => { for (const s of servers.splice(0)) { s.closeAllConnections(); await new Promise<void>(r => s.close(() => r())); } for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
async function setup() {
  const { createRoadHandler } = await import('../server/road.ts');
  const dataDir = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'road-test-')); dirs.push(dataDir);
  let time = 1_000_000;
  let handler = createRoadHandler({ dataDir, now: () => time });
  const server = createServer((req,res) => { if (!handler(req,res)) { res.writeHead(404); res.end(); } }); servers.push(server);
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const address = server.address() as { port: number };
  const request = async (path: string, input?: unknown, token?: string, method = input === undefined ? 'GET' : 'POST') => {
    const res = await fetch(`http://127.0.0.1:${address.port}/api/road/${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(input !== undefined ? { 'Content-Type': 'application/json' } : {}) }, ...(input !== undefined ? {body: JSON.stringify(input)} : {}) });
    return { status: res.status, body: await res.json() };
  };
  const teacher = (await request('create', { levelId: 'level-1' })).body as RoadWelcome;
  const player = (await request('join', { code: teacher.code, name: 'Ada' })).body as RoadWelcome;
  const action = (who: RoadWelcome, action: unknown) => request('action', { code: teacher.code, action }, who.token);
  const state = (who: RoadWelcome) => request(`state?code=${teacher.code}`, undefined, who.token);
  return { teacher, player, request, action, state, dataDir, raw: (path: string, headers = {}) => fetch(`http://127.0.0.1:${address.port}${path}`, {headers}), restart: () => { handler = createRoadHandler({ dataDir, now: () => time }); }, advance: (ms: number) => { time += ms; }, server };
}

describe('Road authoritative HTTP', () => {
  it('redacts dictation marking keywords and partitions all three solution releases', async () => {
    const {teacher,player,request,state,action} = await setup();
    const projector = (await request('projector',{code:teacher.code},teacher.token)).body;
    const { ROAD_SECRET } = await import('../server/road-content.ts');
    for (const who of [player,projector]) {
      const v = (await state(who)).body;
      expect(v.level.dictation.rubric).toEqual([]);
      expect(v.solutions).toBeUndefined();
      for (const secret of [ROAD_SECRET.dictation,...Object.values(ROAD_SECRET.scripts),...ROAD_SECRET.dictationFragments]) expect(JSON.stringify(v)).not.toContain(secret.trim());
    }
    await action(teacher,{type:'release',activity:'horen',released:true});
    let s = (await state(projector)).body.solutions;
    expect(Object.keys(s.answers)).toHaveLength(10); expect(s.scripts).toEqual(ROAD_SECRET.scripts); expect(s.dictation).toBeUndefined();
    await action(teacher,{type:'release',activity:'horen',released:false});
    await action(teacher,{type:'release',activity:'diktat',released:true});
    s = (await state(projector)).body.solutions;
    expect(s.dictation).toBe(ROAD_SECRET.dictation); expect(s.answers).toBeUndefined(); expect(s.scripts).toBeUndefined();
  });
  it('rejects malformed inputs, unsupported methods, unauthenticated token reuse and oversized bodies', async () => {
    const {teacher,player,request,state,action,raw} = await setup();
    expect((await request('create',{levelId:'wrong'})).status).toBe(400);
    expect((await request('create')).status).toBe(405);
    expect((await request('create',[])).status).toBe(400);
    expect((await request('create',null)).status).toBe(400);
    expect((await request('create',{pad:'x'.repeat(70000)})).status).toBe(413);
    expect((await request('constructor')).status).toBe(404);
    expect((await request('unknown')).status).toBe(404);
    expect((await request('join',{code:'../../',name:'x'})).status).toBe(400);
    expect((await request('join',{code:teacher.code,name:'   '})).status).toBe(400);
    expect((await request('join',{code:teacher.code,name:'x'.repeat(81)})).status).toBe(400);
    for (const a of [null,[],{}, {type:'unknown'}, {type:'section',section:'oops'}, {type:'lock',activity:'__proto__',locked:true}, {type:'release',activity:'lesen',released:'true'}]) expect((await action(teacher,a)).status).toBe(400);
    const anotherTeacher = (await request('create',{levelId:'level-1'})).body;
    expect((await state(anotherTeacher)).status).toBe(401);
    expect((await request(`state?code=${teacher.code}&token=${player.token}`)).status).toBe(401);
    expect((await raw('/server/road-content.ts')).status).toBe(404);
    expect((await raw('/server/road-audio/h1.mp3')).status).toBe(404);
    await action(teacher,{type:'section',section:'diktat'});
    expect((await action(player,{type:'dictation',text:'x'.repeat(12001)})).status).toBe(400);
    expect((await action(player,{type:'dictation',text:'x'.repeat(12000)})).status).toBe(200);
  });
  it('reserves example A, prevents repeated ads, allows 0 and joins a full class of 30', async () => {
    const {teacher,player,request,state,action} = await setup();
    const matching = (await state(player)).body.level.reading.flatMap((p:any)=>p.questions).filter((q:any)=>q.type==='matching');
    await action(teacher,{type:'section',section:'lesen'});
    expect((await action(player,{type:'answer',questionId:matching[0].id,value:'A'})).status).toBe(400);
    expect((await action(player,{type:'answer',questionId:matching[0].id,value:'B'})).status).toBe(200);
    expect((await action(player,{type:'answer',questionId:matching[1].id,value:'B'})).status).toBe(400);
    for (const q of matching.slice(0,2)) expect((await action(player,{type:'answer',questionId:q.id,value:'0'})).status).toBe(200);
    for (let i=1;i<30;i++) expect((await request('join',{code:teacher.code,name:`student ${i}`})).status).toBe(200);
    expect((await state(teacher)).body.players).toHaveLength(30);
    expect((await request('join',{code:teacher.code,name:'31st'})).status).toBe(409);
  });
  it('persists drafts, rubric, timers, submissions and identity across a real handler restart', async () => {
    const {teacher,player,action,state,advance,restart} = await setup();
    advance(5000); await action(teacher,{type:'section',section:'diktat'});
    advance(10000); await action(player,{type:'dictation',text:'saved draft äöü'});
    await action(teacher,{type:'pause'}); advance(30000);
    expect((await state(teacher)).body).toMatchObject({elapsedMs:15000,sectionElapsedMs:10000,paused:true});
    restart(); advance(90000);
    expect((await state(player)).body).toMatchObject({ownDictation:'saved draft äöü',elapsedMs:15000,sectionElapsedMs:10000,paused:true});
    await action(teacher,{type:'resume'}); advance(2000);
    await action(teacher,{type:'section',section:'lesen'}); advance(3000);
    await action(teacher,{type:'section',section:'diktat'});
    expect((await state(player)).body).toMatchObject({elapsedMs:20000,sectionElapsedMs:12000});
    await action(player,{type:'submit',activity:'diktat'});
    await action(teacher,{type:'review',pid:player.pid,rubric:Array(10).fill(false)});
    restart(); expect((await state(teacher)).body.players[0]).toMatchObject({dictation:'saved draft äöü',rubric:Array(10).fill(false),submitted:{diktat:true}});
    advance(21000); expect((await state(teacher)).body.players[0].connected).toBe(false);
    expect((await state(player)).body.players[0].connected).toBe(true);
    await action(teacher,{type:'reopen',pid:player.pid,activity:'diktat'});
    await action(player,{type:'dictation',text:'corrected'});
    expect((await state(teacher)).body.players[0].score.pending).toBe(true);
    advance(9_000_000); expect((await action(player,{type:'dictation',text:'timer is advisory'})).status).toBe(200);
  });
  it('recovers a lost listen response and failed body with the same durable per-audio attempt', async () => {
    const {teacher,player,action,state,raw,restart,advance} = await setup();
    await action(teacher,{type:'section',section:'horen'});
    const lost = (await action(player,{type:'listen',audioId:'h1'})).body.audioGrant;
    // The caller never received the response; retry is a recovery, not a second start.
    const recovered = (await action(player,{type:'listen',audioId:'h1'})).body.audioGrant;
    expect(recovered.id).toBe(lost.id);
    expect(recovered.url).not.toBe(lost.url);
    expect((await raw(lost.url)).status).toBe(410);
    const body = await raw(recovered.url); expect(body.status).toBe(200); await body.body?.cancel();
    await action(player,{type:'listen',audioId:'h2'});
    restart(); advance(60001);
    const retry = (await action(player,{type:'listen',audioId:'h1'})).body.audioGrant;
    expect(retry.id).toBe(lost.id);
    expect((await state(player)).body.listens).toEqual({h1:1,h2:1});
    expect((await raw(retry.url)).status).toBe(200);
    expect((await action(player,{type:'audioStarted',grantId:retry.id})).status).toBe(200);
    expect((await action(player,{type:'audioStarted',grantId:retry.id})).status).toBe(200);
    const second = (await action(player,{type:'listen',audioId:'h1'})).body.audioGrant;
    expect(second.id).not.toBe(retry.id);
    // Delayed duplicate acknowledgment must not retire the newer pending attempt.
    await action(player,{type:'audioStarted',grantId:retry.id});
    expect((await action(player,{type:'listen',audioId:'h1'})).body.audioGrant.id).toBe(second.id);
  });
  it('enforces two audio starts, opaque expiring single-use media grants and read-only projector', async () => {
    const {teacher,player,action,state,request,raw,advance,restart} = await setup();
    const projector = (await request('projector',{code:teacher.code},teacher.token)).body;
    expect((await action(projector,{type:'listen',audioId:'h1'})).status).toBe(403);
    expect((await action(player,{type:'listen',audioId:'h1'})).status).toBe(409);
    await action(teacher,{type:'section',section:'horen'});
    expect((await action(player,{type:'listen',audioId:'../../road-content'})).status).toBe(400);
    expect((await action(player,{type:'listen',audioId:'diktat'})).status).toBe(403);
    const first = await action(player,{type:'listen',audioId:'h1'});
    expect(first.status).toBe(200); expect(first.body.audioGrant.url).toMatch(/^\/api\/road\/audio\?grant=[A-Za-z0-9_-]+$/);
    expect(first.body.audioGrant.url).not.toContain(player.token);
    expect((await state(player)).body.audioGrant).toEqual(first.body.audioGrant);
    const media = await raw(first.body.audioGrant.url);
    expect(media.status).toBe(200); expect(media.headers.get('content-type')).toBe('audio/mpeg'); expect(media.headers.get('accept-ranges')).toBe('none');
    expect((await media.arrayBuffer()).byteLength).toBeGreaterThan(1000);
    expect((await raw(first.body.audioGrant.url)).status).toBe(410);
    await action(player,{type:'audioStarted',grantId:first.body.audioGrant.id});
    const second = await action(player,{type:'listen',audioId:'h1',exceptional:true}); expect(second.status).toBe(200);
    expect(second.body.audioGrant.id).not.toBe(first.body.audioGrant.id);
    expect((await raw(second.body.audioGrant.url,{Range:'bytes=0-10'})).status).toBe(416);
    expect((await raw(second.body.audioGrant.url)).status).toBe(410);
    // A failed download is recoverable; only an actual start consumes the next attempt.
    const secondRetry = await action(player,{type:'listen',audioId:'h1'});
    expect(secondRetry.body.audioGrant.id).toBe(second.body.audioGrant.id);
    expect((await raw(secondRetry.body.audioGrant.url)).status).toBe(200);
    await action(player,{type:'audioStarted',grantId:secondRetry.body.audioGrant.id});
    expect((await action(player,{type:'listen',audioId:'h1',exceptional:true})).status).toBe(409);
    restart(); expect((await state(player)).body.listens.h1).toBe(2);
    expect((await action(player,{type:'listen',audioId:'h1'})).status).toBe(409);
    const extra = await action(teacher,{type:'listen',audioId:'h1',exceptional:true}); expect(extra.status).toBe(200);
    advance(60001); expect((await raw(extra.body.audioGrant.url)).status).toBe(410);
    await action(teacher,{type:'pause'}); expect((await action(player,{type:'listen',audioId:'h2'})).status).toBe(409);
    await action(teacher,{type:'resume'}); await action(teacher,{type:'lock',activity:'horen',locked:true});
    expect((await action(player,{type:'listen',audioId:'h2'})).status).toBe(409);
    await action(teacher,{type:'section',section:'diktat'});
    expect((await action(teacher,{type:'listen',audioId:'diktat-1'})).status).toBe(200);
    await action(teacher,{type:'cue',audioId:'diktat-1'});
    expect((await state(projector)).body.cue).toEqual({serial:1,audioId:'diktat-1'});
    await action(teacher,{type:'cue',audioId:'diktat-1'});
    expect((await state(projector)).body.cue.serial).toBe(2);
    expect((await raw('/api/road/audio?grant='+teacher.token)).status).toBe(410);
  });
  it('permits only an owner to acknowledge issued attempts and only teachers to restore one extra listen', async () => {
    const {teacher,player,request,action,state,raw,restart} = await setup();
    const projector = (await request('projector',{code:teacher.code},teacher.token)).body;
    const other = (await request('join',{code:teacher.code,name:'Other'})).body;
    await action(teacher,{type:'section',section:'horen'});
    const grant = (await action(player,{type:'listen',audioId:'h1'})).body.audioGrant;
    for (const id of ['made-up','__proto__','constructor']) expect((await action(player,{type:'audioStarted',grantId:id})).status).toBe(404);
    expect((await action(other,{type:'audioStarted',grantId:grant.id})).status).toBe(404);
    expect((await action(projector,{type:'audioStarted',grantId:grant.id})).status).toBe(403);
    expect((await action(player,{type:'audioStarted',grantId:grant.id})).status).toBe(200);
    expect((await raw(grant.url)).status).toBe(410);
    const second = (await action(player,{type:'listen',audioId:'h1'})).body.audioGrant;
    await action(player,{type:'audioStarted',grantId:second.id});
    expect((await action(player,{type:'listen',audioId:'h1'})).status).toBe(409);
    const restore = {type:'restoreListen',pid:player.pid,audioId:'h1'};
    for (const who of [player,projector]) expect((await action(who,restore)).status).toBe(403);
    expect((await action(teacher,{...restore,audioId:'diktat'})).status).toBe(400);
    expect((await action(teacher,{...restore,pid:'unknown'})).status).toBe(404);
    expect((await action(teacher,restore)).status).toBe(200);
    restart();
    expect((await state(player)).body.listenLimits.h1).toBe(3);
    expect((await state(teacher)).body.players[0]).toMatchObject({listens:{h1:2},listenLimits:{h1:3}});
    const extra = (await action(player,{type:'listen',audioId:'h1'})).body.audioGrant;
    await action(player,{type:'audioStarted',grantId:extra.id});
    expect((await action(player,{type:'listen',audioId:'h1'})).status).toBe(409);
    expect((await state(other)).body.players[0].listens).toBeUndefined();
    expect((await state(projector)).body.pendingAudio).toBeUndefined();
  });
  it('scores 30 reading + 10 listening + ten manual rubric marks with pending totals', async () => {
    const {teacher,player,request,state,action} = await setup();
    const {ROAD_LEVEL,ROAD_SECRET} = await import('../server/road-content.ts');
    await action(teacher,{type:'section',section:'lesen'});
    for (const q of ROAD_LEVEL.reading.flatMap(p=>p.questions)) expect((await action(player,{type:'answer',questionId:q.id,value:ROAD_SECRET.answers[q.id]})).status).toBe(200);
    await action(teacher,{type:'section',section:'horen'});
    for (const q of ROAD_LEVEL.listening.flatMap(p=>p.questions)) expect((await action(player,{type:'answer',questionId:q.id,value:ROAD_SECRET.answers[q.id]})).status).toBe(200);
    await action(teacher,{type:'section',section:'diktat'});
    expect((await action(player,{type:'dictation',text:'private student dictation'})).status).toBe(200);
    const other = (await request('join',{code:teacher.code,name:'Other',profileId:player.pid})).body;
    const projector = (await request('projector',{code:teacher.code},teacher.token)).body;
    for (const who of [other,projector]) {
      const view = (await state(who)).body;
      expect(JSON.stringify(view)).not.toContain('private student dictation');
      const visit = (v:any) => { if (!v || typeof v !== 'object') return; for (const [k,x] of Object.entries(v)) { expect(['token','teacherToken','score','scripts','dictationFragments'].includes(k)).toBe(false); visit(x); } }; visit(view);
      expect(view.history).toBeUndefined();
      expect(view.players.every((p:any)=>!p.answers&&!p.dictation&&!p.score&&!p.rubric)).toBe(true);
    }
    expect((await state(teacher)).body.players[0].score).toMatchObject({lesen:30,horen:10,diktat:null,total:null,grade:null,percent:null,pending:true});
    await action(teacher,{type:'section',section:'ergebnisse'});
    expect((await state(player)).body.ownScore).toMatchObject({lesen:30,horen:10,total:null,pending:true});
    for (const rubric of [[],Array(9).fill(true),Array(10).fill(1),Array(11).fill(true)]) expect((await action(teacher,{type:'review',pid:player.pid,rubric})).status).toBe(400);
    expect((await action(teacher,{type:'review',pid:'missing',rubric:Array(10).fill(true)})).status).toBe(404);
    await action(teacher,{type:'review',pid:player.pid,rubric:Array(10).fill(true)});
    expect((await state(player)).body.ownScore).toEqual({lesen:30,horen:10,diktat:10,total:50,outOf:50,grade:10,percent:100,pending:false});
    await action(teacher,{type:'review',pid:player.pid,rubric:[true,true,true,true,true,true,false,false,false,false]});
    expect((await state(player)).body.ownScore).toMatchObject({diktat:6,total:46,grade:9.2,percent:92,pending:false});
    expect((await state(projector)).body.players.every((p:any)=>!p.score&&!p.answers&&!p.dictation&&!p.rubric)).toBe(true);
    expect((await state(other)).body.history).toBeUndefined();
  });
  it('isolates projector and player privileges and releases only explicitly authorized solutions', async () => {
    const { teacher, player, request, state, action } = await setup();
    expect((await request('projector', { code: teacher.code }, player.token)).status).toBe(403);
    const projector = (await request('projector', {code: teacher.code}, teacher.token)).body;
    expect(projector.token).not.toBe(teacher.token); expect(projector.role).toBe('projector');
    for (const who of [player, projector]) for (const a of [
      {type:'section',section:'lesen'}, {type:'pause'}, {type:'resume'}, {type:'lock',activity:'lesen',locked:true},
      {type:'release',activity:'lesen',released:true}, {type:'review',pid:player.pid,rubric:Array(10).fill(true)},
      {type:'reopen',pid:player.pid,activity:'lesen'}, {type:'cue',audioId:'h1'},
    ]) expect((await action(who,a)).status).toBe(403);
    await action(teacher,{type:'section',section:'korrektur'});
    expect((await state(projector)).body.solutions).toBeUndefined();
    await action(teacher,{type:'release',activity:'lesen',released:true});
    const solutions = (await state(projector)).body.solutions;
    expect(Object.keys(solutions.answers)).toHaveLength(30); expect(solutions.scripts).toBeUndefined(); expect(solutions.dictation).toBeUndefined();
    expect((await state(teacher)).body.solutions.dictation).toBeTruthy();
  });
  it('validates answers and enforces phase, pause, independent locks, submit and reopen', async () => {
    const {teacher,player,state,action} = await setup();
    const level = (await state(player)).body.level, q = level.reading.flatMap((p:any)=>p.questions)[0];
    const answer = {type:'answer',questionId:q.id,value:q.options[0]};
    expect((await action(player,answer)).status).toBe(409);
    await action(teacher,{type:'section',section:'lesen'});
    expect((await action(player,{...answer,value:'not an option'})).status).toBe(400);
    expect((await action(player,{...answer,questionId:'__proto__'})).status).toBe(400);
    expect((await action(player,answer)).status).toBe(200);
    expect((await state(player)).body.ownScore).toBeUndefined();
    await action(teacher,{type:'pause'}); expect((await action(player,answer)).status).toBe(409);
    await action(teacher,{type:'resume'}); await action(teacher,{type:'lock',activity:'horen',locked:true});
    expect((await action(player,answer)).status).toBe(200);
    await action(teacher,{type:'lock',activity:'lesen',locked:true}); expect((await action(player,answer)).status).toBe(409);
    await action(teacher,{type:'lock',activity:'lesen',locked:false});
    await action(player,{type:'submit',activity:'lesen'}); expect((await action(player,answer)).status).toBe(409);
    await action(teacher,{type:'reopen',pid:player.pid,activity:'lesen'}); expect((await action(player,answer)).status).toBe(200);
    await action(teacher,{type:'release',activity:'lesen',released:true});
    await action(teacher,{type:'reopen',pid:player.pid,activity:'lesen'}); expect((await action(player,answer)).status).toBe(409);
    await action(teacher,{type:'release',activity:'lesen',released:false}); expect((await action(player,answer)).status).toBe(409);
    expect((await state(player)).body.sealed).toEqual({lesen:true,horen:false,diktat:false});
    await action(teacher,{type:'section',section:'ergebnisse'});
    expect((await state(player)).body.sealed).toEqual({lesen:true,horen:true,diktat:true});
  });
  it('creates isolated authenticated room sessions and exposes metadata only', async () => {
    const {teacher, player, request, state} = await setup();
    expect(teacher.role).toBe('teacher'); expect(player.role).toBe('player'); expect(player.token).not.toBe(teacher.token);
    expect((await state(player)).body.role).toBe('player');
    expect((await request(`state?code=${teacher.code}`)).status).toBe(401);
    const levels = await request('levels'); expect(levels.status).toBe(200);
    expect(JSON.stringify(levels.body)).not.toMatch(/answers|scripts|reading|listening|dictation/);
  });
});
