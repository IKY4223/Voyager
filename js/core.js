'use strict';

// Shared toolkit, loaded first: DOM helper, timing, what the browser remembers about the visitor,
// and the real-world facts the story uses (clock, moon, golden dates, the visitor's machine).
// The scripts are plain <script> files (no modules), so the site also runs straight from disk.

const $ = (selector) => document.querySelector(selector);

const DAYS_ALONE = 1618; // the number the story hangs on: φ ≈ 1.618
const DAY_MS = 86400000;

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
// ?fast plays the story 20x faster; tests/smoke.cjs relies on it
const speed = new URLSearchParams(location.search).has('fast') ? 0.05 : 1;
// while true, sleep() resolves at once; only skip() in main.js turns it on, and only during the log
let skipping = false;

const sleep = (ms) =>
  skipping || reduceMotion ? Promise.resolve() : new Promise((done) => setTimeout(done, ms * speed));
const rand = (min, max) => min + Math.random() * (max - min);
const pick = (list) => list[(Math.random() * list.length) | 0];
const isoDate = (time) => new Date(time).toLocaleDateString('en-CA'); // YYYY-MM-DD, local time
const clockTime = (time) => new Date(time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/* ---------- memory: what this browser remembers about earlier visits ---------- */

const MEMORY_KEY = 'phi-lab';

const memory = (() => {
  try {
    return JSON.parse(localStorage.getItem(MEMORY_KEY)) || {};
  } catch {
    return {}; // storage blocked or corrupted: treat as a first visit
  }
})();

function remember(patch) {
  Object.assign(memory, patch);
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(memory));
  } catch {
    // storage blocked (private mode etc.): the machine just forgets
  }
}

const now = new Date(); // one clock reading for the whole visit
const previousVisit = memory.last; // undefined on a first visit
const firstVisit = memory.first || previousVisit || now.getTime();
const visitNumber = (memory.visits || 0) + 1;
remember({ last: now.getTime(), first: firstVisit, visits: visitNumber });
// on the 13th visit the machine writes its own journal entry, dated that day
if (visitNumber === 13) remember({ wrote: now.getTime() });

/* ---------- real-world facts ---------- */

function timeAgo(ms) {
  const minutes = Math.round(ms / 60000), hours = Math.round(ms / 3600000), days = Math.round(ms / DAY_MS);
  const unit = (n, word) => `${n} ${word}${n === 1 ? '' : 's'} ago`;
  if (minutes < 1) return 'just now';
  if (minutes < 60) return unit(minutes, 'minute');
  return hours < 24 ? unit(hours, 'hour') : unit(days, 'day');
}

// Moon phase from the date alone: days since a known new moon (2000-01-06 18:14 UTC), modulo the synodic month.
function moon(date) {
  const SYNODIC_DAYS = 29.530588853;
  const NAMES = ['new moon', 'waxing crescent', 'first quarter', 'waxing gibbous', 'full moon', 'waning gibbous', 'last quarter', 'waning crescent'];
  const age = ((((date - Date.UTC(2000, 0, 6, 18, 14)) / DAY_MS) % SYNODIC_DAYS) + SYNODIC_DAYS) % SYNODIC_DAYS;
  const lit = (1 - Math.cos((2 * Math.PI * age) / SYNODIC_DAYS)) / 2;
  return { name: NAMES[Math.round((age / SYNODIC_DAYS) * 8) % 8], lit };
}

// A "golden date": month and day are neighbouring Fibonacci numbers (1/1, 1/2, 2/3, 3/5, 5/8, 8/13).
function goldenDate(date) {
  const FIB = [1, 1, 2, 3, 5, 8, 13];
  const month = date.getMonth() + 1, day = date.getDate();
  return FIB.some((f, i) => i < FIB.length - 1 && f === month && FIB[i + 1] === day);
}
