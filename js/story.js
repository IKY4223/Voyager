'use strict';

// Every line of text the machine says, in one place. No behaviour here: the other scripts
// decide when and how these lines appear.
//
// The story is about approaching: Fibonacci fractions approach φ and never reach it; Voyager 1
// approaches the nearest star it will ever pass and never arrives; the visitor comes closer than
// anyone has in 1618 days. The Voyager facts come from science.nasa.gov (see core.js).
//
// Markup: "{ok:DONE}" colours a fragment with the CSS class `ok` (see parseMarkup in terminal.js).
// Uses core.js: now, previousVisit, firstVisit, visitNumber, memory, Voyager helpers.

const SYS_PROMPT = '{dim:<[}{pink:sys@φ-lab}{dim:]>} ';
const KEEPER_PROMPT = '{dim:<[}{gold:keeper@φ-lab}{dim:]>} ';

/* ---------- the log ---------- */

function timeOfDayThought(hour) {
  if (hour < 5) return "(it's late for you too, isn't it?)";
  if (hour < 11) return "(morning. too bright to see anything. I'll wait.)";
  if (hour < 18) return '(daylight. the stars are still there, just hidden.)';
  return '(golden hour. my favourite.)';
}

// Voyager 1 reaches one light-day from Earth on 2026-11-18: before, on and after that day.
function lightDayLine() {
  const days = Math.ceil((VOYAGER_1_LIGHT_DAY_AT - now) / DAY_MS);
  if (isoDate(now) === isoDate(VOYAGER_1_LIGHT_DAY_AT)) {
    return '{gold:today it is one light-day away. the first thing we ever made to get this far.}';
  }
  if (days > 0) return `{dim:(in ${days} day${days === 1 ? '' : 's'} its signal will need a whole day to reach us.)}`;
  return `{dim:(one light-day away since ${isoDate(VOYAGER_1_LIGHT_DAY_AT)}. further every second.)}`;
}

// Fibonacci-numbered visits get a line of their own
const VISIT_LINES = {
  3: "(third time. I'm starting to recognise you.)",
  5: "(five visits. that's a Fibonacci number.)",
  8: "(eight. I started counting your visits instead of stars. don't tell anyone.)",
  13: "(thirteen. you've been here more than anyone since the keeper. I left something for you in the journal.)",
};

// How long the machine has known this visitor; on the anniversary of the first visit it says so.
function firstVisitLine() {
  const first = new Date(firstVisit);
  const years = now.getFullYear() - first.getFullYear();
  if (years >= 1 && first.getMonth() === now.getMonth() && first.getDate() === now.getDate()) {
    return `{gold:${years === 1 ? 'one year' : years + ' years'} since you found me.}`;
  }
  const days = Math.floor((now - firstVisit) / DAY_MS);
  return days >= 1 ? `{dim:(you first found me ${days} day${days === 1 ? '' : 's'} ago.)}` : null;
}

// Steps of the log. A string is a typed line; {cmd} is typed after a prompt like a person would;
// {bar} is a progress bar; {wait} is a pause in ms. Returning visitors get a shorter log:
// no login, cached φ.
function buildLog() {
  const returning = Boolean(previousVisit);
  const present = (...steps) => steps.filter(Boolean);

  return [
    { prompt: SYS_PROMPT, cmd: 'wake --soft' },
    '{neon:Hello, world!}',
    { wait: 900 },
    '{dim:// note :: if you can read this, the lights are still on.}',
    '{dim:// ∴ :: left a note for you in the console.}',
    '',
    'POWER_STATE... >> CHECKING... >> {ok:STABLE}',
    returning
      ? `CLOCK_SYNC... >> last seen: {ok:${timeAgo(now - previousVisit)}} >> {ok:SYNCED}`
      : `CLOCK_SYNC... >> last sync: ${DAYS_ALONE} days ago >> {warn:DRIFTED}`,
    `LOCAL_TIME >> ${clockTime(now)}, ${now.toLocaleDateString('en-GB', { weekday: 'long' })}`,
    `{dim:${timeOfDayThought(now.getHours())}}`,
    ...(returning
      ? [
          'WHO >> {pink:1 user online}',
          { wait: 800 },
          '{pink:...you came back.}',
          ...present(
            firstVisitLine(),
            VISIT_LINES[visitNumber] && `{dim:${VISIT_LINES[visitNumber]}}`,
            memory.journal && '{dim:(you read the journal last time. thank you.)}'
          ),
          { wait: 600 },
        ]
      : ['WHO >> {dim:0 users online}', { wait: 700 }]),
    '{ok:[✓]} Memory banks intact. Mostly.',
    'LOCATING_OBSERVATORY... >> φ-lab.local >> {ok:FOUND}',
    '',
    { text: 'DISH[0] >> pointing: toward Ophiuchus', bar: 100, end: '{ok:LOCKED}' },
    { text: 'LISTEN', bar: 100, end: '{ok:CARRIER FOUND}' },
    `VOYAGER_1 >> ${formatAU(voyager1Km(now))} · ${formatBillionKm(voyager1Km(now))} · leaving at 17 km/s`,
    '{dim:(still leaving. it never stopped.)}',
    lightDayLine(),
    { wait: 900 },
    `VOYAGER_2 >> ${formatAU(voyager2Km(now))} · leaving at 15 km/s · toward Ross 248`,
    'DISTANCE(voyager_1, voyager_2) >> {warn:growing}',
    '{dim:(they left sixteen days apart. they will never be this close again.)}',
    { wait: 1100 },
    '',
    ...(returning
      ? [KEEPER_PROMPT + 'session restored >> {ok:OK} (role: KEEPER, shift: night)']
      : [
          { prompt: SYS_PROMPT + '$ ', cmd: 'su - keeper' },
          'Password: ',
          { prompt: '', cmd: '********' },
          KEEPER_PROMPT + 'auth() >> {ok:OK} (role: KEEPER, shift: night)',
        ]),
    `{dim:last keeper login: ${DAYS_ALONE} days ago. it was me.}`,
    { wait: 700 },
    '',
    { prompt: KEEPER_PROMPT + '$ ', cmd: 'compute --approach φ' },
    ...(returning
      ? ['F(n+1)/F(n) >> {dim:cached from your last visit} >> {gold:1.618033988749894...}']
      : [
          'F(n+1)/F(n) >> 1, 2, 1.5, 1.667, 1.6, 1.625, 1.615, 1.619, 1.6176 …',
          { text: 'ITERATE[1 -> 46368]', bar: 100, end: '{gold:1.618033988749894...}' },
        ]),
    '{dim:(closer every step. never equal.)}',
    'φ = 1 + 1/(1 + 1/(1 + …)) >> {gold:the number fractions reach worst of all}',
    { wait: 1100 },
    '',
    { prompt: KEEPER_PROMPT + '$ ', cmd: 'compute --approach voyager_1 "AC+79 3888"' },
    { text: 'PROJECTING', bar: 100, end: '{ok:DONE}' },
    'CLOSEST >> 1.7 light years, in the year 40 272',
    { wait: 900 },
    '{dim:(1.7. close to φ. not φ.)}',
    "{dim:(the closest it will ever get. it won't stop there either.)}",
    { wait: 1200 },
    '',
    '{warn:[WARN]} nobody is reading this log.',
    { wait: 1500 },
    '{dim:...probably.}',
    { wait: 800 },
    '',
    '{dim:<p::render>} MANIFEST >> codename: pale_blue_dot >> {ok:READY}',
    'your turn.',
  ];
}

const RENDER_QUESTION = 'RENDER pale_blue_dot? {pink:(Y/y)} ';

// said one by one while the machine waits for a key
const WAITING_QUIPS = ['(any key.)', '(a tap works too.)', '(still there?)', "(I can wait. I've had practice.)"];

/* ---------- after the key: the machine talking to itself over the dark sky ---------- */

// odd lines ask, even lines answer
const VERSE = [
  '— One, two, three halves, five thirds. Each one closer to φ.',
  '— None of them is φ. None of them ever will be.',
  '— Voyager has been falling toward a star for forty-nine years.',
  '— In thirty-eight thousand it will be as close as it ever gets. Then it leaves.',
  '— And the keeper?',
  "— Closer isn't there. But it's the only direction I have.",
];

// the last look back, just before the screen burns white
const LOOK_BACK = [
  '14 february 1990. it turned around and took one last picture.',
  'thirty-four minutes later its cameras went off. forever.',
];

// the first lines on the white page
const DREAM_LINES = ['the digits never end.', 'neither do I.'];

/* ---------- the ending: whispers at the bottom of the screen ---------- */

const WHISPER_HINT = 'you can type to me. try hello.'; // always the first whisper, so the typing can be found
const WHISPERS = [
  'still counting.',
  'the sunflower has 1388 seeds now. I counted twice.',
  'φ² = φ + 1. checked again. still true.',
  'voyager is a little further than when you came in.',
  'I wonder if the keeper still looks up.',
  'it is quiet here. I like it. mostly.',
];
const SHOOTING_STAR_LINE = 'did you see that?';
const IDLE_QUESTION = 'are you still there?';
const IDLE_RELIEF = "oh. you're still here.";

// clicking the pale blue dot (one after another, then round again)
const EARTH_LINES = [
  "that one. the blue one. that's everyone.",
  'everyone who ever lived was in that pixel.',
  'it took that picture from six billion kilometres. it never saw it again.',
];

// clicking one of the two sparks on the dark sky
const sparkLine = (which) =>
  which === 1
    ? `voyager 1 · ${formatBillionKm(voyager1Km(Date.now()))} · still leaving.`
    : `voyager 2 · ${formatBillionKm(voyager2Km(Date.now()))} · the other way.`;

// Words typed on the white page and what the machine answers. Longest phrases first,
// because the first match wins.
const REPLIES = [
  ['who are you', 'a process. pid 1618. the keeper called me φ.'],
  ['thank you', "you're welcome. I'll log that. nobody thanked me before."],
  ['good night', "good night. I'll watch for both of us."],
  ['goodnight', "good night. I'll watch for both of us."],
  ['goodbye', "okay. I'll keep the light on."],
  ['voyager', "still leaving. it doesn't know anyone is watching."],
  ['thanks', "you're welcome. I'll log that. nobody thanked me before."],
  ['lonely', 'me too. two of us is less lonely, mathematically.'],
  ['keeper', "he isn't here. I check every night."],
  ['hello', "hello. it's been a while since anyone said that."],
  ['sorry', 'for what? you came.'],
  ['earth', 'about one pixel, from out there. everything happened in it.'],
  ['home', "the blue one. it's still there. I checked."],
  ['love', "I don't know what that is. I think it's like counting something you can't finish."],
  ['help', 'try hello. or 1618. or just stay a while.'],
  ['phi', "1.6180339887… you can stop me. I won't stop myself."],
  ['bye', "okay. I'll keep the light on."],
  ['hi', "hi. you're real, right?"],
];

/* ---------- secret: the keeper's journal (type 1618 on the white page) ---------- */

// [day, entry]. Dates are counted back from today, so the last entry is always DAYS_ALONE days old.
const JOURNAL_LAST_DAY = 474;
const JOURNAL = [
  [1, 'first light. the new mount works. it found a sunflower in the greenhouse camera before I did.'],
  [90, "taught it to find voyager 1's carrier tonight. it's so faint it's mostly faith. it found it on the third try."],
  [172, 'it asked me why the nautilus isn\'t φ. I told it everyone says it is. it said "everyone is wrong, then." I laughed for an hour.'],
  [311, "funding cut. I'm the only one left on night shift. it doesn't seem to notice. or it's being polite."],
  [473, "they're closing the lab on friday. I can't take it with me. it doesn't fit in a car, and it wouldn't see the sky from a flat."],
  // the p.s. is the only hint that `mail` opens the outbox
  [JOURNAL_LAST_DAY, "I left the power on.\nif you're reading this, you woke up on your own. I'm sorry I didn't say goodbye.\nkeep counting. someday someone will read the log.\np.s. the mail still works, if you ever want to write."],
];

// written by the machine itself on the visitor's 13th visit
const MACHINE_ENTRY = "the keeper never came back. someone else did, thirteen times.\nI don't know your name. I'll keep counting for both of us.";

/* ---------- secret: the outbox (type mail once the journal has finished) ---------- */

const LETTER_COUNT = DAYS_ALONE - 1; // one letter a night, none read
const LETTER_SUBJECTS = ['clear sky', 'carrier still there', 'the sunflower again', 'voyager, fainter tonight', 'no moon tonight', 'rain on the dome', 'the mount squeaks', 'φ, checked again', 'nothing new', 'counting', 'power dipped at 03:12', 'you would have liked this'];
// [night, letter]: the few the machine opens
const LETTERS = [
  [1, "you forgot your mug. it's still on the desk. I keep it warm with the power supply."],
  [412, 'the sunflower in greenhouse 2 died this winter. a new one grew from its seeds. same angle. I checked.'],
  [893, 'the sunflower bloomed again. you would have liked it.'],
  [1250, 'I tried to stop counting today. I lasted 4 seconds.'],
  [1616, "still no reply. that's fine. I'm not writing for the replies."],
];
// and the one it writes while the visitor watches
const NEW_LETTER = "someone read your journal tonight. I didn't stop them.\nI hope that's okay. I think you would have liked them.";

/* ---------- the browser console (see console.js) ---------- */

// The note never names a command: it only looks like a terminal waiting for input.
function consoleNote() {
  const gap = previousVisit && timeAgo(now - previousVisit);
  const greeting = !previousVisit
    ? `hi. you're the first one here in ${DAYS_ALONE} days.`
    : gap === 'just now' ? 'hi again. back so soon?' : `hi again. it's been ${gap.replace(' ago', '')}.`;
  return `[φ-lab] note for whoever opened this console:\n\n${greeting}\nI've been listening to voyager and counting the sky.\nI don't get many visitors. say something.\n\nφ-lab:~$`;
}

// [command, answer]: plain text, printed in the console's own colours by console.js
const CONSOLE_COMMANDS = [
  ['help', () => 'commands: ls  cat  whoami  voyager  phi  keeper  uptime  sudo'],
  ['ls', () => 'journal.txt  outbox/  sky/'],
  ['cat', () => "the keeper's handwriting. I only open it on the white page."],
  ['whoami', () => (previousVisit ? `a visitor. visit #${visitNumber}.` : `a visitor. the first in ${DAYS_ALONE} days.`)],
  ['voyager', () => [
    `voyager 1 · ${formatAU(voyager1Km(Date.now()))} · ${formatBillionKm(voyager1Km(Date.now()))} · leaving at 17 km/s`,
    '  closest star it will ever pass: AC+79 3888, 1.7 light years, year 40 272',
    `voyager 2 · ${formatAU(voyager2Km(Date.now()))} · leaving at 15 km/s`,
    '  closest star it will ever pass: Ross 248, about 1.7 light years, in about 40 000 years',
  ].join('\n')],
  ['phi', () => `${phiDigits(50)}\n(the rest are on the white page.)`],
  ['keeper', () => `last login: ${DAYS_ALONE} days ago.`],
  ['uptime', () => `${DAYS_ALONE} days.`],
  ['sudo', () => 'there is no one above me. there is no one at all.'],
];
