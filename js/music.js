'use strict';

// Original generative ambient, synthesized live with Web Audio (no audio files):
// a soft piano (rolled chords + a wandering D major pentatonic melody) over quiet pads,
// echo, long reverb and a little tape hiss.
// Browsers only allow sound after a user gesture, so call this from a key/tap handler.
let musicContext = null; // created once, on the first user gesture

function startMusic() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass || musicContext) return;
  const ctx = (musicContext = new AudioContextClass());
  ctx.resume();
  const now = ctx.currentTime;

  const master = ctx.createGain();
  master.gain.setValueAtTime(0, now);
  master.gain.linearRampToValueAtTime(1, now + 8);
  // gentle limiter so stacked piano notes and pads never clip
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -12;
  limiter.ratio.value = 4;
  master.connect(limiter).connect(ctx.destination);

  // reverb: impulse response = decaying stereo noise
  const verb = ctx.createConvolver();
  const len = ctx.sampleRate * 5;
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  }
  verb.buffer = ir;
  const wet = ctx.createGain();
  wet.gain.value = 0.7;
  verb.connect(wet).connect(master);
  const dry = ctx.createGain();
  dry.gain.value = 0.45;
  dry.connect(master);
  const bus = ctx.createGain();
  bus.connect(dry);
  bus.connect(verb);

  // soft echo for the music box
  const delay = ctx.createDelay(2);
  delay.delayTime.value = 0.75;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.22;
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 2500;
  delay.connect(tone).connect(feedback).connect(delay);
  tone.connect(verb);

  // tape hiss: looped brown-ish noise
  const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const nd = nb.getChannelData(0);
  for (let i = 0, v = 0; i < nd.length; i++) nd[i] = (v = (v + 0.02 * (Math.random() * 2 - 1)) / 1.02) * 3;
  const hiss = ctx.createBufferSource();
  hiss.buffer = nb;
  hiss.loop = true;
  const hf = ctx.createBiquadFilter();
  hf.type = 'lowpass';
  hf.frequency.value = 1200;
  const hg = ctx.createGain();
  hg.gain.value = 0.015;
  hiss.connect(hf).connect(hg).connect(master);
  hiss.start();

  const hz = (m) => 440 * 2 ** ((m - 69) / 12);
  // Dmaj9, Bm9, Gmaj9, A6sus (midi notes), one chord per 8 beats
  const CHORDS = [
    [50, 57, 61, 64, 66],
    [47, 54, 57, 61, 62],
    [43, 50, 54, 57, 59],
    [45, 52, 57, 59, 64],
  ];
  const SCALE = [57, 59, 62, 64, 66, 69, 71, 74, 76, 78]; // D major pentatonic, A3..F#5 (piano middle register)
  const BEAT = 1; // 60 bpm

  function pad(m, t, dur) {
    for (const detune of [-6, 6]) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = hz(m);
      o.detune.value = detune;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 800;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.025, t + 3);
      g.gain.setValueAtTime(0.025, t + dur - 1);
      g.gain.linearRampToValueAtTime(0, t + dur + 3);
      o.connect(f).connect(g).connect(bus);
      o.start(t);
      o.stop(t + dur + 3.1);
    }
  }

  // felt-hammer thump: 30 ms of decaying noise, shared by every note
  const thump = ctx.createBuffer(1, ctx.sampleRate * 0.03, ctx.sampleRate);
  const td = thump.getChannelData(0);
  for (let i = 0; i < td.length; i++) td[i] = (Math.random() * 2 - 1) * (1 - i / td.length) ** 2;

  // piano-ish voice: slightly stretched partials, upper ones die faster,
  // a lowpass that closes as the note fades, plus the hammer thump
  function piano(m, t, vel) {
    const f = hz(m);
    const out = ctx.createGain();
    out.gain.value = 0.16 * vel;
    out.connect(bus);
    out.connect(delay);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1800 + 4000 * vel, t);
    lp.frequency.exponentialRampToValueAtTime(700, t + 2.5);
    lp.connect(out);
    const sustain = 2.5 + 3.5 * Math.max(0, (72 - m) / 36); // low notes ring longer
    for (let n = 1; n <= 6; n++) {
      const o = ctx.createOscillator();
      o.frequency.value = f * n * Math.sqrt(1 + 0.0004 * n * n); // string stiffness: partials run slightly sharp
      const amp = 1 / n ** 1.4;
      const decay = sustain / (1 + 0.7 * (n - 1));
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(amp, t + 0.006);
      g.gain.exponentialRampToValueAtTime(amp * 0.35, t + 0.25); // quick drop, then the long string tail
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25 + decay);
      o.connect(g).connect(lp);
      o.start(t);
      o.stop(t + 0.3 + decay);
    }
    const h = ctx.createBufferSource();
    h.buffer = thump;
    const hf = ctx.createBiquadFilter();
    hf.type = 'bandpass';
    hf.frequency.value = Math.min(4000, f * 3);
    hf.Q.value = 1.2;
    const hg = ctx.createGain();
    hg.gain.value = 0.25 * vel;
    h.connect(hf).connect(hg).connect(out);
    h.start(t);
  }

  let next = now + 0.5, step = 0, chord = 0, note = 4;
  function schedule() {
    // look 2 s ahead so background-tab timer throttling never leaves a gap
    while (next < ctx.currentTime + 2) {
      if (step % 8 === 0) {
        const c = CHORDS[chord++ % CHORDS.length];
        c.forEach((m) => pad(m, next, 8 * BEAT));
        // left hand: a low root, then the chord rolled upward
        piano(c[0] - 12, next, 0.55);
        c.slice(1, 4).forEach((m, i) => piano(m, next + 0.35 * (i + 1), 0.35 + Math.random() * 0.1));
      }
      if (step >= 8 && step % 8 > 1 && Math.random() < 0.45) {
        // right hand: random walk on the scale, mostly small steps, like someone improvising quietly
        note = Math.max(0, Math.min(SCALE.length - 1, note + [-2, -1, -1, 0, 1, 1, 2][(Math.random() * 7) | 0]));
        piano(SCALE[note], next + (Math.random() < 0.3 ? BEAT / 2 : 0), 0.45 + Math.random() * 0.35);
      }
      next += BEAT;
      step++;
    }
  }
  schedule();
  setInterval(schedule, 250);
}
