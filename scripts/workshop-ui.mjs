// Browser regression for personal workshop drafts, source choices and self-review.
import assert from 'node:assert/strict';
import { launch } from './cdp.mjs';
const env = await launch({ shots: 'shots/workshop' });
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
    await page.click('[aria-label="Tipo de taller"] button', mode);
    assert.equal(await page.eval(`document.querySelector('select').options.length`), expectedChoices[mode]);
    assert.equal(await page.eval(`document.querySelector('#workshop-text').value`), '');
    await page.type('#workshop-text', `Borrador independiente ${mode}`);
  }
  await page.click('[aria-label="Tipo de taller"] button', 0);
  assert.equal(await page.eval(`document.querySelector('#workshop-text').value`), draft);
  await page.click('[aria-label="Tipo de taller"] button', 2);
  assert.equal(await page.eval(`document.querySelector('#workshop-text').value`), 'Borrador independiente 2');
  await page.shot('desktop');
  const mobile = await env.newPage('workshop-mobile', 390, 844, true);
  await mobile.go('/tema/1/taller');
  await mobile.until(`!!document.querySelector('#workshop-text')`, 'taller móvil');
  for (let mode = 0; mode < 4; mode++) {
    await mobile.click('[aria-label="Tipo de taller"] button', mode);
    assert(await mobile.eval('document.documentElement.scrollWidth <= innerWidth + 1'), `overflow en modo ${mode}`);
  }
  await mobile.shot('mobile');
  assert.deepEqual(page.errors(), []);
  assert.deepEqual(mobile.errors(), []);
  console.log(JSON.stringify({ ok: true, modes: 4, sourceChoices: expectedChoices, draftsReloaded: true, checklistsReloaded: true, independentDrafts: true, mobileOverflow: false, consoleErrors: 0 }));
} finally { await env.close(); }
