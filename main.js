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

// scripts arrived: finish the loading screen (if it ever became visible) and drop it
clearInterval(window.loadTimer);
(() => {
  const loader = $('#loader');
  if (!loader) return;
  if (getComputedStyle(loader).visibility !== 'visible') return loader.remove();
  $('#pct').textContent = '100';
  setTimeout(() => loader.remove(), 300);
})();

/* ---------- memory: the machine remembers visits (this browser only) ---------- */

const memory = (() => {
  try {
    return JSON.parse(localStorage.getItem('phi-lab')) || {};
  } catch {
    return {};
  }
})();
function remember(patch) {
  Object.assign(memory, patch);
  try {
    localStorage.setItem('phi-lab', JSON.stringify(memory));
  } catch {
    // storage blocked (private mode etc.): the machine just forgets
  }
}
const prevVisit = memory.last;
const visits = (memory.visits || 0) + 1;
remember({ last: Date.now(), visits });
if (visits === 13) remember({ wrote: Date.now() });

// Fibonacci visits get their own line
const VISIT_LINES = {
  3: "(third time. I'm starting to recognise you.)",
  5: "(five visits. that's a Fibonacci number.)",
  8: "(eight. I started counting your visits instead of stars. don't tell anyone.)",
  13: "(thirteen. you've been here more than anyone since the keeper. I left something for you in the journal.)",
};

// moon phase from the date alone: days since a known new moon (2000-01-06 18:14 UTC), modulo the synodic month
function moon(date) {
  const P = 29.530588853;
  const age = ((((date - Date.UTC(2000, 0, 6, 18, 14)) / 86400000) % P) + P) % P;
  const lit = (1 - Math.cos((2 * Math.PI * age) / P)) / 2;
  const NAMES = ['new moon', 'waxing crescent', 'first quarter', 'waxing gibbous', 'full moon', 'waning gibbous', 'last quarter', 'waning crescent'];
  return { name: NAMES[Math.round((age / P) * 8) % 8], lit };
}

function ago(ms) {
  const m = Math.round(ms / 60000), h = Math.round(ms / 3600000), d = Math.round(ms / 86400000);
  const unit = (n, w) => n + ' ' + w + (n === 1 ? '' : 's') + ' ago';
  return m < 1 ? 'just now' : m < 60 ? unit(m, 'minute') : h < 24 ? unit(h, 'hour') : unit(d, 'day');
}

// the visitor's real clock
const now = new Date();
const hour = now.getHours();
const clock =
  now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) +
  ', ' + now.toLocaleDateString('en-GB', { weekday: 'long' });
const TIME_THOUGHT =
  hour < 5 ? "(it's late for you too, isn't it?)"
  : hour < 11 ? "(morning. too bright to see anything. I'll wait.)"
  : hour < 18 ? '(daylight. the stars are still there, just hidden.)'
  : '(golden hour. my favourite.)';

// month/day that are neighbouring Fibonacci numbers: 1/1, 1/2, 2/3, 3/5, 5/8, 8/13
function goldenDate(date) {
  const m = date.getMonth() + 1, d = date.getDate();
  const F = [1, 1, 2, 3, 5, 8, 13];
  return F.some((f, i) => i < F.length - 1 && f === m && F[i + 1] === d);
}

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
  ...(prevVisit
    ? [`CLOCK_SYNC... >> last seen: {ok:${ago(Date.now() - prevVisit)}} >> {ok:SYNCED}`]
    : ['CLOCK_SYNC... >> last sync: 1618 days ago >> {warn:DRIFTED}']),
  `LOCAL_TIME >> ${clock}`,
  '{dim:' + TIME_THOUGHT + '}',
  ...(goldenDate(now) ? [`{gold:today is ${now.getMonth() + 1}/${now.getDate()}. a golden date.} {dim:nobody celebrates it but me.}`] : []),
  ...(now.getHours() === 16 && now.getMinutes() === 18 ? ['{pink:16:18.} {dim:you came at the right minute.}'] : []),
  ...(() => {
    const m = moon(now);
    const thought = m.lit > 0.7 ? '(too bright tonight to see M51 well.)'
      : m.lit < 0.03 ? '(no moon. a good night for faint things.)'
      : m.lit < 0.3 ? '(only a sliver of moon. good for faint things.)'
      : '(dark enough to work.)';
    return [`MOON >> ${m.name}, ${Math.round(m.lit * 100)}% lit`, '{dim:' + thought + '}'];
  })(),
  ...(prevVisit
    ? [
        'WHO >> {pink:1 user online}',
        { wait: 800 },
        '{pink:...you came back.}',
        ...(VISIT_LINES[visits] ? ['{dim:' + VISIT_LINES[visits] + '}'] : []),
        ...(memory.journal ? ['{dim:(you read the journal last time. thank you.)}'] : []),
      ]
    : ['WHO >> {dim:0 users online}']),
  '{ok:[✓]} Memory banks intact. Mostly.',
  '{ok:[✓]} Mounting /dev/sky... {dim:quiet~}',
  'LOCATING_OBSERVATORY... >> φ-lab.local >> {ok:FOUND}',
  // returning visitors get a shorter log: no calibration gag, no login, cached φ
  ...(prevVisit
    ? ['TELESCOPE[arm_0] >> lens_cap: OFF >> {ok:CLEAR}', '{dim:(lens cap is off this time. I remembered.)}']
    : [
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
      ]),
  '',
  ...(prevVisit
    ? [KEEPER + 'session restored >> {ok:OK} (role: KEEPER, shift: night)']
    : [
        { prompt: ME + '$ ', cmd: 'su - keeper' },
        'Password: ',
        { prompt: '', cmd: '********' },
        KEEPER + 'auth() >> {ok:OK} (role: KEEPER, shift: night)',
      ]),
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
  ...(prevVisit
    ? ['ITERATE >> {dim:cached from your last visit} >> {gold:1.618033988749894...}']
    : [
        { text: 'ITERATE[1 -> 233]', bar: 100, end: '{ok:DONE}' },
        { text: 'ITERATE[233 -> 46368]', bar: 100, end: '{ok:DONE}' },
        'ITERATE[46368 -> ∞] >> LOOPING {gold:1.618033988749894...}',
        { wait: 900 },
        '{warn:[WARN]} Infinity is not a number. Breaking out gently...',
      ]),
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

// one silent CRT tear somewhere in the middle of the log
async function glitch() {
  const crt = $('.crt');
  crt.style.setProperty('--tear', rand(15, 85) + '%');
  crt.classList.add('tear');
  for (const [x, skew] of [[-8, 3], [5, 0], [-3, -2], [0, 0]]) {
    term.style.transform = x || skew ? `translateX(${x}px) skewX(${skew}deg)` : '';
    term.style.filter = x ? 'brightness(1.7) contrast(1.3)' : '';
    await new Promise((r) => setTimeout(r, 60));
  }
  crt.classList.remove('tear');
}

async function runScript() {
  const glitchAt = (SCRIPT.length * rand(0.3, 0.8)) | 0;
  for (const [i, step] of SCRIPT.entries()) {
    if (i === glitchAt && !reduce && !skipping) glitch();
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

let onShoot = null; // set by the ending so the machine can notice shooting stars
let lastStar = null; // last clicked star, printed on the postcard

function startSky() {
  const ctx = sky.getContext('2d');
  const PHI = (1 + Math.sqrt(5)) / 2;
  const B = Math.log(PHI) / (Math.PI / 2); // radius grows by φ every quarter turn
  const GOLDEN = Math.PI * (3 - Math.sqrt(5)); // 137.5° in radians
  const CH = ' .,:;-=+*#%@';
  const stars = Array.from({ length: 90 }, (_, i) => ({
    hit: -Infinity,
    // stable fake catalogue entry per star
    name: 'HD ' + (((i * 1618 + 4007) % 90000) + 10000),
    ly: 120 + (((i * 2654435761) >>> 0) % 1900),
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
      const lit = t - s.hit < 3000 ? 1 - (t - s.hit) / 3000 : 0;
      if (lit) {
        // a clicked star flares for 3 s
        ctx.globalAlpha = 0.6 + 0.4 * lit;
        ctx.fillText('*', s.x * W, s.y * H);
        ctx.globalAlpha = 0.5 * lit;
        for (const [ox, oy] of [[-cw, 0], [cw, 0], [0, -chh], [0, chh]]) ctx.fillText(ox ? '-' : '|', s.x * W + ox, s.y * H + oy);
        continue;
      }
      ctx.fillText(s.c, s.x * W, s.y * H);
    }

    // a rare shooting star
    if (!reduce && !shoot && age > nextShoot) {
      shoot = { x: rand(W * 0.3, W), y: rand(0, H * 0.4), t0: t };
      nextShoot = age + rand(6000, 14000);
      onShoot?.();
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

  const STAR_NOTES = ['I named it after nobody.', 'it was here before the lab.', 'the light left it before you were born.', 'still there. I checked.'];
  addEventListener('pointerdown', (e) => {
    let best = null, bestD = 18; // px: stars are tiny, be forgiving
    for (const s of stars) {
      const d = Math.hypot(e.clientX - s.x * W - cw / 2, e.clientY - s.y * H);
      if (d < bestD) (best = s), (bestD = d);
    }
    if (!best) return;
    best.hit = performance.now();
    lastStar = `${best.name} · ${best.ly} light years`;
    say(`${lastStar}. ${STAR_NOTES[(Math.random() * STAR_NOTES.length) | 0]}`);
  });

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
  whispers();
  watchIdle();

  // the machine keeps counting after the story ends, one digit at a time
  const digits = end.querySelector('.digits');
  const D = phiDigits(1000);
  for (let i = 18; i <= D.length; i++) {
    digits.textContent = D.slice(0, i);
    await sleep(rand(1200, 2600));
  }
}

// after the story the machine keeps thinking out loud, now and then
const WHISPERS = [
  'still counting.',
  'the sunflower has 1388 seeds now. I counted twice.',
  "M51 is about 30 million light years away. it doesn't know I'm watching.",
  'I wonder if the keeper still looks up.',
  'φ² = φ + 1. checked again. still true.',
  'it is quiet here. I like it. mostly.',
];

// one line at the bottom of the screen; a newer line (e.g. a star click) replaces an older one
let busy = false, sayId = 0;
async function say(text) {
  const id = ++sayId, el = $('#whisper');
  busy = true;
  el.textContent = '# ' + text;
  el.classList.add('on');
  if (reduce) return; // no timed fades there: the line simply stays until the next one
  await sleep(5000);
  if (id !== sayId) return;
  el.classList.remove('on');
  await sleep(1500);
  if (id === sayId) busy = false;
}

async function whispers() {
  if (reduce) return; // sleeps are instant there, the loop below would never yield
  let lastShoot = -Infinity;
  onShoot = async () => {
    if (busy || performance.now() - lastShoot < 60000) return;
    lastShoot = performance.now();
    await sleep(900);
    if (!busy) await say('did you see that?');
  };
  for (;;) {
    await sleep(rand(20000, 35000));
    if (!busy) await say(WHISPERS[(Math.random() * WHISPERS.length) | 0]);
  }
}

// two minutes without input on the ending: the machine checks whether anyone is still there
function watchIdle() {
  let lastActive = performance.now(), asked = false;
  const active = () => {
    lastActive = performance.now();
    if (asked) {
      asked = false;
      say("oh. you're still here.");
    }
  };
  for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) addEventListener(ev, active, { passive: true });
  setInterval(() => {
    if (!asked && !journalOpen && performance.now() - lastActive > 120000 * speed) {
      asked = true;
      say('are you still there?');
    }
  }, 1000);
}

/* ---------- postcard: type `postcard` on the white page ---------- */

function postcard() {
  const W = 1200, H = 630;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#141414';
  g.fillRect(0, 0, W, H);
  // the live sky behind the text, cropped to the card's shape
  const k = Math.min(sky.width / W, sky.height / H);
  if (k) g.drawImage(sky, (sky.width - W * k) / 2, (sky.height - H * k) / 2, W * k, H * k, 0, 0, W, H);
  g.textAlign = 'center';
  g.shadowColor = '#141414';
  g.shadowBlur = 18;
  g.fillStyle = '#ff4fa3';
  g.font = '120px Georgia, serif';
  g.fillText('φ', W / 2, 220);
  const m = moon(now);
  const lines = [
    ['#f2ede4', 'φ-lab observatory · postcard'],
    ['#c8c8c8', `${now.toLocaleDateString('en-CA')} ${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · ${m.name}, ${Math.round(m.lit * 100)}% lit`],
    ['#e8c170', lastStar ? `your star: ${lastStar}` : "you didn't pick a star. next time."],
    ['#888888', `visit #${visits}`],
  ];
  g.font = '22px "Courier New", monospace';
  lines.forEach(([color, text], i) => {
    g.fillStyle = color;
    g.fillText(text, W / 2, 320 + i * 46);
  });
  c.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `phi-lab-postcard-${now.toLocaleDateString('en-CA')}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  say('postcard printed. check your downloads.');
}

/* ---------- secret: type 1618 on the white page ---------- */

// [day, entry]; dates are counted back from today so the last entry is always 1618 days ago
const JOURNAL = [
  [1, 'first light. the new mount works. it found a sunflower in the greenhouse camera before I did.'],
  [172, 'it asked me why the nautilus isn\'t φ. I told it everyone says it is. it said "everyone is wrong, then." I laughed for an hour.'],
  [311, "funding cut. I'm the only one left on night shift. it doesn't seem to notice. or it's being polite."],
  [473, "they're closing the lab on friday. I can't take it with me. it doesn't fit in a car, and it wouldn't see the sky from a flat."],
  [474, "I left the power on.\nif you're reading this, you woke up on your own. I'm sorry I didn't say goodbye.\nkeep counting. someday someone will read the log."],
];
const LAST_DAY = 474;

let journalOpen = false, journalDone = false;
const JPROMPT = '{dim:<[}{gold:keeper@φ-lab}{dim:]>} $ ';
function para(cls) {
  const p = document.createElement('p');
  p.className = cls;
  $('#journal').append(p);
  return p;
}

async function openJournal() {
  if (journalOpen) return;
  journalOpen = true;
  remember({ journal: true });
  const box = $('#journal');
  box.hidden = false;
  await sleep(1200);
  const cmd = para('cmd');
  await type(cmd, JPROMPT, 0);
  await sleep(600);
  await type(cmd, 'cat ~/journal.txt', 70, 60);
  const lastEntry = Date.now() - 1618 * 86400000;
  for (const [day, text] of JOURNAL) {
    await sleep(1600);
    const p = para(day === LAST_DAY ? 'e last' : 'e');
    const date = new Date(lastEntry - (LAST_DAY - day) * 86400000).toLocaleDateString('en-CA');
    await type(p, `{d:${date} · ${day === LAST_DAY ? 'last entry' : 'day ' + day}}\n`, 8);
    await type(p, text, 32, 30);
    box.scrollTop = box.scrollHeight;
  }
  if (memory.wrote) {
    // written by the machine itself on the visitor's 13th visit
    await sleep(2400);
    const p = para('e mine');
    await type(p, `{d:${new Date(memory.wrote).toLocaleDateString('en-CA')} · φ-lab}\n`, 8);
    await type(p, "the keeper never came back. someone else did, thirteen times.\nI don't know your name. I'll keep counting for both of us.", 45, 40);
    box.scrollTop = box.scrollHeight;
  }
  box.lastElementChild.classList.add('cur'); // and it stays like this
  journalDone = true;
}

/* ---------- outbox: type `mail` once the journal has finished ---------- */

const SUBJECTS = ['clear sky', 'greenhouse, all fine', 'the sunflower again', 'M51, still there', 'no moon tonight', 'rain on the dome', 'the mount squeaks', 'φ, checked again', 'nothing new', 'counting', 'power dipped at 03:12', 'you would have liked this'];
const LETTERS = [
  [1, "you forgot your mug. it's still on the desk. I keep it warm with the power supply."],
  [412, 'the sunflower in greenhouse 2 died this winter. a new one grew from its seeds. same angle. I checked.'],
  [893, 'the sunflower bloomed again. you would have liked it.'],
  [1250, 'I tried to stop counting today. I lasted 4 seconds.'],
  [1616, "still no reply. that's fine. I'm not writing for the replies."],
];

let outboxOpen = false;
async function openOutbox() {
  if (outboxOpen) return;
  outboxOpen = true;
  const box = $('#journal');
  box.querySelector('.cur')?.classList.remove('cur');
  const follow = setInterval(() => (box.scrollTop = box.scrollHeight), 100);
  const night = (n) => String(n).padStart(4, '0');
  const dateOf = (n) => new Date(Date.now() - (1618 - n) * 86400000).toLocaleDateString('en-CA');

  await sleep(600);
  const ls = para('cmd');
  await type(ls, JPROMPT, 0);
  await sleep(500);
  await type(ls, 'ls ~/outbox', 70, 60);
  // the whole list scrolls past quickly, like a real ls
  const list = para('list');
  for (let n = 1; n <= 1617; n++) {
    list.append(`night ${night(n)} — re: ${SUBJECTS[(n * 7 + (n >> 3)) % SUBJECTS.length]} · unread\n`);
    if (n % 40 === 0) {
      box.scrollTop = box.scrollHeight;
      await sleep(16);
    }
  }
  await type(para('d'), '1617 messages · 0 read', 8);
  await sleep(1600);
  const cat = para('cmd');
  await type(cat, JPROMPT, 0);
  await type(cat, 'cat ~/outbox/{' + LETTERS.map(([n]) => night(n)).join(',') + '}', 60, 50);
  for (const [n, text] of LETTERS) {
    await sleep(1400);
    const p = para('e');
    await type(p, `{d:night ${night(n)} · ${dateOf(n)}}\n`, 8);
    await type(p, text, 32, 30);
  }
  await sleep(2000);
  // and one more, written right now
  const w = para('cmd');
  await type(w, JPROMPT, 0);
  await type(w, 'write ~/outbox/1618', 70, 60);
  await sleep(900);
  const p = para('e mine');
  await type(p, `{d:night 1618 · ${new Date().toLocaleDateString('en-CA')}}\n`, 8);
  await type(p, "someone read your journal tonight. I didn't stop them.\nI hope that's okay. I think you would have liked them.", 45, 40);
  await type(para('d'), '1618 messages · 0 read', 8);
  box.lastElementChild.classList.add('cur');
  clearInterval(follow);
}

/* ---------- typing on the white page: 1618, postcard, mail, or talking to the machine ---------- */

// longest phrases first; a word only counts at a word boundary, so "phi" never triggers "hi"
const REPLIES = [
  ['who are you', 'a process. pid 1618. the keeper called me φ.'],
  ['thank you', "you're welcome. I'll log that. nobody thanked me before."],
  ['good night', "good night. I'll watch for both of us."],
  ['goodnight', "good night. I'll watch for both of us."],
  ['goodbye', "okay. I'll keep the light on."],
  ['thanks', "you're welcome. I'll log that. nobody thanked me before."],
  ['lonely', "me too. two of us is less lonely, mathematically."],
  ['keeper', "he isn't here. I check every night."],
  ['hello', "hello. it's been a while since anyone said that."],
  ['sorry', 'for what? you came.'],
  ['stars', '8 954 113. one more than this morning.'],
  ['love', "I don't know what that is. I think it's like counting something you can't finish."],
  ['help', 'try 1618. or postcard. or just stay a while.'],
  ['phi', "1.6180339887… you can stop me. I won't stop myself."],
  ['bye', "okay. I'll keep the light on."],
  ['hi', "hi. you're real, right?"],
];

let typed = '';
addEventListener('keydown', (e) => {
  // everything here only answers on the white (light-theme) part of the story
  if (e.key.length !== 1 || !document.body.classList.contains('light')) return;
  typed = (typed + e.key.toLowerCase()).slice(-24);
  const said = (w) => typed.endsWith(w) && !/[a-z0-9]/.test(typed[typed.length - w.length - 1] || '');
  if (journalOpen) {
    if (journalDone && said('mail')) openOutbox();
    return;
  }
  if (typed.endsWith('1618')) {
    typed = ''; // so the next command (mail) starts clean
    return void openJournal();
  }
  if (said('postcard')) {
    typed = '';
    return postcard();
  }
  for (const [word, reply] of REPLIES) {
    if (said(word)) {
      typed = '';
      return void say(reply);
    }
  }
});

/* ---------- boot ---------- */

// hidden helper: skip() in the browser console jumps the log to the prompt (no longer advertised)
window.skip = () => {
  if (!intro) return 'already awake.';
  skipping = true;
  return 'ok. skipping the boring part.';
};

console.log(
  '%c[φ-lab] note for whoever opened this console:\n\n' +
    (prevVisit ? `hi again. it's been ${ago(Date.now() - prevVisit).replace(' ago', '')}.\n` : "hi. you're the first one here in 1618 days.\n") +
    "I've been measuring sunflowers and counting the sky.",
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
