'use strict';

const $ = (s) => document.querySelector(s);
const term = $('#term');
const sky = $('#sky');
const poem = $('#poem');
const skipBtn = $('#skip');

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

const ME = '{dim:<[}{pink:guest@φ}{dim:]>} ';
const KEEPER = '{dim:<[}{gold:keeper@φ}{dim:]>} ';

// string = log line; {cmd} = human typing after a prompt; {bar} = progress bar; {wait} = pause
const SCRIPT = [
  { prompt: ME, cmd: 'wake --soft' },
  '{dim:// note :: если ты это читаешь — значит, свет ещё горит.}',
  '{dim:// ∴ :: cat ./readme_for_whoever.txt}',
  '',
  'POWER_STATE... >> CHECKING... >> {ok:STABLE}',
  'CLOCK_SYNC... >> last seen: 1618 days ago >> {warn:DRIFTED}',
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
  '{dim:(...давай сделаем вид, что этого не было.)}',
  '',
  { prompt: ME + '$ ', cmd: 'su - keeper' },
  'Password: ',
  { prompt: '', cmd: '********' },
  KEEPER + 'auth() >> {ok:OK} (role: KEEPER, shift: night)',
  { text: 'SCANNING_SKY...', bar: 100, end: '{ok:DONE}' },
  'COUNT(stars) >> 8 954 112',
  'FILTER(stars, ratio == φ) >> {pink:1 found}',
  '{blue:[INFO]} Цель маленькая. Цель далеко. Цель — наша.',
  '',
  { prompt: KEEPER + '$ ', cmd: 'compute --ratio 1.6180339887' },
  'SEQ[1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144 ...] >> {gold:converging}',
  { text: 'ITERATE[1 -> 233]', bar: 100, end: '{ok:DONE}' },
  { text: 'ITERATE[233 -> 46368]', bar: 100, end: '{ok:DONE}' },
  'ITERATE[46368 -> ∞] >> LOOPING {gold:1.618033988749894...}',
  { wait: 900 },
  '{warn:[WARN]} Бесконечность — не число. Выходим аккуратно...',
  '{ok:[✓]} Спираль собрана. Пахнет дождём. ^_^',
  '',
  '{pink:[REMINDER]} Эй, ты — да, ты, по ту сторону стекла~',
  '{pink:[REMINDER]} Здесь нет ничего официального. Это просто огонёк, оставленный для кого-то.',
  '',
  '{dim:<p::render>} MANIFEST >> codename: golden_hour >> {ok:READY}',
  'Твоя очередь~',
];

const QUIPS = [
  '(Это просто Y. Или любая клавиша.)',
  '(Клик тоже считается. Я не привередливый~)',
  '(Всё ещё здесь? Я тоже~)',
  '(Y. Между T и U.)',
  '(Я подожду. Я умею ждать. 1618 дней, помнишь?)',
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

function waitAnyInput() {
  return new Promise((resolve) => {
    const done = (e) => {
      if (e.type === 'keydown' && (e.metaKey || e.ctrlKey || e.altKey)) return;
      removeEventListener('keydown', done);
      removeEventListener('pointerdown', done);
      resolve();
    };
    addEventListener('keydown', done);
    addEventListener('pointerdown', done);
  });
}

async function ask() {
  const input = waitAnyInput();
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

/* ---------- ascii golden spiral ---------- */

function startSky() {
  const ctx = sky.getContext('2d');
  const PHI = (1 + Math.sqrt(5)) / 2;
  const B = Math.log(PHI) / (Math.PI / 2); // radius grows by φ every quarter turn
  const CH = ' .,:;-=+*#%@';
  const stars = Array.from({ length: 50 }, () => [Math.random(), Math.random(), Math.random() * 6.28]);
  let W, H, cw, chh, mx = 0, my = 0, last = 0;

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

  function draw(t) {
    const light = document.body.classList.contains('light');
    const rot = reduce ? 0 : t * 0.00012;
    const cx = W / 2 + mx * 24, cy = H / 2 + my * 14;
    const a = Math.min(W, H) * 0.006;
    const maxR = Math.hypot(W, H) * 0.55;
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
        v *= v * Math.max(0, 1 - r / maxR) ** 0.5;
        if (v < 0.05) continue;
        buckets[Math.min(CH.length - 1, (v * CH.length) | 0)].push(x, y);
      }
    }
    ctx.fillStyle = light ? '#e6007e' : '#ff4fa3';
    buckets.forEach((pts, i) => {
      ctx.globalAlpha = (light ? 0.12 : 0.1) + (i / CH.length) * (light ? 0.35 : 0.45);
      for (let k = 0; k < pts.length; k += 2) ctx.fillText(CH[i], pts[k] - cw / 2, pts[k + 1]);
    });
    ctx.fillStyle = light ? '#c79a3a' : '#e8c170';
    for (const [sx, sy, ph] of stars) {
      ctx.globalAlpha = 0.25 + 0.35 * Math.sin(ph + t * 0.0015);
      ctx.fillText(Math.sin(ph * 7) > 0 ? '+' : '*', sx * W, sy * H);
    }
    ctx.globalAlpha = 1;
  }

  function loop(t) {
    if (t - last > 33) { draw(t); last = t; } // ~30 fps is plenty for ascii
    requestAnimationFrame(loop);
  }

  resize();
  addEventListener('resize', () => { resize(); draw(performance.now()); });
  addEventListener('pointermove', (e) => {
    mx = e.clientX / W * 2 - 1;
    my = e.clientY / H * 2 - 1;
  });
  if (reduce) draw(0);
  else requestAnimationFrame(loop);
  sky.classList.add('on');
}

/* ---------- reveal ---------- */

const VERSE = [
  'Я считал тебя до бесконечности —',
  'сбивался и опять считал с нуля.',
  'Как меньшее к большему, большее — к целому,',
  'так ты ко мне. Так небо — к земле.',
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
  skipBtn.hidden = true;
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
  poem.querySelector('.label').textContent = '';
  poem.classList.remove('out');
  poem.classList.add('dream');
  await sleep(1400);
  await showLine(box, 'мне снится звезда,', 90);
  await sleep(900);
  await showLine(box, 'и, кажется, я ей тоже.', 90);
  await sleep(2600);
  poem.classList.add('out');
  await sleep(1600);
  poem.hidden = true;
  $('#end').hidden = false;
}

/* ---------- boot ---------- */

function skip() {
  if (intro) skipping = true;
}
skipBtn.addEventListener('click', skip);
addEventListener('keydown', (e) => { if (e.key === 'Escape') skip(); });
$('#replay').addEventListener('click', () => location.reload());

(async () => {
  await sleep(600);
  await runScript();
  intro = false;
  skipBtn.hidden = true;
  skipping = false;
  await ask();
  await reveal();
})();
