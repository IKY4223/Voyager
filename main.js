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

function newLine() {
  term.querySelector('.cur')?.classList.remove('cur');
  const d = document.createElement('div');
  d.className = 'ln cur';
  term.append(d);
  term.scrollTop = term.scrollHeight;
  return d;
}

async function type(el, s, delay = 6, jitter = 0) {
  for (const seg of segs(s)) {
    const sp = document.createElement('span');
    if (seg.cls) sp.className = seg.cls;
    el.append(sp);
    for (const ch of seg.text) {
      sp.textContent += ch;
      term.scrollTop = term.scrollHeight;
      await sleep(delay + rand(0, jitter));
    }
  }
}

async function bar(el, to, end) {
  const n = 16;
  const sp = document.createElement('span');
  el.append(sp);
  for (let p = 0; ; p = Math.min(to, p + Math.round(rand(3, 11)))) {
    const k = Math.round((p / 100) * n);
    sp.textContent = ` [${'#'.repeat(k)}${'.'.repeat(n - k)}] ${String(p).padStart(3)}%`;
    if (p >= to) break;
    await sleep(rand(30, 90));
  }
  if (end) {
    await sleep(250);
    await type(el, ' >> ' + end);
  }
}

const ME = '{dim:<[}{pink:sys@φ-lab}{dim:]>} ';
const KEEPER = '{dim:<[}{gold:keeper@φ-lab}{dim:]>} ';

// string = log line; {cmd} = typed after a prompt; {bar} = progress bar; {wait} = pause
const SCRIPT = [
  { prompt: ME, cmd: 'wake --soft' },
  '{dim:// note :: if you can read this, the lights are still on.}',
  '{dim:// ∴ :: left a note for you in the console.}',
  '',
  'POWER_STATE... >> CHECKING... >> {ok:STABLE}',
  'CLOCK_SYNC... >> last sync: 1618 days ago >> {warn:DRIFTED}',
  'WHO >> {dim:0 users online}',
  '{ok:[✓]} Memory banks intact. Mostly.',
  '{ok:[✓]} Mounting /dev/sky... {dim:quiet~}',
  'LOCATING_OBSERVATORY... >> φ-lab.local >> {ok:FOUND}',
  { text: 'TELESCOPE[arm_0] >> CALIBRATING', bar: 100, end: '{err:JAMMED}' },
  { text: 'TELESCOPE[arm_0] >> retry 1', bar: 100, end: '{err:JAMMED}' },
  { text: 'TELESCOPE[arm_0] >> retry 2', bar: 100, end: '{err:JAMMED}' },
  { wait: 700 },
  '{dim:...hm.}',
  { wait: 900 },
  'TELESCOPE[arm_0] >> lens_cap: {warn:ON}',
  { wait: 600 },
  'TELESCOPE[arm_0] >> lens_cap: OFF >> {ok:CLEAR}',
  "{dim:(...let's pretend that didn't happen.)}",
  '',
  { prompt: ME + '$ ', cmd: 'su - keeper' },
  'Password: ',
  { prompt: '', cmd: '********' },
  KEEPER + 'auth() >> {ok:OK} (role: KEEPER, shift: night)',
  '{dim:last keeper login: 1618 days ago. it was me.}',
  '',
  { text: 'GREENHOUSE.cam[2] >> sunflower', bar: 100, end: '{ok:CAPTURED}' },
  'SEED_ANGLE(sunflower) >> {gold:137.507°} between every seed',
  { text: 'ARCHIVE >> nautilus_shell.scan', bar: 100, end: '{ok:LOADED}' },
  'CHAMBER_RATIO(nautilus) >> 1.33 >> {warn:not φ. people always said it was.}',
  { text: 'SCANNING_SKY >> M51, the Whirlpool', bar: 100, end: '{ok:DONE}' },
  'ARM_SHAPE(M51) >> logarithmic spiral >> {gold:close to φ. close enough.}',
  'COUNT(observers) >> {dim:0}',
  '',
  { prompt: KEEPER + '$ ', cmd: 'compute --ratio 1.6180339887' },
  'φ = 1 + 1/(1 + 1/(1 + 1/(1 + …))) >> {gold:only ones, all the way down}',
  'SEQ[1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144 ...] >> {gold:converging}',
  { text: 'ITERATE[1 -> 233]', bar: 100, end: '{ok:DONE}' },
  { text: 'ITERATE[233 -> 46368]', bar: 100, end: '{ok:DONE}' },
  'ITERATE[46368 -> ∞] >> LOOPING {gold:1.618033988749894...}',
  { wait: 900 },
  '{warn:[WARN]} Infinity is not a number. Breaking out gently...',
  '{ok:[✓]} Spiral resolved. Smells like rain. ^_^',
  '',
  '{pink:[REMINDER]} φ² = φ + 1. 2.618… = 1.618… + 1. still true. checked again.',
  '{warn:[WARN]} nobody is reading this log.',
  { wait: 1200 },
  '{dim:...probably.}',
  '',
  '{dim:<p::render>} MANIFEST >> codename: golden_hour >> {ok:READY}',
  'Your turn~',
];

const QUIPS = [
  "(It's just Y. Or any key.)",
  '(A tap works too.)',
  "(Still there? It's been a while since anyone was.)",
  '(Y. Between T and U.)',
  "(I can wait. I'm very good at waiting. 1618 days, remember?)",
];

async function runScript() {
  for (const step of SCRIPT) {
    if (typeof step === 'string') {
      await type(newLine(), step);
      await sleep(step ? rand(120, 320) : 200);
    } else if (step.wait) {
      await sleep(step.wait);
    } else if (step.cmd) {
      // "Password: " already sits on the last line, so continue it
      const el = step.prompt === '' ? term.lastElementChild : newLine();
      await type(el, step.prompt);
      await sleep(500);
      await type(el, step.cmd, 60, 70);
      await sleep(400);
    } else if (step.bar) {
      const el = newLine();
      await type(el, step.text);
      await bar(el, step.bar, step.end);
      await sleep(300);
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
  const el = newLine();
  await type(el, 'RENDER golden_hour? {pink:(Y/y)} ');
  let stop = false;
  (async () => {
    for (const q of QUIPS) {
      await sleep(6000);
      if (stop) return;
      const cur = term.querySelector('.cur');
      await type(newLine(), '{dim:' + q + '}', 25);
      if (stop) return;
      cur?.classList.add('cur'); // keep the cursor blinking after the question
      term.lastElementChild.classList.remove('cur');
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
  await sleep(600);
  await runScript();
  intro = false;
  skipping = false;
  await ask();
  await reveal();
})();
