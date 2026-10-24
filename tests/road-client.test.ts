import { afterEach, expect, it, vi } from 'vitest';
import { RoadClient, readRoadSession, saveRoadSession } from '../src/road-client.ts';
import type { RoadWelcome, RoadView } from '../shared/road.ts';
const session: RoadWelcome = { code: 'ABCD', role: 'player', token: 'private', pid: 'p1' };
const storage = () => { const data = new Map<string,string>(); return { getItem: (k:string) => data.get(k) ?? null, setItem: (k:string,v:string) => { data.set(k,v); } }; };
const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'Content-Type':'application/json' } });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it('isolates projector, teacher and player sessions per room', () => {
 const s = storage(); saveRoadSession(session,s); saveRoadSession({...session,role:'teacher',token:'teacher'},s); saveRoadSession({...session,role:'projector',token:'readonly'},s);
 expect(readRoadSession('ABCD','projector',s)?.token).toBe('readonly'); expect(readRoadSession('ABCD','teacher',s)?.token).toBe('teacher'); expect(readRoadSession('ABCD','player',s)?.token).toBe('private'); expect(readRoadSession('ZZZZ','teacher',s)).toBeNull();
});
const view = {code:'ABCD',role:'player',me:'p1',section:'diktat',paused:false,locked:{diktat:false},released:{},players:[],listens:{},ownDictation:'server draft',ownSubmitted:{diktat:false}} as unknown as RoadView;
it('polls at 650ms and preserves its last view through offline recovery',async()=>{
 vi.useFakeTimers();const fetcher=vi.fn().mockResolvedValueOnce(json(view)).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(json({...view,ownDictation:'recovered'}));vi.stubGlobal('fetch',fetcher);
 const client=new RoadClient(session,storage());client.start();await vi.advanceTimersByTimeAsync(0);expect(client.getSnapshot().connection).toBe('online');await vi.advanceTimersByTimeAsync(650);expect(client.getSnapshot().connection).toBe('offline');expect(client.getSnapshot().view).toEqual(view);await vi.advanceTimersByTimeAsync(650);expect(client.getSnapshot().draft).toBe('recovered');client.close();await vi.advanceTimersByTimeAsync(650);expect(fetcher).toHaveBeenCalledTimes(3);
});
it('ignores old poll responses after superseding or closing',async()=>{
 let resolve!:(r:Response)=>void;const fetcher=vi.fn().mockImplementationOnce(()=>new Promise<Response>(done=>{resolve=done;})).mockResolvedValue(json({...view,section:'lesen'}));vi.stubGlobal('fetch',fetcher);const client=new RoadClient(session,storage());const old=client.refresh();await client.refresh();resolve(json(view));await old;expect(client.getSnapshot().view?.section).toBe('lesen');client.close();
});
it('keeps dirty drafts through polling and restores them after reconnect with ordered final submit',async()=>{
 vi.useFakeTimers();const s=storage();let online=false;const sent:Record<string,unknown>[]=[];let serverText='old';
 const fetcher=vi.fn().mockImplementation(async(_path:string,init:RequestInit)=>{if(!online)throw new Error('offline');if(init.method==='POST'){const a=JSON.parse(String(init.body)).action;sent.push(a);if(a.type==='dictation')serverText=a.text;return json({ok:true});}return json({...view,ownDictation:serverText});});vi.stubGlobal('fetch',fetcher);
 const client=new RoadClient(session,s);client.setDraft('Mein lokaler Text');await vi.advanceTimersByTimeAsync(550);expect(client.getSnapshot().draft).toBe('Mein lokaler Text');client.close();
 const restored=new RoadClient(session,s);expect(restored.getSnapshot().draft).toBe('Mein lokaler Text');online=true;await restored.refresh();expect(restored.getSnapshot().draftStatus).toBe('saved');expect(restored.getSnapshot().draft).toBe('Mein lokaler Text');restored.setDraft('Noch eine Änderung');expect(await restored.submit('diktat')).toBe(true);expect(sent.slice(-2)).toEqual([{type:'dictation',text:'Noch eine Änderung'},{type:'submit',activity:'diktat'}]);restored.close();
});
it('persists successful audio starts through lost acknowledgment responses and retries before a new listen',async()=>{
 const s=storage(); let online=false; const actions:any[]=[];
 vi.stubGlobal('fetch',vi.fn(async(_path:string,init:RequestInit)=>{
  if(init.method==='POST') { const a=JSON.parse(String(init.body)).action; actions.push(a); if(!online)throw new Error('lost ack response'); return json({ok:true}); }
  return json(view);
 }));
 const client=new RoadClient(session,s);
 expect(await client.audioStarted('logical-1')).toBe(false);
 client.close(); const recovered=new RoadClient(session,s); online=true;
 await recovered.refresh();
 expect(actions.filter(a=>a.type==='audioStarted')).toEqual([{type:'audioStarted',grantId:'logical-1'},{type:'audioStarted',grantId:'logical-1'}]);
 const before=actions.length; await recovered.refresh(); expect(actions).toHaveLength(before);
 recovered.close();
});
it('continues receiving classroom pause while an audio acknowledgment response is stalled',async()=>{
 let finish!:(r:Response)=>void;
 vi.stubGlobal('fetch',vi.fn(async(_path:string,init:RequestInit)=>{
  if(init.method==='POST')return new Promise<Response>(resolve=>{finish=resolve;});
  return json({...view,paused:true});
 }));
 const client=new RoadClient(session,storage());const ack=client.audioStarted('logical-1');const refreshing=client.refresh();
 try { await vi.waitFor(()=>expect(client.getSnapshot().view?.paused).toBe(true),{timeout:150}); }
 finally { finish(json({ok:true}));await ack;await refreshing;client.close(); }
});
it('returns audio grants while retaining bearer credentials only in headers',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(json({ok:true,audioGrant:{id:'h1',url:'/api/road/audio/ticket'}})).mockResolvedValue(json(view));vi.stubGlobal('fetch',fetcher);const client=new RoadClient(session,storage());expect(await client.action({type:'listen',audioId:'h1'})).toEqual({id:'h1',url:'/api/road/audio/ticket'});expect(fetcher.mock.calls[0][0]).toBe('/api/road/action');expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer private');expect(fetcher.mock.calls.every(c=>!String(c[0]).includes('private'))).toBe(true);client.close();
});
it('preserves a dirty draft without resending assessment writes after the activity is sealed',async()=>{
 vi.useFakeTimers();const s=storage();const source=new RoadClient(session,s);source.setDraft('Original local draft');
 const sent:any[]=[];vi.stubGlobal('fetch',vi.fn(async(_path:string,init:RequestInit)=>{if(init.method==='POST'){sent.push(JSON.parse(String(init.body)).action);return json({ok:false,error:'sealed'});}return json({...view,sealed:{lesen:false,horen:false,diktat:true}});}));
 const recovered=new RoadClient(session,s);await recovered.refresh();
 expect(sent).toEqual([]);expect(recovered.getSnapshot().draft).toBe('Original local draft');recovered.close();source.close();
});
it('keeps drafts scoped to both role and player identity',()=>{vi.useFakeTimers();const s=storage();const first=new RoadClient(session,s);first.setDraft('Privater Text');expect(new RoadClient({...session,pid:'p2'},s).getSnapshot().draft).toBeNull();expect(new RoadClient({...session,role:'projector'},s).getSnapshot().draft).toBeNull();vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));first.close();});
it('does not mark newer edits saved when an older autosave finishes',async()=>{
 vi.useFakeTimers();let finish!:(r:Response)=>void;let first=true;const fetcher=vi.fn().mockImplementation(async(_path:string,init:RequestInit)=>{if(init.method==='POST'&&first){first=false;return new Promise<Response>(resolve=>{finish=resolve;});}return json(view);});vi.stubGlobal('fetch',fetcher);const client=new RoadClient(session,storage());client.setDraft('first');const saving=client.flushDraft();client.setDraft('newest');finish(json({ok:true}));await saving;expect(client.getSnapshot().draft).toBe('newest');expect(client.getSnapshot().draftStatus).toBe('pending');client.close();
});
it('does not change the resumable teacher role when saving a projector credential',()=>{const s=storage();saveRoadSession({...session,role:'teacher',token:'teach'},s);saveRoadSession({...session,role:'projector',token:'projection'},s);expect(readRoadSession(undefined,undefined,s)?.role).toBe('teacher');});
