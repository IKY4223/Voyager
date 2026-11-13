'use strict';

// Shared toolkit, loaded first: DOM helper, timing, what the browser remembers about the visitor,
// and the real-world facts the story uses (the clock, the two Voyagers).
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

/* ---------- the Voyagers (source: science.nasa.gov/mission/voyager, read 2026-11-12) ---------- */

const KM_PER_AU = 149597870.7;
const KM_PER_LIGHT_DAY = 299792.458 * 86400; // 25 902 068 371 km

// Voyager 1 is one light-day from Earth at this instant (NASA forecast: 25.902 billion km, Nov 18, 2026 2:16:07 a.m. PST).
const VOYAGER_1_LIGHT_DAY_AT = Date.UTC(2026, 10, 18, 10, 16, 7);
const VOYAGER_1_KM_PER_S = 17.0; // relative to the Sun
// Voyager 2: 116.167 AU from Earth on Nov 5, 2017, leaving at 15.4 km/s (the newest values NASA's pages give).
const VOYAGER_2_ANCHOR = { at: Date.UTC(2017, 10, 5), km: 116.167 * KM_PER_AU };
const VOYAGER_2_KM_PER_S = 15.4;

// shortcut: straight-line extrapolation from one published point; Earth's own orbit makes the true
// Earth distance swing by about ±1 AU (under 1%). Fine for a story; use JPL Horizons if it ever needs to be exact.
const voyager1Km = (time) => KM_PER_LIGHT_DAY + VOYAGER_1_KM_PER_S * ((time - VOYAGER_1_LIGHT_DAY_AT) / 1000);
const voyager2Km = (time) => VOYAGER_2_ANCHOR.km + VOYAGER_2_KM_PER_S * ((time - VOYAGER_2_ANCHOR.at) / 1000);

const formatAU = (km) => (km / KM_PER_AU).toFixed(1) + ' AU';
const formatBillionKm = (km) => (km / 1e9).toFixed(1) + ' billion km';
