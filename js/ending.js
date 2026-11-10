'use strict';

// Everything after the key press: the monologue over the sky, the switch to the white page,
// the ending, and what lives on the ending (whispers, the idle check, the postcard).
// Uses core.js, story.js, terminal.js (term, type) and sky.js (Sky).

const poem = $('#poem');

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

// A newer line (a star click, a reply) replaces an older one straight away.
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

let pickedStar = null; // "HD 44749 · 1023 light years", printed on the postcard
Sky.onStarPicked = (star) => {
  pickedStar = `${star.name} · ${star.lightYears} light years`;
  say(`${pickedStar}. ${pick(STAR_NOTES)}`);
};

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

/* ---------- postcard: a keepsake of this visit, downloaded as a PNG ---------- */

function postcard() {
  const WIDTH = 1200, HEIGHT = 630;
  const INK = { paper: '#141414', title: '#f2ede4', text: '#c8c8c8', star: '#e8c170', small: '#888888', phi: '#ff4fa3' };
  const card = document.createElement('canvas');
  card.width = WIDTH;
  card.height = HEIGHT;
  const ctx = card.getContext('2d');
  ctx.fillStyle = INK.paper;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  // the live sky behind the text, cropped to the card's shape
  const sky = Sky.canvas;
  const scale = Math.min(sky.width / WIDTH, sky.height / HEIGHT);
  if (scale) ctx.drawImage(sky, (sky.width - WIDTH * scale) / 2, (sky.height - HEIGHT * scale) / 2, WIDTH * scale, HEIGHT * scale, 0, 0, WIDTH, HEIGHT);

  ctx.textAlign = 'center';
  ctx.shadowColor = INK.paper;
  ctx.shadowBlur = 18;
  ctx.fillStyle = INK.phi;
  ctx.font = '120px Georgia, serif';
  ctx.fillText('φ', WIDTH / 2, 220);
  const phase = moon(now);
  const lines = [
    [INK.title, 'φ-lab observatory · postcard'],
    [INK.text, `${isoDate(now)} ${clockTime(now)} · ${phase.name}, ${Math.round(phase.lit * 100)}% lit`],
    [INK.star, pickedStar ? `your star: ${pickedStar}` : "you didn't pick a star. next time."],
    [INK.small, `visit #${visitNumber}`],
  ];
  ctx.font = '22px "Courier New", monospace';
  lines.forEach(([color, text], i) => {
    ctx.fillStyle = color;
    ctx.fillText(text, WIDTH / 2, 320 + i * 46);
  });

  card.toBlob((blob) => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `phi-lab-postcard-${isoDate(now)}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });
  say(POSTCARD_LINE);
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
  poem.classList.add('out');
  await sleep(1600);

  // the white page
  document.body.classList.add('light');
  $('meta[name=theme-color]').content = getComputedStyle(document.body).getPropertyValue('--bg').trim();
  lines.replaceChildren();
  poem.classList.replace('out', 'dream');
  await sleep(1400);
  for (const line of DREAM_LINES) {
    await showLine(lines, line, 80);
    await sleep(900);
  }
  await sleep(1700);
  poem.classList.add('out');
  await sleep(1600);
  poem.hidden = true;

  // the ending
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
