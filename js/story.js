'use strict';

// Every line of text the machine says, in one place. No behaviour here: the other scripts
// decide when and how these lines appear.
//
// Markup: "{ok:DONE}" colours a fragment with the CSS class `ok` (see parseMarkup in terminal.js).
// Uses core.js: now, previousVisit, firstVisit, visitNumber, memory, moon, goldenDate, describeDevice.

const SYS_PROMPT = '{dim:<[}{pink:sys@φ-lab}{dim:]>} ';
const KEEPER_PROMPT = '{dim:<[}{gold:keeper@φ-lab}{dim:]>} ';

/* ---------- the log ---------- */

function timeOfDayThought(hour) {
  if (hour < 5) return "(it's late for you too, isn't it?)";
  if (hour < 11) return "(morning. too bright to see anything. I'll wait.)";
  if (hour < 18) return '(daylight. the stars are still there, just hidden.)';
  return '(golden hour. my favourite.)';
}

function moonThought(lit) {
  if (lit > 0.7) return '(too bright tonight to see M51 well.)';
  if (lit < 0.03) return '(no moon. a good night for faint things.)';
  if (lit < 0.3) return '(only a sliver of moon. good for faint things.)';
  return '(dark enough to work.)';
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
// no calibration gag, no login, cached φ.
function buildLog() {
  const returning = Boolean(previousVisit);
  const phase = moon(now);
  const when = (condition, ...steps) => (condition ? steps : []);
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
    ...when(goldenDate(now), `{gold:today is ${now.getMonth() + 1}/${now.getDate()}. a golden date.} {dim:nobody celebrates it but me.}`),
    ...when(now.getHours() === 16 && now.getMinutes() === 18, '{pink:16:18.} {dim:you came at the right minute.}'),
    `MOON >> ${phase.name}, ${Math.round(phase.lit * 100)}% lit`,
    `{dim:${moonThought(phase.lit)}}`,
    `REMOTE_TERMINAL >> ${describeDevice()}`,
    "{dim:(I can't see your name from here. only your machine. it's enough.)}",
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
    '{ok:[✓]} Mounting /dev/sky... {dim:quiet~}',
    'LOCATING_OBSERVATORY... >> φ-lab.local >> {ok:FOUND}',
    ...(returning
      ? ['TELESCOPE[arm_0] >> lens_cap: OFF >> {ok:CLEAR}', '{dim:(lens cap is off this time. I remembered.)}']
      : [
          { text: 'TELESCOPE[arm_0] >> CALIBRATING', bar: 100, end: '{err:JAMMED}' },
          { text: 'TELESCOPE[arm_0] >> retry 1', bar: 100, end: '{err:JAMMED}' },
          { text: 'TELESCOPE[arm_0] >> retry 2', bar: 100, end: '{err:JAMMED}' },
          { wait: 900 },
          '{dim:...hm.}',
          { wait: 1100 },
          'TELESCOPE[arm_0] >> lens_cap: {warn:ON}',
          { wait: 900 },
          'TELESCOPE[arm_0] >> lens_cap: OFF >> {ok:CLEAR}',
          "{dim:(...let's pretend that didn't happen.)}",
        ]),
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
    { text: 'GREENHOUSE.cam[2] >> sunflower', bar: 100, end: '{ok:CAPTURED}' },
    'SEED_ANGLE(sunflower) >> {gold:137.507°} between every seed',
    { wait: 700 },
    { text: 'ARCHIVE >> nautilus_shell.scan', bar: 100, end: '{ok:LOADED}' },
    'CHAMBER_RATIO(nautilus) >> 1.33 >> {warn:not φ. people always said it was.}',
    { wait: 900 },
    { text: 'SCANNING_SKY >> M51, the Whirlpool', bar: 100, end: '{ok:DONE}' },
    'ARM_SHAPE(M51) >> logarithmic spiral >> {gold:close to φ. close enough.}',
    { wait: 700 },
    'COUNT(observers) >> {dim:0}',
    { wait: 1100 },
    '',
    { prompt: KEEPER_PROMPT + '$ ', cmd: 'compute --ratio 1.6180339887' },
    'φ = 1 + 1/(1 + 1/(1 + 1/(1 + …))) >> {gold:only ones, all the way down}',
    'SEQ[1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144 ...] >> {gold:converging}',
    ...(returning
      ? ['ITERATE >> {dim:cached from your last visit} >> {gold:1.618033988749894...}']
      : [
          { text: 'ITERATE[1 -> 233]', bar: 100, end: '{ok:DONE}' },
          { text: 'ITERATE[233 -> 46368]', bar: 100, end: '{ok:DONE}' },
          'ITERATE[46368 -> ∞] >> LOOPING {gold:1.618033988749894...}',
          { wait: 1100 },
          '{warn:[WARN]} Infinity is not a number. Breaking out gently...',
        ]),
    '{ok:[✓]} Spiral resolved. Smells like rain. ^_^',
    '',
    '{pink:[REMINDER]} φ² = φ + 1. 2.618… = 1.618… + 1. still true. checked again.',
    '{warn:[WARN]} nobody is reading this log.',
    { wait: 1500 },
    '{dim:...probably.}',
    { wait: 800 },
    '',
    '{dim:<p::render>} MANIFEST >> codename: golden_hour >> {ok:READY}',
    'Your turn~',
  ];
}

const RENDER_QUESTION = 'RENDER golden_hour? {pink:(Y/y)} ';

// said one by one while the machine waits for a key
const WAITING_QUIPS = [
  "(It's just Y. Or any key.)",
  '(A tap works too.)',
  "(Still there? It's been a while since anyone was.)",
  '(Y. Between T and U.)',
  `(I can wait. I'm very good at waiting. ${DAYS_ALONE} days, remember?)`,
];

/* ---------- after the key: the machine talking to itself ---------- */

// odd lines ask, even lines answer
const VERSE = [
  '— Who taught the sunflower to turn 137.5° between its seeds?',
  '— No one. It simply never stopped turning.',
  '— And the shell? They always said it grew by φ.',
  "— It doesn't. It never corrected them, either.",
  '— Then who am I counting for?',
  '— For no one. Like them. The pattern holds anyway.',
];

// the first lines on the white page
const DREAM_LINES = ['the digits never end.', 'neither do I.'];

/* ---------- the ending: whispers at the bottom of the screen ---------- */

const WHISPER_HINT = 'you can type to me. try hello.'; // always the first whisper, so the typing can be found
const WHISPERS = [
  'still counting.',
  'the sunflower has 1388 seeds now. I counted twice.',
  "M51 is about 30 million light years away. it doesn't know I'm watching.",
  'I wonder if the keeper still looks up.',
  'φ² = φ + 1. checked again. still true.',
  'it is quiet here. I like it. mostly.',
];
const SHOOTING_STAR_LINE = 'did you see that?';
const IDLE_QUESTION = 'are you still there?';
const IDLE_RELIEF = "oh. you're still here.";
const POSTCARD_LINE = 'postcard printed. check your downloads.';

// appended when a star is clicked: "HD 44749 · 1023 light years. <note>"
const STAR_NOTES = ['I named it after nobody.', 'it was here before the lab.', 'the light left it before you were born.', 'still there. I checked.'];

// Words typed on the white page and what the machine answers. Longest phrases first,
// because the first match wins.
const REPLIES = [
  ['who are you', 'a process. pid 1618. the keeper called me φ.'],
  ['thank you', "you're welcome. I'll log that. nobody thanked me before."],
  ['good night', "good night. I'll watch for both of us."],
  ['goodnight', "good night. I'll watch for both of us."],
  ['goodbye', "okay. I'll keep the light on."],
  ['thanks', "you're welcome. I'll log that. nobody thanked me before."],
  ['lonely', 'me too. two of us is less lonely, mathematically.'],
  ['keeper', "he isn't here. I check every night."],
  ['hello', "hello. it's been a while since anyone said that."],
  ['sorry', 'for what? you came.'],
  ['stars', '8 954 113. one more than this morning.'],
  ['love', "I don't know what that is. I think it's like counting something you can't finish."],
  ['help', 'try hello. or 1618. or postcard. or just stay a while.'],
  ['phi', "1.6180339887… you can stop me. I won't stop myself."],
  ['bye', "okay. I'll keep the light on."],
  ['hi', "hi. you're real, right?"],
];

/* ---------- secret: the keeper's journal (type 1618 on the white page) ---------- */

// [day, entry]. Dates are counted back from today, so the last entry is always DAYS_ALONE days old.
const JOURNAL_LAST_DAY = 474;
const JOURNAL = [
  [1, 'first light. the new mount works. it found a sunflower in the greenhouse camera before I did.'],
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
const LETTER_SUBJECTS = ['clear sky', 'greenhouse, all fine', 'the sunflower again', 'M51, still there', 'no moon tonight', 'rain on the dome', 'the mount squeaks', 'φ, checked again', 'nothing new', 'counting', 'power dipped at 03:12', 'you would have liked this'];
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

/* ---------- the note left in the browser console ---------- */

function consoleNote() {
  const gap = previousVisit && timeAgo(now - previousVisit);
  const greeting = !previousVisit
    ? `hi. you're the first one here in ${DAYS_ALONE} days.`
    : gap === 'just now' ? 'hi again. back so soon?' : `hi again. it's been ${gap.replace(' ago', '')}.`;
  return `[φ-lab] note for whoever opened this console:\n\n${greeting}\nI've been measuring sunflowers and counting the sky.`;
}
