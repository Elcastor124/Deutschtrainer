// Pixel-level regression: convergence must actually be visible, not only present in the DOM.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch } from './cdp.mjs';
const browser=await launch({shots:'shots/intro-energy'});
try{
 const p=await browser.newPage('visible-energy',1366,768);
 await p.go('/?intro=still');await p.until('!!document.querySelector("[data-intro-convergence]")','held intro');
 const shots=[];
 for(const ms of [600,950,1300]){
  await p.eval(`document.getAnimations().forEach(a=>{a.pause();a.currentTime=${ms};});true`);
  await p.shot(`energy-${ms}`);shots.push(join(browser.shots,`energy-${ms}.png`));
 }
 const probe=spawnSync('python',['-c',`import json,sys\nfrom PIL import Image\ncounts=[]\nfor p in sys.argv[1:]:\n im=Image.open(p).convert('RGB'); n=0\n for y in range(80,600):\n  for x in range(im.width):\n   if (x-im.width/2)**2+(y-310)**2<240**2:continue\n   r,g,b=im.getpixel((x,y))\n   if r>100 and r>g*1.12 and r>b*1.5:n+=1\n counts.append(n)\nprint(json.dumps(counts))`,...shots],{encoding:'utf8'});
 assert.equal(probe.status,0,probe.stderr);
 const counts=JSON.parse(probe.stdout);writeFileSync(join(browser.shots,'visible-energy.json'),JSON.stringify({counts},null,2));
 assert.ok(Math.max(...counts)>=1200,`converging rays must be perceptible outside the emblem; colored pixel counts=${counts}`);
 console.log(JSON.stringify({passed:true,counts}));
}finally{await browser.close();}
