// Browser regression for personal workshop drafts, source choices and self-review.
import assert from 'node:assert/strict';
import { launch } from './cdp.mjs';
const env = await launch({ shots: 'shots/workshop' });
// Draft typing can leave the tabs off-screen during smooth-scroll restoration.
// Activate with genuine native Enter (not a pointer racing the scroll), then
// assert the selected tab before inspecting its form.
async function chooseMode(page, mode) {
  await page.eval(`document.querySelectorAll('[aria-label="Tipo de taller"] button')[${mode}].focus({preventScroll:true})`);
  await env.send('Input.dispatchKeyEvent', {type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13,text:'\r'}, page.sid);
  await env.send('Input.dispatchKeyEvent', {type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13}, page.sid);
  await page.until(`document.querySelectorAll('[aria-label="Tipo de taller"] button')[${mode}].getAttribute('aria-pressed')==='true'`, 'taller seleccionado');
}
try {
  const page = await env.newPage('workshop', 1366, 900);
  await page.go('/tema/1/taller');
  await page.until(`!!document.querySelector('#workshop-text')`, 'taller');
  assert.equal(await page.eval(`document.querySelector('select').options.length`), 6);
  const draft = 'Gestern habe ich meine Katze gesehen, obwohl ich müde war.';
  await page.type('#workshop-text', draft);
  await page.click('.learning-review input', 0);
  await page.reload();
  await page.until(`!!document.querySelector('#workshop-text')`, 'borrador restaurado');
  assert.equal(await page.eval(`document.querySelector('#workshop-text').value`), draft);
  assert(await page.eval(`document.querySelector('.learning-review input').checked`));
  const expectedChoices = [6, 6, 8, 4];
  for (let mode = 1; mode < 4; mode++) {
    await chooseMode(page, mode);
    assert.equal(await page.eval(`document.querySelector('select').options.length`), expectedChoices[mode]);
    assert.equal(await page.eval(`document.querySelector('#workshop-text').value`), '');
    await page.type('#workshop-text', `Borrador independiente ${mode}`);
  }
  await chooseMode(page, 0);
  assert.equal(await page.eval(`document.querySelector('#workshop-text').value`), draft);
  await chooseMode(page, 2);
  assert.equal(await page.eval(`document.querySelector('#workshop-text').value`), 'Borrador independiente 2');
  await page.shot('desktop');
  const mobile = await env.newPage('workshop-mobile', 390, 844, true);
  await mobile.go('/tema/1/taller');
  await mobile.until(`!!document.querySelector('#workshop-text')`, 'taller móvil');
  for (let mode = 0; mode < 4; mode++) {
    await chooseMode(mobile, mode);
    assert(await mobile.eval('document.documentElement.scrollWidth <= innerWidth + 1'), `overflow en modo ${mode}`);
  }
  await mobile.shot('mobile');
  assert.deepEqual(page.errors(), []);
  assert.deepEqual(mobile.errors(), []);
  console.log(JSON.stringify({ ok: true, modes: 4, sourceChoices: expectedChoices, draftsReloaded: true, checklistsReloaded: true, independentDrafts: true, mobileOverflow: false, consoleErrors: 0 }));
} finally { await env.close(); }
