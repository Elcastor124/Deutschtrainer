import { expect, it, vi } from 'vitest';
import * as road from '../src/road-client.ts';

const deferred = <T>() => { let resolve!:(value:T)=>void; let reject!:(error:Error)=>void; const promise=new Promise<T>((ok,no)=>{resolve=ok;reject=no;}); return {promise,resolve,reject}; };
function setup(load?:()=>Promise<any>) {
 const audio={play:vi.fn(async()=>{}),pause:vi.fn(),onended:null as null|(()=>void),onerror:null as null|(()=>void)};
 const grant=vi.fn(async()=>({id:'logical-1',url:'/api/road/audio?grant=fresh-token'}));
 const started=vi.fn(async()=>true);
 const loader=vi.fn(async(_url:string,_signal:AbortSignal)=>load?load():audio);
 const controller=new road.RoadAudioPlayback({grant,started,load:loader});
 return {controller,audio,grant,started,loader};
}
it('does not autoplay when paused while the audio body is pending; reuses it on explicit resume',async()=>{
 const body=deferred<any>(); const s=setup(()=>body.promise);
 const pending=s.controller.start(); await Promise.resolve(); s.controller.setPaused(true);
 body.resolve(s.audio); await pending;
 expect(s.audio.play).not.toHaveBeenCalled(); expect(s.started).not.toHaveBeenCalled(); expect(s.controller.status).toBe('retry');
 s.controller.setPaused(false); expect(s.audio.play).not.toHaveBeenCalled();
 await s.controller.start(); expect(s.audio.play).toHaveBeenCalledTimes(1); expect(s.grant).toHaveBeenCalledTimes(1); expect(s.started).toHaveBeenCalledWith('logical-1');
});
it('pauses again if pause arrives while play() is still resolving',async()=>{
 const s=setup(); const play=deferred<void>(); s.audio.play.mockImplementation(()=>play.promise);
 const pending=s.controller.start(); await vi.waitFor(()=>expect(s.audio.play).toHaveBeenCalledTimes(1));
 s.controller.setPaused(true); const before=s.audio.pause.mock.calls.length; play.resolve(); await pending;
 expect(s.audio.pause.mock.calls.length).toBeGreaterThan(before); expect(s.controller.status).toBe('retry');
 s.controller.setPaused(false); await s.controller.start(); expect(s.grant).toHaveBeenCalledTimes(1); expect(s.started).toHaveBeenCalledTimes(1);
});
it('retries a failed body using the same logical grant and acknowledges only after successful play',async()=>{
 const s=setup(); s.loader.mockRejectedValueOnce(new Error('interrupted body'));
 await s.controller.start(); expect(s.controller.status).toBe('error'); expect(s.started).not.toHaveBeenCalled();
 await s.controller.start(); expect(s.grant).toHaveBeenCalledTimes(2); expect(s.controller.status).toBe('playing'); expect(s.started).toHaveBeenCalledWith('logical-1');
});
it('reuses downloaded audio after autoplay denial, without requesting a second attempt',async()=>{
 const s=setup(); s.audio.play.mockRejectedValueOnce(new Error('NotAllowedError'));
 await s.controller.start(); expect(s.controller.status).toBe('retry'); expect(s.started).not.toHaveBeenCalled();
 await s.controller.start(); expect(s.grant).toHaveBeenCalledTimes(1); expect(s.audio.play).toHaveBeenCalledTimes(2); expect(s.started).toHaveBeenCalledTimes(1);
});
it('does not replay a completed blob or request another attempt until the previous start is acknowledged',async()=>{
 const s=setup(); s.started.mockResolvedValueOnce(false).mockResolvedValueOnce(false).mockResolvedValue(true);
 await s.controller.start(); s.audio.onended!();
 await s.controller.start(); expect(s.grant).toHaveBeenCalledTimes(1); expect(s.audio.play).toHaveBeenCalledTimes(1);
 await s.controller.start(); expect(s.grant).toHaveBeenCalledTimes(2);
});
it('aborts a pending body and never plays after disposal',async()=>{
 const body=deferred<any>(); const s=setup(()=>body.promise);
 const pending=s.controller.start(); await Promise.resolve(); const signal=s.loader.mock.calls[0]?.[1]; s.controller.dispose(); body.resolve(s.audio); await pending;
 expect(signal?.aborted).toBe(true); expect(s.audio.play).not.toHaveBeenCalled(); expect(s.started).not.toHaveBeenCalled();
});
