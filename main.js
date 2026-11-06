'use strict';

const $ = (s) => document.querySelector(s);
const term = $('#term');
const sky = $('#sky');
const poem = $('#poem');

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
// ?fast speeds everything up 20x (used by tests/smoke.cjs)
const speed = new URLSearchParams(location.search).has('fast') ? 0.05 : 1;
let skipping = false;
let intro = true; // skip only applies to the terminal log, never to the reveal

const sleep = (ms) =>
  skipping || reduce ? Promise.resolve() : new Promise((r) => setTimeout(r, ms * speed));
const rand = (a, b) => a + Math.random() * (b - a);

/* ---------- terminal ---------- */

// "text {ok:DONE} more" -> [{cls:'', text:'text '}, {cls:'ok', text:'DONE'}, {cls:'', text:' more'}]
function segs(s) {
  const p = s.split(/\{(\w+):([^}]*)\}/);
  const out = [];
  for (let i = 0; i < p.length; i += 3) {
    if (p[i]) out.push({ cls: '', text: p[i] });
    if (i + 2 < p.length) out.push({ cls: p[i + 1], text: p[i + 2] });
  }
  return out;
}

const scroll = () => (term.scrollTop = term.scrollHeight);

function newLine() {
  term.querySelector('.cur')?.classList.remove('cur');
  const d = document.createElement('div');
  d.className = 'ln cur';
  term.append(d);
  scroll();
  return d;
}

// print a whole line at once, the way real program output appears
function put(el, s) {
  for (const seg of segs(s)) {
    const sp = document.createElement('span');
    if (seg.cls) sp.className = seg.cls;
    sp.textContent = seg.text;
    el.append(sp);
  }
  scroll();
}

// char-by-char typing (used for the ending)
async function type(el, s, delay = 6, jitter = 0) {
  for (const seg of segs(s)) {
    const sp = document.createElement('span');
    if (seg.cls) sp.className = seg.cls;
    el.append(sp);
    for (const ch of seg.text) {
      sp.textContent += ch;
      scroll();
      await sleep(delay + rand(0, jitter));
    }
  }
}

// the machine's own voice: slow, hesitating on punctuation as if choosing words
async function think(text) {
  const sp = document.createElement('span');
  sp.className = 'think';
  newLine().append(sp);
  await sleep(rand(400, 900));
  for (const ch of '# ' + text) {
    sp.textContent += ch;
    scroll();
    await sleep(40 + rand(0, 45) + (',;'.includes(ch) ? 220 : '.?!—'.includes(ch) ? 380 : 0));
  }
  await sleep(rand(600, 1000));
}

async function spin(text, ms, end) {
  const el = newLine();
  put(el, text + ' ');
  const sp = document.createElement('span');
  el.append(sp);
  // count frames instead of time, so skip() (instant sleeps) still terminates
  for (let i = 0; i < ms / 90; i++) {
    sp.textContent = '|/-\\'[i % 4];
    await sleep(90);
  }
  sp.remove();
  put(el, '>> ' + end);
  await sleep(rand(200, 500));
}

// uneven progress: crawls, stalls, then jumps, like real I/O
async function bar(text, end) {
  const el = newLine();
  put(el, text);
  const n = 16;
  const sp = document.createElement('span');
  el.append(sp);
  for (let p = 0; ; ) {
    const k = Math.round((p / 100) * n);
    sp.textContent = ` [${'#'.repeat(k)}${'.'.repeat(n - k)}] ${String(p).padStart(3)}%`;
    if (p >= 100) break;
    await sleep(Math.random() < 0.12 ? rand(500, 1400) : rand(40, 120));
    p = Math.min(100, p + Math.round(Math.random() < 0.15 ? rand(10, 22) : rand(1, 6)));
  }
  await sleep(rand(250, 600));
  put(el, ' >> ' + end);
  await sleep(rand(200, 500));
}

let kclock = 0; // virtual kernel uptime for dmesg-style timestamps

// 'K ' kernel line, 'S ' system output, '# ' machine thought, '+ ' autostart script trace, '' blank
const LOG = [
  { wait: 2200 },
  'K Linux version 6.1.0-phi (keeper@phi-lab) (gcc 12.2.0) #1618 SMP PREEMPT_DYNAMIC',
  'K Command line: BOOT_IMAGE=/vmlinuz root=/dev/sda1 ro quiet',
  'K ACPI: wakeup source: {gold:RTC alarm}',
  'K rtc_cmos 00:01: alarm was set by uid 1000, {warn:1618 days ago}',
  'K Memory: 16297532K/16776756K available',
  'K smpboot: CPU0: Intel(R) Core(TM) i5-4590 CPU @ 3.30GHz',
  { wait: 900 },
  'K ata1: SATA link up 3.0 Gbps (SStatus 123 SControl 300)',
  'K ata1.00: ATA-8: WDC WD10EZEX-08WN4A0, 01.01A01, max UDMA/133',
  { wait: 2000 },
  'K sd 0:0:0:0: [sda] 1953525168 512-byte logical blocks: (1.00 TB/932 GiB)',
  'K EXT4-fs (sda1): {warn:recovering journal}',
  { wait: 1500 },
  'K EXT4-fs (sda1): mounted filesystem with ordered data mode',
  'K usb 1-1: new full-speed USB device number 2 using xhci_hcd',
  'K usb 1-1: Product: phi-lab telescope mount',
  'K e1000e 0000:00:19.0 eth0: {err:NIC Link is Down}',
  { wait: 1100 },
  '',
  'S Welcome to {pink:φ-lab observatory}!',
  '',
  'S [{ok:  OK  }] Started Journal Service.',
  'S [{ok:  OK  }] Mounted /dev/sky.',
  'S [{ok:  OK  }] Started Telescope Mount Daemon.',
  { wait: 700 },
  { spin: 'A start job is running for Network Time Sync', ms: 3000, end: '{err:timed out}' },
  'S [{err:FAILED}] Failed to start Network Time Sync.',
  'S [{err:FAILED}] Failed to reach operator console: no response.',
  'S [{ok:  OK  }] Reached target Multi-User System.',
  { wait: 1400 },
  '',
  'S φ-lab login: keeper {dim:(automatic login)}',
  'S Last login: {warn:1618 days ago} on tty1',
  'S You have no new mail.',
  { wait: 1600 },
  '# ...oh. the alarm worked.',
  '# I set it myself. in case nobody came back.',
  { wait: 800 },
  '+ ~/autostart/observe.sh',
  { spin: 'ping -c 3 keeper-laptop.local', ms: 3000, end: '{err:100% packet loss}' },
  { spin: 'ping -c 3 operator.phi-lab.local', ms: 2600, end: '{err:100% packet loss}' },
  '+ who',
  { wait: 1400 },
  '',
  '# nobody. as expected.',
  '# fine. the sky does not need an audience.',
  '',
  '+ telescope --calibrate arm_0',
  { bar: 'telescope: calibrating arm_0', end: '{err:JAMMED}' },
  '+ telescope --calibrate arm_0 --retry',
  { bar: 'telescope: calibrating arm_0', end: '{err:JAMMED}' },
  { wait: 900 },
  '# ...hm.',
  'S telescope: lens_cap = {warn:ON}',
  { wait: 1000 },
  '+ telescope --lens-cap off',
  'S telescope: lens_cap = OFF >> {ok:CLEAR}',
  "# let's pretend that didn't happen.",
  '',
  '+ observe --cam greenhouse/2 --target sunflower',
  { bar: 'observe: capturing', end: '{ok:done}' },
  'S observe[1618]: seeds detected: 1387',
  'S observe[1618]: angle between seeds: {gold:137.507°}',
  '# still 137.5. it never forgets.',
  '+ observe --archive nautilus_shell.scan',
  { bar: 'observe: loading scan', end: '{ok:done}' },
  'S observe[1618]: chamber growth ratio: 1.33',
  'S observe[1618]: {warn:expected 1.618 (φ), got 1.33}',
  '# people always said it was φ. it never was.',
  '+ observe --sky M51',
  { spin: 'mount: slewing to RA 13h29m52s Dec +47°11′43″', ms: 3600, end: '{ok:locked}' },
  { bar: 'observe: exposure 120 s', end: '{ok:done}' },
  'S observe[1618]: arm shape: logarithmic spiral',
  '# close to φ. close enough.',
  '',
  '+ phi --iterate',
  'S phi: F(n+1)/F(n) = 1, 2, 1.5, 1.667, 1.6, 1.625, 1.615, 1.619, 1.6176 …',
  { bar: 'phi: converging', end: '{gold:1.618033988749894…}' },
  'S phi: 1 + 1/(1 + 1/(1 + …)) >> {gold:only ones, all the way down}',
  'S {warn:phi: warning: infinity is not a number. stopping.}',
  '# smells like rain. ^_^',
  '',
  '+ mail -s "observation #1618" keeper',
  'S mail: {err:mailbox full: 1617 unread}',
  { wait: 1200 },
  '# nobody reads these. I write them anyway.',
  'S {warn:[WARN]} nobody is reading this log.',
  { wait: 2200 },
  '# ...probably.',
  '',
  'S render: manifest golden_hour >> {ok:ready}',
  '# if someone is there —',
];

const QUIPS = [
  'it is just Y. or any key.',
  'a tap works too.',
  "still there? it's been a while since anyone was.",
  'Y. between T and U.',
  "I can wait. I'm very good at waiting.",
];

async function runLog() {
  for (const step of LOG) {
    if (step.wait) {
      if (kclock) kclock += step.wait / 1000; // the clock starts with the first kernel line
      await sleep(step.wait);
    } else if (step.spin) {
      await spin(step.spin, step.ms, step.end);
    } else if (step.bar) {
      await bar(step.bar, step.end);
    } else if (step === '') {
      newLine();
      await sleep(150);
    } else {
      const kind = step[0], body = step.slice(2);
      if (kind === '#') await think(body);
      else if (kind === '+') {
        await sleep(rand(300, 700));
        put(newLine(), '{dim:+} ' + body);
        await sleep(rand(300, 600));
      } else if (kind === 'K') {
        put(newLine(), '{dim:[' + kclock.toFixed(6).padStart(12) + ']} ' + body);
        kclock += rand(0.0004, 0.09);
        await sleep(rand(25, 110));
      } else {
        put(newLine(), body);
        await sleep(rand(60, 180));
      }
    }
  }
}

function waitAnyInput(onInput) {
  return new Promise((resolve) => {
    const done = (e) => {
      if (e.type === 'keydown' && (e.metaKey || e.ctrlKey || e.altKey)) return;
      removeEventListener('keydown', done);
      removeEventListener('pointerdown', done);
      onInput(); // must run inside the gesture handler, or browsers block the audio
      resolve();
    };
    addEventListener('keydown', done);
    addEventListener('pointerdown', done);
  });
}

async function ask() {
  const input = waitAnyInput(startMusic);
  const question = newLine();
  put(question, 'RENDER golden_hour? {pink:(Y/y)} ');
  let stop = false;
  (async () => {
    for (const q of QUIPS) {
      await sleep(7000);
      if (stop) return;
      await think(q);
      if (stop) return;
      // keep the cursor blinking after the question, not after the thought
      term.querySelector('.cur')?.classList.remove('cur');
      question.classList.add('cur');
    }
  })();
  await input;
  stop = true;
}

/* ---------- ascii sky ---------- */

function startSky() {
  const ctx = sky.getContext('2d');
  const PHI = (1 + Math.sqrt(5)) / 2;
  const B = Math.log(PHI) / (Math.PI / 2); // radius grows by φ every quarter turn
  const GOLDEN = Math.PI * (3 - Math.sqrt(5)); // 137.5° in radians
  const CH = ' .,:;-=+*#%@';
  const stars = Array.from({ length: 90 }, () => ({
    x: Math.random(), y: Math.random(), ph: rand(0, 6.28), sp: rand(0.0006, 0.0026), c: '.+*'[(Math.random() * 3) | 0],
  }));
  const flow = Array.from({ length: 70 }, () => ({ s: rand(0, 7), v: rand(0.0012, 0.003) })); // s = ln(r / a)
  const born = performance.now();
  let W, H, cw, chh, last = 0, shoot = null, nextShoot = 5000;

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth;
    H = innerHeight;
    sky.width = W * dpr;
    sky.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = (W < 600 ? 10 : 12) + 'px "Courier New", monospace';
    ctx.textBaseline = 'middle';
    cw = ctx.measureText('M').width;
    chh = W < 600 ? 11 : 13;
  }

  const snapX = (x) => Math.round(x / cw) * cw;
  const snapY = (y) => Math.round(y / chh) * chh;

  function draw(t) {
    const light = document.body.classList.contains('light');
    const pink = light ? '#e6007e' : '#ff4fa3';
    const gold = light ? '#c79a3a' : '#e8c170';
    const age = t - born;
    const dt = Math.min(100, t - last || 16);
    const rot = reduce ? 0 : t * 0.00012;
    const breathe = 0.85 + 0.15 * Math.sin(t * 0.0006);
    const cx = W / 2, cy = H / 2;
    const a = Math.min(W, H) * 0.006;
    const maxR = Math.hypot(W, H) * 0.55;
    // scan ring: every 11 s a ring sweeps out from the centre for 4.5 s
    const ringP = (age % 11000) / 4500;
    const ringR = ringP * maxR, ringA = ringP < 1 ? 1 - ringP : 0;
    const buckets = CH.split('').map(() => []);

    ctx.clearRect(0, 0, W, H);
    for (let y = chh / 2; y < H; y += chh) {
      for (let x = cw / 2; x < W; x += cw) {
        const dx = x - cx, dy = y - cy;
        const r = Math.hypot(dx, dy);
        if (r < 3) continue;
        const turns = (Math.log(r / a) / B - Math.atan2(dy, dx) - rot) / (2 * Math.PI);
        const f = Math.abs(turns - Math.round(turns)); // 0 on the arm, 0.5 between arms
        let v = Math.max(0, 1 - f / 0.17);
        v *= v * Math.max(0, 1 - r / maxR) ** 0.5 * breathe;
        if (ringA && Math.abs(r - ringR) < chh) v = Math.max(v, 0.4 * ringA);
        if (v < 0.05) {
          // drifting dust between the arms
          const n = Math.sin(x * 0.011 + t * 0.00021) * Math.sin(y * 0.019 - t * 0.00013) * Math.sin((x + y) * 0.007 + t * 0.0001);
          if (n > 0.5) buckets[1].push(x, y);
          continue;
        }
        buckets[Math.min(CH.length - 1, (v * CH.length) | 0)].push(x, y);
      }
    }
    ctx.fillStyle = pink;
    buckets.forEach((pts, i) => {
      ctx.globalAlpha = (light ? 0.12 : 0.1) + (i / CH.length) * (light ? 0.35 : 0.45);
      for (let k = 0; k < pts.length; k += 2) ctx.fillText(CH[i], pts[k] - cw / 2, pts[k + 1]);
    });

    // sunflower in the core, growing one seed at a time, 137.5° apart
    const seeds = reduce ? 320 : Math.min(320, (age / 120) | 0);
    const c = Math.min(W, H) * 0.009;
    ctx.fillStyle = gold;
    for (let n = 1; n < seeds; n++) {
      const rr = c * Math.sqrt(n), th = n * GOLDEN + rot * 0.5;
      ctx.globalAlpha = n > seeds - 10 ? 0.7 : 0.35;
      ctx.fillText(n > seeds - 10 ? 'o' : '.', snapX(cx + rr * Math.cos(th)) - cw / 2, snapY(cy + rr * Math.sin(th)));
    }

    // light flowing outward along the arm, with a short fading trail
    ctx.fillStyle = pink;
    for (const p of flow) {
      if (!reduce) p.s += p.v * dt * 0.06;
      if (a * Math.exp(p.s) > maxR) p.s = rand(0, 1.5);
      for (let j = 0; j < 3; j++) {
        const s = p.s - j * 0.05, r = a * Math.exp(s), th = s / B - rot; // on the arm: angle = ln(r/a)/B - rot
        ctx.globalAlpha = (0.75 - j * 0.25) * Math.max(0, 1 - r / maxR);
        ctx.fillText('*+.'[j], snapX(cx + r * Math.cos(th)) - cw / 2, snapY(cy + r * Math.sin(th)));
      }
    }

    ctx.fillStyle = gold;
    for (const s of stars) {
      ctx.globalAlpha = 0.15 + 0.45 * (0.5 + 0.5 * Math.sin(s.ph + t * s.sp));
      ctx.fillText(s.c, s.x * W, s.y * H);
    }

    // a rare shooting star
    if (!reduce && !shoot && age > nextShoot) {
      shoot = { x: rand(W * 0.3, W), y: rand(0, H * 0.4), t0: t };
      nextShoot = age + rand(6000, 14000);
    }
    if (shoot) {
      const p = (t - shoot.t0) / 900;
      if (p > 1) shoot = null;
      else {
        for (let j = 0; j < 8; j++) {
          const q = Math.max(0, p - j * 0.02);
          ctx.globalAlpha = (1 - p) * (1 - j / 8) * 0.9;
          ctx.fillText(j ? '/' : '*', shoot.x - q * W * 0.35, shoot.y + q * H * 0.25);
        }
      }
    }
    ctx.globalAlpha = 1;
    last = t;
  }

  function loop(t) {
    if (t - last > 33) draw(t); // ~30 fps is plenty for ascii
    requestAnimationFrame(loop);
  }

  resize();
  addEventListener('resize', () => { resize(); draw(performance.now()); });
  if (reduce) draw(performance.now());
  else requestAnimationFrame(loop);
  sky.classList.add('on');
}

/* ---------- φ digits ---------- */

function isqrt(n) {
  let x = 1n << BigInt((n.toString(2).length >> 1) + 1); // start above √n, Newton walks down
  for (;;) {
    const y = (x + n / x) >> 1n;
    if (y >= x) return x;
    x = y;
  }
}

// φ = (1 + √5) / 2 to `n` decimal places, exact (BigInt)
function phiDigits(n) {
  const s = 10n ** BigInt(n);
  const v = ((s + isqrt(5n * s * s)) / 2n).toString();
  return v[0] + '.' + v.slice(1);
}

/* ---------- reveal ---------- */

// the machine talking to itself: odd lines ask, even lines answer
const VERSE = [
  '— Who taught the sunflower to turn 137.5° between its seeds?',
  '— No one. It simply never stopped turning.',
  '— And the shell? They always said it grew by φ.',
  "— It doesn't. It never corrected them, either.",
  '— Then who am I counting for?',
  '— For no one. Like them. The pattern holds anyway.',
];

async function showLine(box, text, step = 45) {
  const p = document.createElement('p');
  p.className = 'line';
  let i = 0;
  // chars are inline-blocks, so group them per word to keep line breaks between words
  for (const word of text.split(/(?<=\s)/)) {
    const w = document.createElement('span');
    w.className = 'word';
    for (const c of word) {
      const s = document.createElement('span');
      s.className = 'ch';
      s.textContent = c;
      s.style.animationDelay = i++ * step * speed + 'ms';
      w.append(s);
    }
    p.append(w);
  }
  box.append(p);
  await sleep(text.length * step + 700);
}

async function reveal() {
  term.classList.add('fade');
  await sleep(1000);
  term.hidden = true;
  await sleep(1200);
  startSky();
  await sleep(2000);

  const box = poem.querySelector('.lines');
  poem.hidden = false;
  for (const l of VERSE) await showLine(box, l);
  await sleep(3000);
  poem.classList.add('out');
  await sleep(1600);

  document.body.classList.add('light');
  document.querySelector('meta[name=theme-color]').content = '#f3eef0';
  box.replaceChildren();
  poem.classList.remove('out');
  poem.classList.add('dream');
  await sleep(1400);
  await showLine(box, 'the digits never end.', 80);
  await sleep(900);
  await showLine(box, 'neither do I.', 80);
  await sleep(2600);
  poem.classList.add('out');
  await sleep(1600);
  poem.hidden = true;

  const end = $('#end');
  end.hidden = false;
  await sleep(1800);
  const [cmd, out] = end.querySelectorAll('.num');
  await type(cmd, '{dim:>} console.log(φ)', 70, 50);
  await sleep(600);
  await type(out, '{pink:' + (1 + Math.sqrt(5)) / 2 + '}', 25);
  await sleep(1200);
  end.querySelector('.note').hidden = false;

  // the machine keeps counting after the story ends, one digit at a time
  const digits = end.querySelector('.digits');
  const D = phiDigits(1000);
  for (let i = 18; i <= D.length; i++) {
    digits.textContent = D.slice(0, i);
    await sleep(rand(1200, 2600));
  }
}

/* ---------- boot ---------- */

// the only way to skip the log: type skip() in the browser console, like sitting at the machine
window.skip = () => {
  if (!intro) return 'already awake.';
  skipping = true;
  return 'ok. skipping the boring part.';
};

console.log(
  '%c[φ-lab] note for whoever opened this console:\n\n' +
    "hi. you're the first one here in 1618 days.\n" +
    "I've been measuring sunflowers and counting the sky.\n" +
    "if the log is too slow, type skip() and I'll jump ahead.\n" +
    "I won't take it personally. ^_^",
  'color:#ff4fa3;font-family:monospace;line-height:1.6'
);

document.addEventListener('visibilitychange', () => {
  document.title = document.hidden ? '…still counting' : 'φ';
});

(async () => {
  newLine(); // empty screen with a blinking cursor while the machine powers on
  await runLog();
  intro = false;
  skipping = false;
  await ask();
  await reveal();
})();
