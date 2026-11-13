'use strict';

// What a visitor can type on the white page: words the machine answers, `1618` (the keeper's journal)
// and, once the journal has been read, `mail` (the machine's unsent letters).
// Uses core.js, story.js, terminal.js (type, scrollToEnd), sky.js (Sky) and ending.js (say).

const journal = $('#journal');
const JOURNAL_PROMPT = KEEPER_PROMPT + '$ ';
let journalState = 'closed'; // closed -> typing -> read -> outbox

function journalParagraph(className) {
  const p = document.createElement('p');
  p.className = className;
  journal.append(p);
  return p;
}

async function journalCommand(command) {
  const line = journalParagraph('cmd');
  await type(line, JOURNAL_PROMPT, 0);
  await sleep(500);
  await type(line, command, 70, 60);
}

const daysAgo = (days) => isoDate(now.getTime() - days * DAY_MS);

async function openJournal() {
  journalState = 'typing';
  remember({ journal: true });
  journal.hidden = false;
  document.body.classList.add('journal-open'); // the journal draws its own vignette, see style.css
  Sky.paused = true; // fully covered from here on

  await sleep(1200);
  await journalCommand('cat ~/journal.txt');
  for (const [day, text] of JOURNAL) {
    await sleep(1600);
    const last = day === JOURNAL_LAST_DAY;
    const entry = journalParagraph(last ? 'e last' : 'e');
    await type(entry, `{d:${daysAgo(DAYS_ALONE + JOURNAL_LAST_DAY - day)} · ${last ? 'last entry' : 'day ' + day}}\n`, 8);
    await type(entry, text, 32, 30);
  }
  if (memory.wrote) {
    await sleep(2400);
    const entry = journalParagraph('e mine');
    await type(entry, `{d:${isoDate(memory.wrote)} · φ-lab}\n`, 8);
    await type(entry, MACHINE_ENTRY, 45, 40);
  }
  journal.lastElementChild.classList.add('cur'); // and it stays like this
  journalState = 'read';
}

async function openOutbox() {
  journalState = 'outbox';
  journal.querySelector('.cur')?.classList.remove('cur');
  const night = (n) => String(n).padStart(4, '0');

  await sleep(600);
  await journalCommand('ls ~/outbox');
  // the whole list scrolls past quickly, like a real ls
  const list = journalParagraph('list');
  for (let n = 1; n <= LETTER_COUNT; n++) {
    list.append(`night ${night(n)} — re: ${LETTER_SUBJECTS[(n * 7 + (n >> 3)) % LETTER_SUBJECTS.length]} · unread\n`);
    if (n % 40 === 0) {
      scrollToEnd(journal);
      await sleep(16);
    }
  }
  await type(journalParagraph('d'), `${LETTER_COUNT} messages · 0 read`, 8);

  await sleep(1600);
  await journalCommand(`cat ~/outbox/{${LETTERS.map(([n]) => night(n)).join(',')}}`);
  for (const [n, text] of LETTERS) {
    await sleep(1400);
    const letter = journalParagraph('e');
    await type(letter, `{d:night ${night(n)} · ${daysAgo(DAYS_ALONE - n)}}\n`, 8);
    await type(letter, text, 32, 30);
  }

  // and one more, written while the visitor watches
  await sleep(2000);
  await journalCommand(`write ~/outbox/${LETTER_COUNT + 1}`);
  await sleep(900);
  const letter = journalParagraph('e mine');
  await type(letter, `{d:night ${LETTER_COUNT + 1} · ${isoDate(now)}}\n`, 8);
  await type(letter, NEW_LETTER, 45, 40);
  await type(journalParagraph('d'), `${LETTER_COUNT + 1} messages · 0 read`, 8);
  journal.lastElementChild.classList.add('cur');
}

/* ---------- the keyboard ---------- */

let typedText = '';

addEventListener('keydown', (event) => {
  // typing only means something on the white (light-theme) part of the story
  if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
  if (!document.body.classList.contains('light')) return;
  typedText = (typedText + event.key.toLowerCase()).slice(-24);
  // a word only counts at a word boundary, so "phi" never triggers "hi"
  const typed = (word) => typedText.endsWith(word) && !/[a-z0-9]/.test(typedText.at(-word.length - 1) || '');
  const matched = (action) => {
    typedText = ''; // the next command starts clean
    action();
  };

  if (journalState !== 'closed') {
    if (journalState === 'read' && typed('mail')) matched(openOutbox);
    return;
  }
  if (typedText.endsWith(String(DAYS_ALONE))) return matched(openJournal);
  const reply = REPLIES.find(([word]) => typed(word));
  if (reply) matched(() => say(reply[1]));
});
