// No dist build. Isolated Vite source + real Edge: BlackCard cancellation regression.
// PROOF=red|green node scripts/blackcard-cancellation-ui.mjs [--case=active-pause,active-unmount]
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';
import { launch, sleep } from './cdp.mjs';

const cache = mkdtempSync(join(tmpdir(), 'bc-cancel-vite-'));
let releaseImport, importSeen = false, importGate;
const fixture = `
import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {__qaBcStage as BcStage} from '/src/fx/FxLayer.tsx';
import {useEffectsEnabled,setEffectsEnabled} from '/src/brand/effects.ts';
import {setLite} from '/src/fx/particles.ts';
import '/src/styles.css';
const api=window.__bc={done:0,ready:false};let key=0;
function Fixture(){
 const [show,setShow]=useState(null),[lite,setLiteState]=useState(false);
 const effects=useEffectsEnabled(),effectiveLite=lite||!effects;
 api.mount=(mode='activate')=>setShow({key:++key,mode,result:'win',caption:mode==='burn'?'+10':'BLACKCARD',sub:'Regression fixture — no game/scoring data'});
 api.pause=()=>setEffectsEnabled(false);api.resume=()=>setEffectsEnabled(true);
 api.lite=(value)=>setLiteState(value);api.unmount=()=>setShow(null);
 useEffect(()=>{setLite(effectiveLite);document.documentElement.dataset.lite=effectiveLite?'1':'0';api.ready=true},[effectiveLite]);
 return React.createElement('main',{'data-bc-fixture':true},show&&React.createElement(BcStage,{key:show.key,show,lite:effectiveLite,onDone:()=>{api.done++;setShow(null)}}));
}
const root=createRoot(document.getElementById('root'));api.disposeRoot=()=>root.unmount();root.render(React.createElement(Fixture));
`;
const vite = await createServer({
  cacheDir: cache,
  server: { host: '127.0.0.1', port: 0, strictPort: false },
  plugins: [{
    name: 'blackcard-cancel-fixture', enforce: 'pre',
    resolveId(id) { if (id === '/@blackcard-p2.js') return '\0blackcard-p2'; },
    load(id) { if (id === '\0blackcard-p2') return fixture; },
    transform(code, id) {
      // Expose the real private stage only in this isolated QA server; production exports stay unchanged.
      if (id.replaceAll('\\', '/').endsWith('/src/fx/FxLayer.tsx')) return `${code}\nexport { BcStage as __qaBcStage };`;
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/__blackcard-p2') {
          res.setHeader('Content-Type', 'text/html');
          res.end(await server.transformIndexHtml(req.url, '<!doctype html><html><body><div id="root"></div><script type="module" src="/@blackcard-p2.js"></script></body></html>'));
          return;
        }
        if (importGate && req.url?.startsWith('/src/fx/blackcard3d.ts')) { importSeen = true; await importGate; }
        next();
      });
    },
  }],
});
await vite.listen();
const browser = await launch({ base: `http://127.0.0.1:${vite.httpServer.address().port}`, shots: 'shots/blackcard-cancellation' });
const selected = process.argv.find((arg) => arg.startsWith('--case='))?.slice(7).split(',');
const results = [];

async function pageFor(name, { fonts = false, fallback = false, off = false } = {}) {
  const page = await browser.newPage(name, 1100, 800);
  await browser.send('Page.bringToFront', {}, page.sid);
  await browser.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] }, page.sid);
  await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    const qa=window.__bcGPU={draws:0,contexts:[],buffers:0,programs:0,textures:0,pending:new Set(),resize:new Set(),fontLoads:0};
    const raf=requestAnimationFrame.bind(window),cancel=cancelAnimationFrame.bind(window);
    window.requestAnimationFrame=fn=>{const id=raf(now=>{qa.pending.delete(id);fn(now)});qa.pending.add(id);return id};
    window.cancelAnimationFrame=id=>{qa.pending.delete(id);cancel(id)};
    const add=window.addEventListener.bind(window),remove=window.removeEventListener.bind(window);
    window.addEventListener=(type,fn,...args)=>{if(type==='resize'&&new Error().stack?.includes('/src/fx/blackcard3d.ts'))qa.resize.add(fn);return add(type,fn,...args)};
    window.removeEventListener=(type,fn,...args)=>{if(type==='resize')qa.resize.delete(fn);return remove(type,fn,...args)};
    const get=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(kind,...args){
      if(/webgl/.test(kind)){
        ${fallback ? 'return null;' : ''}
        const gl=get.call(this,kind,...args);if(gl&&!qa.contexts.includes(gl))qa.contexts.push(gl);return gl;
      }return get.call(this,kind,...args);
    };
    for(const prototype of [window.WebGLRenderingContext?.prototype,window.WebGL2RenderingContext?.prototype]){
      if(!prototype)continue;
      for(const [method,key] of [['drawArrays','draws'],['drawElements','draws'],['drawArraysInstanced','draws'],['drawElementsInstanced','draws'],['deleteBuffer','buffers'],['deleteProgram','programs'],['deleteTexture','textures']]){
        const fn=prototype[method];if(fn)prototype[method]=function(...args){qa[key]++;return fn.apply(this,args)};
      }
    }
    ${fonts ? `const waiting=[];document.fonts.load=()=>{qa.fontLoads++;return new Promise(r=>waiting.push(r))};window.__releaseFonts=()=>waiting.splice(0).forEach(r=>r([]));` : ''}
    ${off ? `localStorage.setItem('dt:effects','off');` : ''}
  ` }, page.sid);
  await page.go('/__blackcard-p2');
  try { await page.until('window.__bc?.ready', 'fixture boot', 60000); }
  catch (error) { throw new Error(`${error.message}: ${JSON.stringify(page.errors())}`); }
  return page;
}
const stats = (page) => page.eval(`({draws:__bcGPU.draws,contexts:__bcGPU.contexts.length,lost:__bcGPU.contexts.filter(gl=>gl.isContextLost()).length,buffers:__bcGPU.buffers,programs:__bcGPU.programs,textures:__bcGPU.textures,raf:__bcGPU.pending.size,resize:__bcGPU.resize.size,done:__bc.done,overlay:!!document.querySelector('.bcfx')})`);
async function stopProof(page, name) {
  const before = await stats(page);
  await sleep(350);
  const after = await stats(page);
  assert.equal(after.draws, before.draws, `${name}: no draws after cancellation (350ms)`);
  assert.equal(after.raf, 0, `${name}: no queued RAF`);
  assert.equal(after.resize, 0, `${name}: no retained scene resize listener`);
  return { before, after };
}
async function run(name, test) {
  if (selected && !selected.includes(name)) return;
  let page;
  try {
    const result = await test(async (options) => (page = await pageFor(name, options)));
    const errors = page.errors().filter((error) => name !== 'webgl-fallback' || error !== 'THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.');
    assert.deepEqual(errors, []);
    results.push({ name, passed: true, ...result });
  } catch (error) {
    results.push({ name, passed: false, error: error.message, ...(page ? { actual: await stats(page) } : {}) });
    if (page) await page.shot(`${process.env.PROOF ?? 'run'}-${name}-failure`);
  } finally {
    releaseImport?.(); importGate = undefined; releaseImport = undefined;
    if (page) {
      const { targetInfo } = await browser.send('Target.getTargetInfo', {}, page.sid);
      await browser.send('Target.closeTarget', { targetId: targetInfo.targetId });
    }
  }
}
try {
  for (const action of ['pause', 'unmount', 'lite', 'rapid-resume', 'reduced']) {
    await run(`active-${action}`, async (open) => {
      const page = await open();
      await page.eval('__bc.mount("burn")');
      await page.until('__bcGPU.draws>=12', 'real Three.js scene', 60000);
      await page.shot(`${process.env.PROOF ?? 'run'}-active-${action}`);
      if (action === 'reduced') await browser.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }, page.sid);
      else await page.eval(action === 'lite' ? '__bc.lite(true)' : action === 'rapid-resume' ? '__bc.pause();__bc.resume()' : `__bc.${action}()`);
      await page.until(action === 'unmount' ? '!document.querySelector(".bcfx")' : `document.documentElement.dataset.lite==="${action === 'rapid-resume' ? '0' : '1'}"`, 'pause/unmount applied');
      const proof = await stopProof(page, action);
      assert.equal(proof.after.lost, 1, 'owned context explicitly lost');
      assert(proof.after.buffers > 0 && proof.after.programs > 0 && proof.after.textures > 0, 'GPU resources released');
      if (action !== 'unmount') {
        await page.until('__bc.done===1&&!document.querySelector(".bcfx")', 'essential event finishes', 5000);
        if (action === 'reduced') await browser.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] }, page.sid);
        else await page.eval(action === 'lite' ? '__bc.lite(false)' : '__bc.resume()');
        await stopProof(page, 'resume must not replay cancelled BlackCard');
        assert.equal(await page.eval('__bc.done'), 1, 'onDone exactly once');
      } else assert.equal(proof.after.done, 0, 'unmounted stage never calls onDone');
      return { ...proof, completed: await stats(page) };
    });
  }
  for (const load of ['import', 'fonts']) for (const action of ['pause', 'unmount']) {
    await run(`${load}-${action}`, async (open) => {
      if (load === 'import') { importSeen = false; importGate = new Promise((resolve) => { releaseImport = resolve; }); }
      const page = await open({ fonts: load === 'fonts' });
      await page.eval('__bc.mount()');
      if (load === 'import') {
        const deadline = Date.now() + 60000;
        while (!importSeen && Date.now() < deadline) await sleep(50);
        assert(importSeen, 'dynamic import actually stalled');
      } else await page.until('__bcGPU.fontLoads===2', 'font load actually stalled', 60000);
      await page.eval(`__bc.${action}()`);
      await page.until(action === 'pause' ? 'document.documentElement.dataset.dtEffects==="off"' : '!document.querySelector(".bcfx")', 'cancel pending scene');
      if (action === 'pause') await page.until('__bc.done===1', 'queue resolves before pending load is released', 5000);
      if (load === 'import') { releaseImport(); importGate = undefined; } else await page.eval('__releaseFonts()');
      await sleep(700);
      const proof = await stopProof(page, `late ${load}`);
      assert.equal(proof.after.contexts, 0, 'no renderer created after cancelled load resolves');
      assert.equal(proof.after.done, action === 'pause' ? 1 : 0, 'no late/duplicate completion');
      return proof;
    });
  }
  for (const mode of ['activate', 'burn']) await run(`normal-${mode}`, async (open) => {
    const page = await open();
    await page.eval(`__bc.mount(${JSON.stringify(mode)})`);
    await page.until('__bcGPU.draws>=12', 'normal enabled cinematic', 60000);
    await page.until('__bc.done===1&&!document.querySelector(".bcfx")', 'normal scene finishes', 15000);
    const proof = await stopProof(page, `normal ${mode} completed`);
    assert.equal(proof.after.contexts, 1); assert.equal(proof.after.lost, 1);
    return proof;
  });
  for (const name of ['initially-off', 'webgl-fallback']) await run(name, async (open) => {
    const page = await open({ off: name === 'initially-off', fallback: name === 'webgl-fallback' });
    await page.eval('__bc.mount("burn")');
    await page.until('!!document.querySelector(".bc-lite")', 'essential textual fallback', 60000);
    assert.match(await page.eval('document.querySelector(".bcfx").textContent'), /\+10/);
    await page.until('__bc.done===1&&!document.querySelector(".bcfx")', 'fallback finishes queue', 7000);
    const proof = await stopProof(page, name);
    assert.equal(proof.after.contexts, 0);
    await page.eval('__bc.resume()');
    await stopProof(page, 'fallback is not replayed');
    assert.equal(await page.eval('__bc.done'), 1);
    return proof;
  });
} finally {
  releaseImport?.();
  writeFileSync(join(browser.shots, `${process.env.PROOF ?? 'run'}-report.json`), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  await browser.close(); await vite.close(); rmSync(cache, { recursive: true, force: true });
}
assert(results.length > 0, 'at least one requested case ran');
assert.equal(results.filter((result) => !result.passed).length, 0, 'BlackCard cancellation regressions');
