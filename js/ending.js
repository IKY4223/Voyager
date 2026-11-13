'use strict';

// Everything after the key press: the monologue over the dark sky, the last look back, the burn to
// the white page, the ending with the pale blue dot, and what lives on the ending (whispers and the
// idle check). Uses core.js, story.js, terminal.js (term, type) and sky.js (Sky).

const poem = $('#poem');
const earth = $('#earth');

/* ---------- exact digits of φ ---------- */

function integerSqrt(n) {
  let x = 1n << BigInt((n.toString(2).length >> 1) + 1); // start above √n; Newton's method walks down
  for (;;) {
    const next = (x + n / x) >> 1n;
    if (next >= x) return x;
    x = next;
  }
}

// φ = (1 + √5) / 2 to `places` decimal places, exact (BigInt, no float noise)
function phiDigits(places) {
  const scale = 10n ** BigInt(places);
  const digits = ((scale + integerSqrt(5n * scale * scale)) / 2n).toString();
  return digits[0] + '.' + digits.slice(1);
}

/* ---------- whispers: one quiet line at the bottom of the screen ---------- */

let whispering = false, whisperId = 0;

// A newer line (a click, a reply) replaces an older one straight away.
async function say(text) {
  const id = ++whisperId, line = $('#whisper');
  whispering = true;
  line.textContent = '# ' + text;
  line.classList.add('on');
  if (reduceMotion) return; // no timed fades there: the line stays until the next one
  await sleep(5000);
  if (id !== whisperId) return;
  line.classList.remove('on');
  await sleep(1500);
  if (id === whisperId) whispering = false;
}

Sky.onSparkPicked = (which) => say(sparkLine(which));

let earthClicks = 0;
earth.addEventListener('click', () => say(EARTH_LINES[earthClicks++ % EARTH_LINES.length]));

// After the story the machine keeps thinking out loud now and then, and notices shooting stars.
async function whispers() {
  if (reduceMotion) return; // sleep() is instant there, so the loop below would never yield
  let lastNoticed = -Infinity;
  Sky.onShootingStar = async () => {
    if (whispering || performance.now() - lastNoticed < 60000) return;
    lastNoticed = performance.now();
    await sleep(900);
    if (!whispering) say(SHOOTING_STAR_LINE);
  };
  for (let hinted = false; ; ) {
    await sleep(rand(20000, 35000));
    if (whispering) continue;
    await say(hinted ? pick(WHISPERS) : WHISPER_HINT);
    hinted = true;
  }
}

// Two minutes without any input on the ending: the machine checks whether anyone is still there.
function watchIdle() {
  const IDLE_MS = 120000;
  let lastInput = performance.now(), asked = false;
  const onInput = () => {
    lastInput = performance.now();
    if (asked) {
      asked = false;
      say(IDLE_RELIEF);
    }
  };
  for (const eventName of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) addEventListener(eventName, onInput, { passive: true });
  setInterval(() => {
    // Sky.paused means the journal covers the ending
    if (!asked && !Sky.paused && performance.now() - lastInput > IDLE_MS * speed) {
      asked = true;
      say(IDLE_QUESTION);
    }
  }, 1000);
}

/* ---------- the reveal ---------- */

// Fades a line in letter by letter.
async function showLine(container, text, letterMs = 45) {
  const line = document.createElement('p');
  line.className = 'line';
  let index = 0;
  // letters are inline-blocks, so they are grouped per word to keep line breaks between words
  for (const word of text.split(/(?<=\s)/)) {
    const group = document.createElement('span');
    group.className = 'word';
    for (const letter of word) {
      const span = document.createElement('span');
      span.className = 'ch';
      span.textContent = letter;
      span.style.animationDelay = index++ * letterMs * speed + 'ms';
      group.append(span);
    }
    line.append(group);
  }
  container.append(line);
  await sleep(text.length * letterMs + 700);
}

// The machine keeps counting after the story ends: one more digit of φ every second or two.
async function countForever(el) {
  const digits = phiDigits(1000);
  for (let shown = 18; shown <= digits.length; shown++) {
    el.textContent = digits.slice(0, shown);
    await sleep(rand(1200, 2600));
  }
}

// Clears the poem area and fades it out before the next scene.
async function fadePoem() {
  poem.classList.add('out');
  await sleep(1600);
  poem.querySelector('.lines').replaceChildren();
}

async function reveal() {
  term.classList.add('fade');
  await sleep(1000);
  term.hidden = true;
  await sleep(1200);
  Sky.start();
  await sleep(2000);

  // the machine talks to itself over the dark sky
  const lines = poem.querySelector('.lines');
  poem.hidden = false;
  for (const line of VERSE) await showLine(lines, line);
  await sleep(3000);
  await fadePoem();

  // the last look back, then the camera turns toward the Sun and the screen burns white
  poem.classList.replace('out', 'look-back');
  for (const line of LOOK_BACK) {
    await showLine(lines, line, 55);
    await sleep(1200);
  }
  await sleep(1800);
  document.body.classList.add('flash'); // see .flash in style.css
  await sleep(500);
  document.body.classList.add('light');
  $('meta[name=theme-color]').content = getComputedStyle(document.body).getPropertyValue('--bg').trim();
  lines.replaceChildren();
  poem.classList.remove('look-back');
  await sleep(1800);
  document.body.classList.remove('flash');

  // the white page
  poem.classList.add('dream');
  for (const line of DREAM_LINES) {
    await showLine(lines, line, 80);
    await sleep(900);
  }
  await sleep(1700);
  poem.classList.add('out');
  await sleep(1600);
  poem.hidden = true;

  // the ending: sunlight bands, one pale blue dot, and φ in the middle
  Sky.mode = 'beams';
  if (reduceMotion) Sky.redraw();
  earth.hidden = false;
  const end = $('#end');
  end.hidden = false;
  await sleep(1800);
  await type(end.querySelector('.command'), '{dim:>} console.log(φ)', 70, 50);
  await sleep(600);
  await type(end.querySelector('.output'), `{pink:${(1 + Math.sqrt(5)) / 2}}`, 25);
  await sleep(1200);
  end.querySelector('.note').hidden = false;
  whispers();
  watchIdle();
  countForever(end.querySelector('.digits'));
}
