import type { RoadAction, RoadView, RoadWelcome, RoadRole } from '../shared/road.ts';
import { teacherKey } from './util.ts';
type SessionStore = Pick<Storage, 'getItem' | 'setItem'>;
const memory = new Map<string,string>();
const defaultStore: SessionStore = { getItem(k) { try { return localStorage.getItem(k) ?? memory.get(k) ?? null; } catch { return memory.get(k) ?? null; } }, setItem(k,v) { memory.set(k,v); try { localStorage.setItem(k,v); } catch { /* Memory fallback for restricted browsers. */ } } };
const slot = (code:string, role:RoadRole) => `dt:road:${role}:${code}`;
export function saveRoadSession(session:RoadWelcome, storage:SessionStore = defaultStore) {
 storage.setItem(slot(session.code,session.role),JSON.stringify(session));
 if (session.role !== 'projector') storage.setItem('dt:road:last',JSON.stringify({code:session.code,role:session.role}));
}
export function readRoadSession(code?:string, role?:RoadRole, storage:SessionStore = defaultStore):RoadWelcome|null {
 try {
  if (!code) { const last = JSON.parse(storage.getItem('dt:road:last') ?? 'null'); return last?.code && ['teacher','player'].includes(last.role) ? readRoadSession(last.code,last.role,storage) : null; }
  for (const kind of role ? [role] : ['player','teacher'] as const) { const value = JSON.parse(storage.getItem(slot(code,kind)) ?? 'null'); if (value?.code === code && value.role === kind && typeof value.token === 'string' && value.token) return value; }
 } catch { /* Malformed saved rooms do not grant access. */ }
 return null;
}
export async function roadRequest<T>(path:string, body?:unknown, token?:string, signal?:AbortSignal, keepalive = false):Promise<T> {
 const controller = new AbortController(); const abort = () => controller.abort(); signal?.addEventListener('abort',abort,{once:true}); if (signal?.aborted) controller.abort();
 const timer = setTimeout(abort,8000);
 try {
  const response = await fetch(`/api/road/${path}`,{method:body === undefined ? 'GET':'POST',cache:'no-store',signal:controller.signal,keepalive,headers:{...(body === undefined ? {} : {'Content-Type':'application/json'}),...(token ? {Authorization:`Bearer ${token}`} : {}),...(path === 'create' && teacherKey() ? {'X-Teacher-Key':teacherKey()!} : {})},...(body === undefined ? {} : {body:JSON.stringify(body)})});
  let data; try { data = await response.json(); } catch { throw new Error('Respuesta inválida del servidor. Reintenta.'); }
  if (!response.ok || data?.ok === false) throw new Error(data?.error ?? 'No se pudo confirmar la acción.');
  return data as T;
 } finally { clearTimeout(timer); signal?.removeEventListener('abort',abort); }
}
export interface RoadClientState { view:RoadView|null; connection:'connecting'|'online'|'offline'; busy:boolean; error:string|null; draft:string|null; draftStatus:'saved'|'pending'|'offline' }
export type RoadAudioStatus = 'idle'|'loading'|'playing'|'retry'|'error';
type PlaybackAudio = Pick<HTMLAudioElement,'play'|'pause'|'onended'|'onerror'>;
interface PlaybackDependencies {
 isPaused?():boolean;
 grant():Promise<{id:string;url:string}|boolean>;
 started(id:string):Promise<boolean>;
 load(url:string,signal:AbortSignal):Promise<PlaybackAudio>;
 release?(audio:PlaybackAudio):void;
 changed?():void;
}
/** One logical start, with recoverable transport and explicit (never automatic) resume. */
export class RoadAudioPlayback {
 status:RoadAudioStatus='idle'; error='';
 private audio?:PlaybackAudio; private grantId?:string; private didStart=false; private acknowledged=false; private finished=false;
 private paused=false; private disposed=false; private inFlight=false; private controller?:AbortController;
 private deps:PlaybackDependencies;
 constructor(deps:PlaybackDependencies) {this.deps=deps;}
 get canResume() { return !!this.audio && !this.finished; }
 private get isPaused() { return this.deps.isPaused?.() ?? this.paused; }
 private set(status:RoadAudioStatus,error='') { this.status=status; this.error=error; if(!this.disposed)this.deps.changed?.(); }
 // Called by the pause effect to stop current playback; async continuations also
 // consult isPaused(), whose React adapter reads a ref updated on every render.
 setPaused(paused:boolean) {
  this.paused=paused;
  if(paused && this.audio && !this.finished) { this.audio.pause(); this.set('retry','Wiedergabe pausiert. Nach der Pause mit «Audio starten» fortsetzen.'); }
 }
 private release() { if(this.audio) { this.audio.pause(); this.audio.onended=null; this.audio.onerror=null; this.deps.release?.(this.audio); this.audio=undefined; } }
 async start() {
  if(this.disposed||this.inFlight||this.isPaused||this.status==='playing')return;
  this.inFlight=true; this.set('loading');
  try {
   if(this.finished) {
    if(this.didStart&&!this.acknowledged) {
     this.acknowledged=await this.deps.started(this.grantId!);
     if(!this.acknowledged)throw new Error('Inicio pendiente de confirmar. Reintenta la conexión antes de otra escucha.');
    }
    this.release(); this.finished=false; this.didStart=false; this.acknowledged=false;
   }
   if(!this.audio) {
    const grant=await this.deps.grant();
    if(!grant||typeof grant==='boolean')throw new Error('Audio no disponible. Reintenta o pide ayuda a la Lehrkraft.');
    this.grantId=grant.id;
    if(this.disposed)return;
    const controller=this.controller=new AbortController();
    // Keep timeout active until the ENTIRE body has downloaded, not just headers.
    const timer=setTimeout(()=>controller.abort(),15000);
    let downloaded:PlaybackAudio;
    try { downloaded=await this.deps.load(grant.url,controller.signal); } finally { clearTimeout(timer); }
    if(this.disposed) { downloaded.pause(); this.deps.release?.(downloaded); return; }
    this.audio=downloaded;
    this.audio.onended=()=>{this.finished=true;this.set('idle');};
    this.audio.onerror=()=>{this.finished=this.didStart;this.release();this.set('error','El archivo no se puede reproducir. Reintenta o informa a la Lehrkraft.');};
   }
   if(this.disposed)return;
   if(this.isPaused) { this.audio.pause(); this.set('retry','Wiedergabe pausiert. Nach der Pause mit «Audio starten» fortsetzen.'); return; }
   const playing=this.audio;
   try { await playing.play(); }
   catch { if(this.isPaused||this.disposed)playing.pause(); this.set('retry','El navegador ha bloqueado el sonido. Pulsa «Audio starten» para reintentar sin gastar otra escucha.'); return; }
   // Pause can arrive between play() and its promise resolving. Stop again, then ack
   // the real successful start once; a subsequent resume reuses this same local audio.
   if(this.isPaused||this.disposed)playing.pause();
   this.didStart=true;
   if(!this.acknowledged)this.acknowledged=await this.deps.started(this.grantId!);
   if(this.isPaused||this.disposed)playing.pause();
   if(!this.disposed)this.set(this.finished?'idle':this.isPaused?'retry':'playing',this.acknowledged?'':'Inicio guardado localmente; se confirmará al reconectar.');
  } catch(e) { if(!this.disposed)this.set('error',e instanceof Error?e.message:'Audio nicht verfügbar. Bitte erneut versuchen.'); }
  finally { this.inFlight=false; }
 }
 dispose() { this.disposed=true; this.controller?.abort(); this.release(); }
}
export class RoadClient {
 private snapshot:RoadClientState = {view:null,connection:'connecting',busy:false,error:null,draft:null,draftStatus:'saved'};
 private listeners = new Set<() => void>();
 private timer?:ReturnType<typeof setTimeout>; private debounce?:ReturnType<typeof setTimeout>; private controller?:AbortController;
 private generation=0; private closed=false; private polling=false; private dirty=false; private draftRevision=0; private savingDraft=false;
 private draftKey:string;
 private audioStartKey:string; private pendingStarts=new Set<string>(); private starting=new Map<string,Promise<boolean>>();
 private session:RoadWelcome; private storage:SessionStore;
 constructor(session:RoadWelcome, storage:SessionStore = defaultStore) {
  this.session=session; this.storage=storage;
  this.draftKey=`dt:road:draft:${session.code}:${session.role}:${session.pid ?? 'none'}`;
  this.audioStartKey=`dt:road:audio-started:${session.code}:${session.role}:${session.pid ?? 'none'}`;
  if(session.role==='player') { try { const saved=JSON.parse(storage.getItem(this.audioStartKey) ?? '[]'); if(Array.isArray(saved))for(const id of saved)if(typeof id==='string')this.pendingStarts.add(id); } catch { /* No pending acknowledgments. */ } }
  if (session.role === 'player') { try { const saved = JSON.parse(storage.getItem(this.draftKey) ?? 'null'); if (typeof saved?.text === 'string') { this.dirty=!!saved.dirty; this.snapshot={...this.snapshot,draft:saved.text,draftStatus:this.dirty?'pending':'saved'}; } } catch { /* Empty draft. */ } }
 }
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 getSnapshot=()=>this.snapshot;
 private set(patch:Partial<RoadClientState>) { this.snapshot={...this.snapshot,...patch}; this.listeners.forEach(fn=>fn()); }
 private persist() { try { this.storage.setItem(this.draftKey,JSON.stringify({text:this.snapshot.draft,dirty:this.dirty})); } catch { /* Draft remains in client memory. */ } }
 private persistStarts() { try { this.storage.setItem(this.audioStartKey,JSON.stringify([...this.pendingStarts])); } catch { /* Keep pending starts in memory if storage is restricted. */ } }
 audioStarted=(grantId:string):Promise<boolean>=>{
  if(this.session.role!=='player')return Promise.resolve(false);
  this.pendingStarts.add(grantId); this.persistStarts();
  const existing=this.starting.get(grantId); if(existing)return existing;
  const pending=(async()=>{
   try { await roadRequest('action',{code:this.session.code,action:{type:'audioStarted',grantId}},this.session.token,undefined,true); this.pendingStarts.delete(grantId);this.persistStarts();return true; }
   catch { return false; } finally { this.starting.delete(grantId); }
  })();
  this.starting.set(grantId,pending); return pending;
 };
 private async flushAudioStarts() { for(const id of [...this.pendingStarts])if(!await this.audioStarted(id))return false; return true; }
 private cancel() { ++this.generation; clearTimeout(this.timer); this.controller?.abort(); }
 private schedule() { if (this.polling && !this.closed) this.timer=setTimeout(()=>{void this.refresh();},650); }
 start() { this.closed=false;this.polling=true;void this.refresh(); }
 refresh=async()=>{
  if (this.closed || this.snapshot.busy) return;
  this.cancel(); const generation=this.generation; const controller=this.controller=new AbortController();
  try {
   // A slow acknowledgment must not delay pause/lock snapshots. Listen actions
   // still await this queue before requesting a fresh logical attempt.
   void this.flushAudioStarts();
   const view=await roadRequest<RoadView>(`state?code=${encodeURIComponent(this.session.code)}`,undefined,this.session.token,controller.signal);
   if (this.closed || generation!==this.generation) return;
   this.set({view,connection:'online',error:null,...(!this.dirty && view.ownDictation !== undefined ? {draft:view.ownDictation} : {})});
   if (this.dirty && !this.savingDraft && this.session.role==='player' && !view.paused && !view.locked.diktat && !view.sealed?.diktat && !view.released.diktat && !view.ownSubmitted?.diktat && view.section==='diktat') { await this.flushDraft(); }
  } catch(error) { if (!this.closed && generation===this.generation) this.set({connection:'offline',error:error instanceof Error && error.name!=='AbortError'?error.message:'La conexión tarda demasiado. Reintentando…',...(this.dirty?{draftStatus:'offline' as const}:{})}); }
  finally { if (generation===this.generation) this.schedule(); }
 };
 action=async(action:RoadAction):Promise<boolean|{id:string;url:string}>=>{
  if(action.type==='audioStarted')return this.audioStarted(action.grantId);
  if(this.closed || this.snapshot.busy) return false;
  this.cancel(); const generation=this.generation; const controller=this.controller=new AbortController(); this.set({busy:true,error:null}); let result:boolean|{id:string;url:string}=false; let error:string|null=null;
  try { if(action.type==='listen'&&!await this.flushAudioStarts())throw new Error('Inicio pendiente de confirmar. Comprueba la conexión y reintenta.'); const response=await roadRequest<{ok:true;audioGrant?:{id:string;url:string}}>('action',{code:this.session.code,action},this.session.token,controller.signal); result=response.audioGrant ?? true; }
  catch(cause) { error=cause instanceof Error && cause.name!=='AbortError'?cause.message:'Acción no confirmada. Comprueba la conexión y reintenta.'; }
  finally { if(!this.closed && generation===this.generation) { this.set({busy:false,error}); await this.refresh(); if(error) this.set({error}); } }
  return result;
 };
 setDraft=(text:string)=>{this.dirty=true;++this.draftRevision;this.set({draft:text,draftStatus:this.snapshot.connection==='offline'?'offline':'pending'});this.persist();clearTimeout(this.debounce);this.debounce=setTimeout(()=>{void this.flushDraft();},550);};
 flushDraft=async():Promise<boolean>=>{
  clearTimeout(this.debounce); if(!this.dirty) return true; if(this.snapshot.busy || this.closed) return false;
  const revision=this.draftRevision; const text=this.snapshot.draft ?? ''; this.savingDraft=true; const result=await this.action({type:'dictation',text}); this.savingDraft=false;
  if(result && revision===this.draftRevision) {this.dirty=false;this.set({draftStatus:'saved'});this.persist();} else if(!result) this.set({draftStatus:this.snapshot.connection==='offline'?'offline':'pending'});
  return !!result && !this.dirty;
 };
 submit=async(activity:'lesen'|'horen'|'diktat')=>{ if(activity==='diktat' && !await this.flushDraft()) return false; return this.action({type:'submit',activity}); };
 close() { this.closed=true;this.polling=false;clearTimeout(this.debounce);this.cancel(); if(this.dirty && this.session.role==='player') { this.persist(); void roadRequest('action',{code:this.session.code,action:{type:'dictation',text:this.snapshot.draft ?? ''}},this.session.token,undefined,true).catch(()=>{}); } }
}
