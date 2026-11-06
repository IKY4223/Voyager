'use strict';

// Original generative ambient, synthesized live with Web Audio (no audio files):
// slow pads, a music-box melody on D major pentatonic, echo, long reverb and a little tape hiss.
// Browsers only allow sound after a user gesture, so call this from a key/tap handler.
function startMusic() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC || startMusic.ctx) return;
  const ctx = (startMusic.ctx = new AC());
  ctx.resume();
  const now = ctx.currentTime;

  const master = ctx.createGain();
  master.gain.setValueAtTime(0, now);
  master.gain.linearRampToValueAtTime(1, now + 8);
  // gentle limiter so stacked bells and pads never clip
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
  feedback.gain.value = 0.35;
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
  const SCALE = [62, 64, 66, 69, 71, 74, 76, 78, 81, 83]; // D major pentatonic, D4..B5
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
      g.gain.linearRampToValueAtTime(0.05, t + 3);
      g.gain.setValueAtTime(0.05, t + dur - 1);
      g.gain.linearRampToValueAtTime(0, t + dur + 3);
      o.connect(f).connect(g).connect(bus);
      o.start(t);
      o.stop(t + dur + 3.1);
    }
  }

  function bell(m, t, vel) {
    for (const [ratio, amp] of [[1, 1], [2, 0.18], [4.2, 0.06]]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = hz(m) * ratio;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.11 * vel * amp, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3 / ratio ** 0.3);
      o.connect(g);
      g.connect(bus);
      g.connect(delay);
      o.start(t);
      o.stop(t + 3.2);
    }
  }

  let next = now + 0.5, step = 0, chord = 0, note = 4;
  function schedule() {
    // look 2 s ahead so background-tab timer throttling never leaves a gap
    while (next < ctx.currentTime + 2) {
      if (step % 8 === 0) CHORDS[chord++ % CHORDS.length].forEach((m) => pad(m, next, 8 * BEAT));
      if (step >= 8 && Math.random() < 0.55) {
        // random walk on the scale: mostly small steps, like someone humming
        note = Math.max(0, Math.min(SCALE.length - 1, note + [-2, -1, -1, 0, 1, 1, 2][(Math.random() * 7) | 0]));
        bell(SCALE[note], next + (Math.random() < 0.3 ? BEAT / 2 : 0), 0.6 + Math.random() * 0.4);
      }
      next += BEAT;
      step++;
    }
  }
  schedule();
  setInterval(schedule, 250);
}
