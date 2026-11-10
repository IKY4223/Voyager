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

  // golden dates: month/day are neighbouring Fibonacci numbers
  const golden = await page.evaluate(() => [[0, 1], [0, 2], [1, 3], [2, 5], [4, 8], [7, 13], [4, 9], [6, 21]].map(([m, d]) => goldenDate(new Date(2026, m, d))));
  assert.deepStrictEqual(golden, [true, true, true, true, true, true, false, false]);

  await page.keyboard.press('y');
  await page.waitForSelector('#poem:not([hidden])', { timeout: 15000 });
  await page.waitForSelector('#end:not([hidden])', { timeout: 30000 });
  assert(await page.evaluate(() => document.body.classList.contains('light')), 'ending must be in light theme');
  await page.waitForFunction(() => document.querySelector('#end').innerText.includes('1.618033988749895'), null, { timeout: 10000 });
  // endless digits are exact (BigInt), not float noise
  await page.waitForFunction(() => document.querySelector('.digits').textContent.length > 24, null, { timeout: 10000 });

  // talking to the machine on the white page; "phi" must not trigger "hi"
  await page.keyboard.type('hello');
  await page.waitForFunction(() => document.querySelector('#whisper').textContent.includes("it's been a while"), null, { timeout: 5000 });
  await page.keyboard.type(' phi');
  await page.waitForFunction(() => document.querySelector('#whisper').textContent.includes("I won't stop myself"), null, { timeout: 5000 });

  // `postcard` downloads a png
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.keyboard.type(' postcard')]);
  assert(/^phi-lab-postcard-\d{4}-\d{2}-\d{2}\.png$/.test(download.suggestedFilename()), download.suggestedFilename());
  assert((await require('fs').promises.stat(await download.path())).size > 10000, 'postcard png too small');

  // two (scaled) minutes of silence: the machine asks, then notices you again
  await page.waitForFunction(() => document.querySelector('#whisper').textContent.includes('are you still there?'), null, { timeout: 20000 });
  await page.mouse.move(200, 200);
  await page.mouse.move(260, 240);
  await page.waitForFunction(() => document.querySelector('#whisper').textContent.includes("oh. you're still here."), null, { timeout: 5000 });
  const digits = await page.textContent('.digits');
  assert('1.6180339887498948482045868343656381177203'.startsWith(digits) || digits.startsWith('1.6180339887498948482045868343656381177203'), digits);
  assert.deepStrictEqual(errors, []);

  // skip() typed in the browser console jumps the log straight to the prompt
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForTimeout(1500);
  assert.strictEqual(await page.evaluate(() => skip()), 'ok. skipping the boring part.');
  await page.waitForFunction(() => document.body.innerText.includes('RENDER golden_hour?'), null, { timeout: 5000 });

  assert.strictEqual(await page.$('#loader'), null, 'loader must be gone once scripts run');

  // 1618 does nothing during the dark part of the story...
  await page.goto('file://' + path.resolve(__dirname, '../index.html') + '?fast');
  await page.waitForTimeout(500);
  await page.keyboard.type('1618');
  await page.waitForTimeout(300);
  assert(await page.isHidden('#journal'), '1618 must not open the journal before the white page');
  // ...and opens the keeper's journal on the white ending, which types out to the last entry
  await page.waitForFunction(() => document.body.innerText.includes('RENDER golden_hour?'), null, { timeout: 30000 });
  await page.keyboard.press('y');
  await page.waitForSelector('#end:not([hidden])', { timeout: 30000 });
  await page.keyboard.type('1618');
  await page.waitForSelector('#journal:not([hidden])', { timeout: 5000 });
  // the journal owns its vignette and the overlay stops flickering over it (it used to blink there)
  const look = await page.evaluate(() => ({
    overlay: getComputedStyle(document.querySelector('.crt')).animationName,
    overlayBg: getComputedStyle(document.querySelector('.crt')).backgroundImage,
    journalBg: getComputedStyle(document.querySelector('#journal')).backgroundImage,
  }));
  assert.strictEqual(look.overlay, 'none', 'overlay must not flicker over the journal');
  assert(!look.overlayBg.includes('radial-gradient') && look.journalBg.includes('radial-gradient'), JSON.stringify(look));
  await page.waitForFunction(() => document.querySelector('#journal').innerText.includes('someone will read the log.'), null, { timeout: 30000 });
  await page.waitForFunction(() => document.querySelector('#term').textContent.includes("third time. I'm starting to recognise you."), null, { timeout: 30000 });
  assert(await page.textContent('#journal').then((t) => t.includes('last entry')));

  // `mail` after the journal: the outbox lists 1617 letters, opens a few and writes the 1618th
  await page.waitForSelector('#journal .cur', { timeout: 30000 });
  await page.keyboard.type('mail');
  await page.waitForFunction(() => document.querySelector('#journal').innerText.includes('1618 messages · 0 read'), null, { timeout: 60000 });
  const outbox = await page.textContent('#journal');
  assert(outbox.includes('night 1617') && outbox.includes('someone read your journal tonight'), 'outbox incomplete');

  // the next visit is remembered (same browser profile)
  await page.goto('file://' + path.resolve(__dirname, '../index.html') + '?fast');
  await page.waitForFunction(() => document.body.innerText.includes('you read the journal last time'), null, { timeout: 30000 });
  assert(await page.textContent('#term').then((t) => t.includes('you came back.')));
  assert(await page.textContent('#term').then((t) => t.includes('1 user online')));
  // returning visitors skip the calibration gag
  await page.waitForFunction(() => document.querySelector('#term').textContent.includes('lens cap is off this time'), null, { timeout: 30000 });
  assert(await page.textContent('#term').then((t) => !t.includes('retry 1')), 'return visit should skip calibration');
  assert.deepStrictEqual(errors, []);

  // 13th visit: the machine writes its own journal entry
  await page.evaluate(() => {
    const m = JSON.parse(localStorage.getItem('phi-lab'));
    m.visits = 12;
    localStorage.setItem('phi-lab', JSON.stringify(m));
  });
  await page.goto('file://' + path.resolve(__dirname, '../index.html') + '?fast');
  await page.waitForFunction(() => document.querySelector('#term').textContent.includes('thirteen. you\'ve been here more than anyone'), null, { timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('RENDER golden_hour?'), null, { timeout: 30000 });
  await page.keyboard.press('y');
  await page.waitForSelector('#end:not([hidden])', { timeout: 30000 });
  await page.keyboard.type('1618');
  await page.waitForFunction(() => document.querySelector('#journal').innerText.includes("I'll keep counting for both of us."), null, { timeout: 30000 });
  assert.deepStrictEqual(errors, []);

  await browser.close();
  console.log('ok');
})().catch((e) => { console.error(e); process.exit(1); });
