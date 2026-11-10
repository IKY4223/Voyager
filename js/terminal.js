'use strict';

// The terminal: typing text into the page, progress bars, the log runner and the "press Y" prompt.
// Uses core.js (sleep, rand, reduceMotion, skipping) and story.js (RENDER_QUESTION, WAITING_QUIPS).

const term = $('#term');

// Pace of the log, in ms. Lines are typed quickly but the machine pauses between them,
// and the story adds longer {wait} pauses after the lines that matter.
const PACE = {
  char: 14, // per character of an ordinary line
  lineGap: [260, 560], // pause after a line
  blankGap: 350, // pause on an empty line
  beforeCommand: 600, // prompt appears, then a human-like hesitation
  commandChar: [80, 80], // per character of a typed command: base, random extra
  afterCommand: 500,
  barStep: [45, 120], // between progress bar updates
  afterBar: 400,
};

// "text {ok:DONE} more" -> [{cls: '', text: 'text '}, {cls: 'ok', text: 'DONE'}, {cls: '', text: ' more'}]
function parseMarkup(text) {
  const parts = text.split(/\{(\w+):([^}]*)\}/);
  const segments = [];
  for (let i = 0; i < parts.length; i += 3) {
    if (parts[i]) segments.push({ cls: '', text: parts[i] });
    if (i + 2 < parts.length) segments.push({ cls: parts[i + 1], text: parts[i + 2] });
  }
  return segments;
}

function scrollToEnd(scroller) {
  if (scroller) scroller.scrollTop = scroller.scrollHeight;
}

// Types marked-up text into `el` one character at a time, keeping the end of its scroller in view.
async function type(el, text, delay = PACE.char, jitter = 0) {
  const scroller = el.closest('.term, .journal');
  for (const segment of parseMarkup(text)) {
    const span = document.createElement('span');
    if (segment.cls) span.className = segment.cls;
    el.append(span);
    for (const ch of segment.text) {
      span.textContent += ch;
      scrollToEnd(scroller);
      await sleep(delay + rand(0, jitter));
    }
  }
}

// Starts a new terminal line and moves the blinking cursor onto it.
function newLine() {
  term.querySelector('.cur')?.classList.remove('cur');
  const line = document.createElement('div');
  line.className = 'ln cur';
  term.append(line);
  scrollToEnd(term);
  return line;
}

async function progressBar(el, result) {
  const CELLS = 16;
  const bar = document.createElement('span');
  el.append(bar);
  for (let percent = 0; ; percent = Math.min(100, percent + Math.round(rand(3, 11)))) {
    const filled = Math.round((percent / 100) * CELLS);
    bar.textContent = ` [${'#'.repeat(filled)}${'.'.repeat(CELLS - filled)}] ${String(percent).padStart(3)}%`;
    if (percent >= 100) break;
    await sleep(rand(...PACE.barStep));
  }
  await sleep(250);
  await type(el, ' >> ' + result);
}

// One silent CRT hiccup: the screen jerks sideways for a quarter of a second.
// Real timers on purpose: it must finish even while skip() makes sleep() instant.
async function glitch() {
  for (const [shift, skew] of [[-8, 3], [5, 0], [-3, -2], [0, 0]]) {
    term.style.transform = shift || skew ? `translateX(${shift}px) skewX(${skew}deg)` : '';
    term.style.filter = shift ? 'brightness(1.7) contrast(1.3)' : '';
    await new Promise((done) => setTimeout(done, 60));
  }
}

// Plays the steps built by buildLog() in story.js.
async function runLog(steps) {
  const glitchAt = (steps.length * rand(0.3, 0.8)) | 0;
  for (const [i, step] of steps.entries()) {
    if (i === glitchAt && !reduceMotion && !skipping) glitch();
    if (typeof step === 'string') {
      await type(newLine(), step);
      await sleep(step ? rand(...PACE.lineGap) : PACE.blankGap);
    } else if (step.wait) {
      await sleep(step.wait);
    } else if (step.cmd) {
      // an empty prompt continues the previous line (the password after "Password: ")
      const line = step.prompt === '' ? term.lastElementChild : newLine();
      await type(line, step.prompt);
      await sleep(PACE.beforeCommand);
      await type(line, step.cmd, ...PACE.commandChar);
      await sleep(PACE.afterCommand);
    } else if (step.bar) {
      const line = newLine();
      await type(line, step.text);
      await progressBar(line, step.end);
      await sleep(PACE.afterBar);
    }
  }
}

// Resolves on the first key press, click or tap. `onInput` runs inside the event handler,
// because browsers only allow sound to start from a user gesture.
function waitAnyInput(onInput) {
  return new Promise((resolve) => {
    const done = (event) => {
      if (event.type === 'keydown' && (event.metaKey || event.ctrlKey || event.altKey)) return;
      removeEventListener('keydown', done);
      removeEventListener('pointerdown', done);
      onInput();
      resolve();
    };
    addEventListener('keydown', done);
    addEventListener('pointerdown', done);
  });
}

// "RENDER golden_hour? (Y/y)": waits for any input, teasing the visitor while it waits.
async function askToRender(onInput) {
  const input = waitAnyInput(onInput);
  const question = newLine();
  await type(question, RENDER_QUESTION);
  let answered = false;
  (async () => {
    for (const quip of WAITING_QUIPS) {
      await sleep(6000);
      if (answered) return;
      await type(newLine(), `{dim:${quip}}`, 25);
      if (answered) return;
      // the cursor stays after the question, not after the quip
      term.querySelector('.cur')?.classList.remove('cur');
      question.classList.add('cur');
    }
  })();
  await input;
  answered = true;
}
