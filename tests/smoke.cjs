// Smoke test: plays the whole story at 20x speed in headless Chromium and checks every feature once.
// Run: node tests/smoke.cjs   (needs Playwright with Chromium)
//
// The steps share one browser profile on purpose: visits are counted in localStorage,
// so the order below is the visitor's history (visit 1, 2, 3, 4, then a faked 13th).

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

const SITE = 'file://' + path.resolve(__dirname, '../index.html');
const NOT_FOUND = 'file://' + path.resolve(__dirname, '../404.html');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  const text = (selector) => page.textContent(selector);
  const waitForText = (selector, wanted, timeout = 30000) =>
    page.waitForFunction(([s, w]) => document.querySelector(s).textContent.includes(w), [selector, wanted], { timeout });
  const waitForPrompt = () => waitForText('#term', 'RENDER golden_hour?');
  const playToEnding = async () => {
    await waitForPrompt();
    await page.keyboard.press('y');
    await page.waitForSelector('#end:not([hidden])', { timeout: 30000 });
  };
  const step = async (name, run) => {
    try {
      await run();
    } catch (error) {
      error.message = `[${name}] ${error.message}`;
      throw error;
    }
  };

  await step('visit 1: the log', async () => {
    await page.goto(SITE + '?fast');
    await waitForPrompt();
    const log = await text('#term');
    assert(log.includes('Hello, world!'), 'log must greet the world');
    assert(!log.includes('REMOTE_TERMINAL'), 'the log must not talk about the visitor machine');
    assert(log.includes('0 users online') && log.includes('retry 1'), 'first visit plays the full log');
    assert(await page.isHidden('#poem'), 'the reveal must wait for input');
    assert.strictEqual(await page.evaluate(() => getComputedStyle(document.body).userSelect), 'none', 'text must not be selectable');
    assert.strictEqual(await page.$('#loader'), null, 'loader must be gone once scripts run');
  });

  await step('real-world maths', async () => {
    // full moon 2024-04-23 23:49 UTC, new moon (eclipse) 2024-04-08 18:21 UTC
    const full = await page.evaluate(() => moon(new Date('2024-04-23T23:49:00Z')));
    const dark = await page.evaluate(() => moon(new Date('2024-04-08T18:21:00Z')));
    assert(full.name === 'full moon' && full.lit > 0.97, JSON.stringify(full));
    assert(dark.name === 'new moon' && dark.lit < 0.03, JSON.stringify(dark));
    // golden dates: month/day are neighbouring Fibonacci numbers
    const golden = await page.evaluate(() => [[0, 1], [0, 2], [1, 3], [2, 5], [4, 8], [7, 13], [4, 9], [6, 21]].map(([m, d]) => goldenDate(new Date(2026, m, d))));
    assert.deepStrictEqual(golden, [true, true, true, true, true, true, false, false]);
  });

  await step('visit 1: reveal and ending', async () => {
    await page.keyboard.press('y');
    await page.waitForSelector('#poem:not([hidden])', { timeout: 15000 });
    await page.waitForSelector('#poem.dream .line', { timeout: 30000 });
    assert(await page.isHidden('#poem .label'), 'the label must not show on the white page (it used to jump left)');
    await page.waitForSelector('#end:not([hidden])', { timeout: 30000 });
    assert(await page.evaluate(() => document.body.classList.contains('light')), 'ending must be in the light theme');
    await waitForText('#end .output', '1.618033988749895', 10000);
    assert.strictEqual(await page.$('#end h1'), null, 'no big φ on the white page');
    // the endless digits are exact (BigInt), not float noise
    await page.waitForFunction(() => document.querySelector('.digits').textContent.length > 24, null, { timeout: 10000 });
    const digits = await text('.digits');
    const PHI = '1.6180339887498948482045868343656381177203';
    assert(PHI.startsWith(digits) || digits.startsWith(PHI), digits);
  });

  await step('ending: whispers, talking, postcard, idle check', async () => {
    await waitForText('#whisper', 'you can type to me', 10000); // the hint always comes first
    await page.keyboard.type('hello');
    await waitForText('#whisper', "it's been a while", 5000);
    await page.keyboard.type(' phi'); // must not trigger "hi"
    await waitForText('#whisper', "I won't stop myself", 5000);

    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.keyboard.type(' postcard')]);
    assert(/^phi-lab-postcard-\d{4}-\d{2}-\d{2}\.png$/.test(download.suggestedFilename()), download.suggestedFilename());
    assert((await fs.promises.stat(await download.path())).size > 10000, 'postcard png too small');

    // two (scaled) minutes of silence: the machine asks, then notices you again
    await waitForText('#whisper', 'are you still there?', 20000);
    await page.mouse.move(200, 200);
    await page.mouse.move(260, 240);
    await waitForText('#whisper', "oh. you're still here.", 5000);
    assert.deepStrictEqual(errors, []);
  });

  await step('visit 2: skip() jumps the log to the prompt', async () => {
    await page.goto(SITE);
    await page.waitForTimeout(1500);
    assert.strictEqual(await page.evaluate(() => skip()), 'ok. skipping the boring part.');
    await waitForText('#term', 'RENDER golden_hour?', 5000);
  });

  await step('visit 3: journal and outbox', async () => {
    await page.goto(SITE + '?fast');
    await page.waitForTimeout(500);
    await page.keyboard.type('1618');
    await page.waitForTimeout(300);
    assert(await page.isHidden('#journal'), '1618 must not open the journal before the white page');
    await playToEnding();
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

    await waitForText('#journal', 'the mail still works');
    await waitForText('#term', "third time. I'm starting to recognise you.");
    assert((await text('#journal')).includes('last entry'));

    // `mail` after the journal: 1617 unread letters, a few opened, and the 1618th written live
    await page.waitForSelector('#journal .cur', { timeout: 30000 });
    await page.keyboard.type('mail');
    await waitForText('#journal', '1618 messages · 0 read', 60000);
    const outbox = await text('#journal');
    assert(outbox.includes('night 1617') && outbox.includes('someone read your journal tonight'), 'outbox incomplete');
  });

  await step('visit 4: the machine remembers', async () => {
    await page.goto(SITE + '?fast');
    await waitForText('#term', 'lens cap is off this time');
    const log = await text('#term');
    assert(log.includes('you came back.') && log.includes('1 user online') && log.includes('you read the journal last time'));
    assert(!log.includes('retry 1'), 'return visits skip the calibration');
    assert.deepStrictEqual(errors, []);
  });

  await step('visit 13: the machine writes in the journal', async () => {
    await page.evaluate(() => {
      const memory = JSON.parse(localStorage.getItem('phi-lab'));
      memory.visits = 12;
      memory.first = Date.now() - 12 * 86400000;
      localStorage.setItem('phi-lab', JSON.stringify(memory));
    });
    await page.goto(SITE + '?fast');
    await waitForText('#term', "thirteen. you've been here more than anyone");
    assert((await text('#term')).includes('you first found me 12 days ago'));
    await playToEnding();
    await page.keyboard.type('1618');
    await waitForText('#journal', "I'll keep counting for both of us.");
    assert.deepStrictEqual(errors, []);
  });

  await step('404 page', async () => {
    await page.goto(NOT_FOUND);
    assert((await text('main')).includes('this sector of the sky is empty'));
    assert.deepStrictEqual(errors, []);
  });

  await browser.close();
  console.log('ok');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
