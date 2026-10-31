// E2E de la Tägliche Mission en navegador real (Playwright): alumno → misión → fallo → pista de Klaus → acierto con ayuda
// → resto de preguntas → final → historial en /mi. Uso: npm run build && node scripts/mission-e2e.mjs [base] [outDir]
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const { chromium } = createRequire(process.cwd() + '/')('playwright');
const B = process.argv[2] ?? 'http://localhost:4778'; const out = process.argv[3] ?? 'shots/mission';
const b = await chromium.launch(); const errs = [];
for (const [w, h, tag] of [[1440, 900, 'd'], [390, 844, 'm']]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, hasTouch: tag === 'm' })).newPage();
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.addInitScript(() => sessionStorage.setItem('dt:intro:v1', '1'));
  await p.goto(B + '/');
  const alias = `Mision_${tag}${Date.now() % 100000}`;
  assert.equal(await p.evaluate(async (a) => (await fetch('/api/account/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alias: a, password: 'correct-horse-battery', confirm: 'correct-horse-battery' }) })).status, alias), 200);
  await p.evaluate(() => localStorage.setItem('dt:student-session', 'cookie'));
  await p.goto(B + '/mision'); await p.waitForSelector('.ms-start'); await p.waitForTimeout(1500); await p.screenshot({ path: `${out}/start-${tag}.png` });
  await p.click('text=Comenzar misión'); await p.waitForSelector('.ms-card');
  // 1.ª pregunta: fallar a propósito (la opción que no es la correcta se conoce probando: si acierta, se sigue).
  let failed = false;
  for (let n = 0; n < 5; n++) {
    await p.waitForSelector('.ms-opts button:not([disabled])');
    await p.click('.ms-opts button:not([disabled]) >> nth=0'); await p.waitForTimeout(500);
    if (!failed && !(await p.$('.ms-feedback'))) {
      failed = true;
      await p.waitForSelector('.ms-hint'); // pista automática de Klaus (nivel 1), sin revelar la solución
      assert.match(await p.$eval('.ms-bubble', (e) => e.innerText), /Pista/);
      await p.screenshot({ path: `${out}/klaus-${tag}.png` });
      await p.click('text=Otra pista'); await p.waitForSelector('.ms-hint.l2');
      await p.screenshot({ path: `${out}/klaus2-${tag}.png` });
    }
    while (!(await p.$('.ms-feedback'))) { await p.click('.ms-opts button:not([disabled]) >> nth=0'); await p.waitForTimeout(300); }
    await p.click('.ms-card .dt-btn-primary'); await p.waitForTimeout(400);
  }
  assert.ok(failed, 'el flujo debe incluir al menos un fallo');
  await p.waitForSelector('.ms-end'); await p.waitForTimeout(900); await p.screenshot({ path: `${out}/end-${tag}.png` });
  assert.match(await p.$eval('.ms-end', (e) => e.innerText), /Misión completada/);
  await p.goto(B + '/mi'); await p.waitForSelector('#misiones'); await p.screenshot({ path: `${out}/mi-${tag}.png`, fullPage: true });
  assert.match(await p.$eval('#misiones', (e) => e.innerText), /1 misión/);
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `desborde ${tag}`);
  await p.close();
}
assert.deepEqual(errs, []);
console.log(JSON.stringify({ ok: true }));
await b.close();
