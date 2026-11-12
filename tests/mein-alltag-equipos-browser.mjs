import { launch, sleep } from '../scripts/cdp.mjs';
const L = await launch({ shots: 'shots/mein-equipos' });
const failures=[]; const check=(v,m)=>{console.log(v?'OK':'FAIL',m);if(!v)failures.push(m)};
try {
 const p=await L.newPage('alumno',1440,900);
 await p.go('/registro?intro=0');
 const alias='Ep'+Date.now().toString(36).slice(-6);
 check(await p.eval(`fetch('/api/account/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({alias:'${alias}',password:'zorro-azul-mesa-72-lluvia'})}).then(r=>r.status)`)===200,'cuenta aislada');
 await p.go('/presentaciones/mein-alltag.html'); await sleep(1000);
 check(await p.eval(`document.querySelectorAll('#deck > section.slide').length`)===20,'20 diapositivas');
 await p.key('p'); check(await p.eval(`document.getElementById('teamsDialog').open`),'P abre marcador');
 await p.eval(`document.querySelectorAll('.team-row')[0].querySelectorAll('button')[1].click();document.querySelectorAll('.team-row')[0].querySelectorAll('button')[1].click();document.querySelectorAll('.team-row')[1].querySelectorAll('button')[1].click();true`);
 check(await p.eval(`[...document.querySelectorAll('.team-row output')].map(x=>x.textContent).join(',')`)==='2,1','sumar puntos a ambos equipos');
 await p.eval(`undoTeam();true`); check(await p.eval(`[...document.querySelectorAll('.team-row output')].map(x=>x.textContent).join(',')`)==='2,0','deshacer');
 await p.eval(`document.querySelector('.team-row input').value='Equipo P';document.querySelector('.team-row input').dispatchEvent(new Event('change',{bubbles:true}));true`);
 const slide=await p.eval(`i`); await p.eval(`document.querySelector('.team-row input').focus();true`); await p.key('ArrowRight');check(await p.eval(`i`)===slide,'teclado de edición no mueve diapositiva');
 await p.go('/presentaciones/mein-alltag.html');await sleep(700);await p.key('p');
 check(await p.eval(`document.querySelector('.team-row input').value`)==='Equipo P','nombre persiste al recargar');
 check(await p.eval(`document.querySelector('.team-row output').textContent`)==='2','puntos persisten al recargar');
 await p.eval(`window.confirm=()=>false;resetTeam();true`);check(await p.eval(`document.querySelector('.team-row output').textContent`)==='2','cancelar reinicio');
 await p.eval(`window.confirm=()=>true;resetTeam();true`);check(await p.eval(`document.querySelector('.team-row output').textContent`)==='0','confirmar reinicio');
 await p.key('Escape');check(await p.eval(`!document.getElementById('teamsDialog').open`),'Escape cierra');
 for (const [base,extra,idx] of [['q1','q6',3],['q3','q7',8],['q4','q8',12]]){
  await p.eval(`go(${idx});quizPage('${base}','${extra}',true);true`);await sleep(250);
  check(await p.eval(`!document.getElementById('${extra}').hidden && document.getElementById('${base}').hidden && document.querySelectorAll('#${extra} .q').length===4`),`${extra}: cuatro preguntas accesibles`);
  const answer=await p.eval(`QZ['${extra}'][0].a`);
  await p.eval(`([...document.querySelectorAll('#${extra} .q:first-child .pick')].find(b=>b.dataset.o===${JSON.stringify(answer)})).click();true`);
  check(await p.eval(`document.getElementById('${extra}S').textContent`)==='1 / 4',`${extra}: corrige y puntúa`);
  await p.eval(`quizPage('${base}','${extra}',false);true`);
  check(await p.eval(`!document.getElementById('${base}').hidden`),`${base}: volver a las preguntas originales`);
 }
 await p.eval(`go(8);quizPage('q3','q7',true);true`);await sleep(1300);await p.shot('preguntas');
 await p.key('p');await sleep(400);await p.shot('marcador');
} catch(e){console.error(e);failures.push(String(e))} finally {await L.close()}
if(failures.length){console.log('FAILURES',failures);process.exit(1)}console.log('MEIN EQUIPOS BROWSER PASS');
