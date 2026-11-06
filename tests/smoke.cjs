// Smoke test: plays the whole story at 20x speed and checks it reaches the ending.
// Run: node tests/smoke.cjs
const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto('file://' + path.resolve(__dirname, '../index.html') + '?fast');
  await page.waitForFunction(() => document.body.innerText.includes('RENDER golden_hour?'), null, { timeout: 30000 });
  assert(await page.isHidden('#poem'), 'poem must wait for input');

  await page.keyboard.press('y');
  await page.waitForSelector('#poem:not([hidden])', { timeout: 15000 });
  await page.waitForSelector('#end:not([hidden])', { timeout: 30000 });
  assert(await page.evaluate(() => document.body.classList.contains('light')), 'ending must be in light theme');
  await page.waitForFunction(() => document.querySelector('#end').innerText.includes('1.618033988749895'), null, { timeout: 10000 });
  // endless digits are exact (BigInt), not float noise
  await page.waitForFunction(() => document.querySelector('.digits').textContent.length > 24, null, { timeout: 10000 });
  const digits = await page.textContent('.digits');
  assert('1.6180339887498948482045868343656381177203'.startsWith(digits) || digits.startsWith('1.6180339887498948482045868343656381177203'), digits);
  assert.deepStrictEqual(errors, []);

  // skip() typed in the browser console jumps the log straight to the prompt
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForTimeout(1500);
  assert.strictEqual(await page.evaluate(() => skip()), 'ok. skipping the boring part.');
  await page.waitForFunction(() => document.body.innerText.includes('RENDER golden_hour?'), null, { timeout: 5000 });

  await browser.close();
  console.log('ok');
})().catch((e) => { console.error(e); process.exit(1); });
