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

  // moon phase against known events: full moon 2024-04-23 23:49 UTC, new moon (eclipse) 2024-04-08 18:21 UTC
  const full = await page.evaluate(() => moon(new Date('2024-04-23T23:49:00Z')));
  const dark = await page.evaluate(() => moon(new Date('2024-04-08T18:21:00Z')));
  assert(full.name === 'full moon' && full.lit > 0.97, JSON.stringify(full));
  assert(dark.name === 'new moon' && dark.lit < 0.03, JSON.stringify(dark));

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

  assert.strictEqual(await page.$('#loader'), null, 'loader must be gone once scripts run');

  // typing 1618 opens the keeper's journal, which types out to the last entry
  await page.goto('file://' + path.resolve(__dirname, '../index.html') + '?fast');
  await page.waitForTimeout(500);
  await page.keyboard.type('1618');
  await page.waitForSelector('#journal:not([hidden])', { timeout: 5000 });
  await page.waitForFunction(() => document.querySelector('#journal').innerText.includes('someone will read the log.'), null, { timeout: 30000 });
  await page.waitForFunction(() => document.querySelector('#term').textContent.includes("third time. I'm starting to recognise you."), null, { timeout: 30000 });
  assert(await page.textContent('#journal').then((t) => t.includes('last entry')));

  // the next visit is remembered (same browser profile)
  await page.goto('file://' + path.resolve(__dirname, '../index.html') + '?fast');
  await page.waitForFunction(() => document.body.innerText.includes('you read the journal last time'), null, { timeout: 30000 });
  assert(await page.textContent('#term').then((t) => t.includes('you came back.')));
  assert(await page.textContent('#term').then((t) => t.includes('1 user online')));
  assert.deepStrictEqual(errors, []);

  // 13th visit: the machine writes its own journal entry
  await page.evaluate(() => {
    const m = JSON.parse(localStorage.getItem('phi-lab'));
    m.visits = 12;
    localStorage.setItem('phi-lab', JSON.stringify(m));
  });
  await page.goto('file://' + path.resolve(__dirname, '../index.html') + '?fast');
  await page.waitForFunction(() => document.querySelector('#term').textContent.includes('thirteen. you\'ve been here more than anyone'), null, { timeout: 30000 });
  await page.keyboard.type('1618');
  await page.waitForFunction(() => document.querySelector('#journal').innerText.includes("I'll keep counting for both of us."), null, { timeout: 30000 });
  assert.deepStrictEqual(errors, []);

  await browser.close();
  console.log('ok');
})().catch((e) => { console.error(e); process.exit(1); });
