'use strict';

// The ASCII sky behind the second half of the story: a golden spiral with a sunflower growing in
// its core, sparks flowing along the arm, drifting dust, a scan ring, twinkling stars that can be
// clicked, and the odd shooting star. Uses core.js; colours come from the CSS variables --pink and --gold.
//
// Keeping it cheap:
//  - per-cell geometry (distance, angle) is computed once per resize, never per frame;
//  - the dense layer (spiral, dust, ring, sunflower) is redrawn ~12 times a second onto an
//    offscreen canvas; only the few moving glyphs on top run at ~30 fps;
//  - nothing is drawn while Sky.paused is set (something opaque covers the sky).

const Sky = {
  canvas: $('#sky'),
  paused: false,
  onShootingStar: null, // () => void
  onStarPicked: null, // (star) => void, where star has { name, lightYears }
  start: startSky,
};

function startSky() {
  const canvas = Sky.canvas;
  const ctx = canvas.getContext('2d');
  const layer = document.createElement('canvas');
  const layerCtx = layer.getContext('2d');

  const TAU = Math.PI * 2;
  const PHI = (1 + Math.sqrt(5)) / 2;
  const GROWTH = Math.log(PHI) / (Math.PI / 2); // the arm's radius grows by φ every quarter turn
  const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // 137.5°, the angle between sunflower seeds
  const SHADES = ' .,:;-=+*#%@'; // dim to bright
  const ARM_WIDTH = 0.17; // in turns
  const ROTATION = 0.00012; // radians per ms
  const FRAME_MS = 33, LAYER_MS = 80;
  const SEEDS = 320, SEED_EVERY_MS = 120;
  const RING_EVERY_MS = 11000, RING_SWEEP_MS = 4500;
  const STAR_FLARE_MS = 3000, STAR_REACH_PX = 18; // stars are tiny, so clicks are forgiving
  const SHOOTING_STAR_MS = 900;

  const stars = Array.from({ length: 90 }, (_, i) => ({
    x: Math.random(), y: Math.random(), // as a share of the screen
    glyph: pick('.+*'),
    twinklePhase: rand(0, TAU), twinkleSpeed: rand(0.0006, 0.0026),
    pickedAt: -Infinity,
    // a stable, made-up catalogue entry
    name: 'HD ' + (((i * 1618 + 4007) % 90000) + 10000),
    lightYears: 120 + (((i * 2654435761) >>> 0) % 1900),
  }));
  // sparks travel outward along the arm; `s` is ln(radius / armStart)
  const sparks = Array.from({ length: 70 }, () => ({ s: rand(0, 7), speed: rand(0.0012, 0.003) }));
  const buckets = Array.from(SHADES, () => []); // cell positions per shade, reused every layer redraw

  const born = performance.now();
  let width, height, cellW, cellH, cols, rows, centerX, centerY, armStart, maxRadius;
  let cellTurns, cellRadius, cellFalloff, cellDiagonal; // per grid cell, see resize()
  let dustCol, dustRow, dustDiagonal; // the three dust waves, sampled per column / row / diagonal
  let lastFrame = 0, lastLayer = -Infinity;
  let shootingStar = null, nextShootingStar = 5000;
  let ink = null;

  const snapX = (x) => Math.round(x / cellW) * cellW;
  const snapY = (y) => Math.round(y / cellH) * cellH;

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    width = innerWidth;
    height = innerHeight;
    for (const [target, context] of [[canvas, ctx], [layer, layerCtx]]) {
      target.width = width * dpr;
      target.height = height * dpr;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.font = `${width < 600 ? 10 : 12}px "Courier New", monospace`;
      context.textBaseline = 'middle';
    }
    cellW = ctx.measureText('M').width;
    cellH = width < 600 ? 11 : 13;
    cols = Math.ceil(width / cellW);
    rows = Math.ceil(height / cellH);
    centerX = width / 2;
    centerY = height / 2;
    armStart = Math.min(width, height) * 0.006;
    maxRadius = Math.hypot(width, height) * 0.55;

    cellTurns = new Float32Array(cols * rows);
    cellRadius = new Float32Array(cols * rows);
    cellFalloff = new Float32Array(cols * rows);
    cellDiagonal = new Uint16Array(cols * rows);
    for (let row = 0, i = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++, i++) {
        const dx = (col + 0.5) * cellW - centerX, dy = (row + 0.5) * cellH - centerY;
        const radius = Math.hypot(dx, dy);
        cellRadius[i] = radius;
        // where the cell sits relative to the arm, in turns, before rotation; NaN marks the very centre
        cellTurns[i] = radius < 3 ? NaN : (Math.log(radius / armStart) / GROWTH - Math.atan2(dy, dx)) / TAU;
        cellFalloff[i] = Math.max(0, 1 - radius / maxRadius) ** 0.5;
        cellDiagonal[i] = Math.round(col + (row * cellH) / cellW);
      }
    }
    dustCol = new Float32Array(cols);
    dustRow = new Float32Array(rows);
    dustDiagonal = new Float32Array(cols + Math.ceil((rows * cellH) / cellW) + 2);
    lastLayer = -Infinity; // redraw the layer on the next frame
  }

  // Colours follow the page theme; re-read them only when the theme changes.
  function readInk() {
    const light = document.body.classList.contains('light');
    if (ink && ink.light === light) return;
    const style = getComputedStyle(document.body);
    ink = { light, arm: style.getPropertyValue('--pink').trim(), star: style.getPropertyValue('--gold').trim() };
    lastLayer = -Infinity;
  }

  function drawLayer(t) {
    const age = t - born;
    const rotation = reduceMotion ? 0 : t * ROTATION;
    const breathe = 0.85 + 0.15 * Math.sin(t * 0.0006);
    const ringProgress = (age % RING_EVERY_MS) / RING_SWEEP_MS;
    const ringRadius = ringProgress * maxRadius;
    const ringStrength = ringProgress < 1 ? 1 - ringProgress : 0;

    for (let col = 0; col < cols; col++) dustCol[col] = Math.sin((col + 0.5) * cellW * 0.011 + t * 0.00021);
    for (let row = 0; row < rows; row++) dustRow[row] = Math.sin((row + 0.5) * cellH * 0.019 - t * 0.00013);
    for (let d = 0; d < dustDiagonal.length; d++) dustDiagonal[d] = Math.sin(d * cellW * 0.007 + t * 0.0001);

    for (const bucket of buckets) bucket.length = 0;
    const turned = rotation / TAU;
    for (let row = 0, i = 0; row < rows; row++) {
      const y = (row + 0.5) * cellH;
      for (let col = 0; col < cols; col++, i++) {
        const turns = cellTurns[i] - turned;
        if (turns !== turns) continue; // NaN
        const offArm = Math.abs(turns - Math.round(turns)); // 0 on the arm, 0.5 between arms
        let brightness = offArm < ARM_WIDTH ? 1 - offArm / ARM_WIDTH : 0;
        brightness *= brightness * cellFalloff[i] * breathe;
        if (ringStrength && Math.abs(cellRadius[i] - ringRadius) < cellH) brightness = Math.max(brightness, 0.4 * ringStrength);
        if (brightness < 0.05) {
          // dust between the arms
          if (dustCol[col] * dustRow[row] * dustDiagonal[cellDiagonal[i]] > 0.5) buckets[1].push(col * cellW, y);
          continue;
        }
        buckets[Math.min(SHADES.length - 1, (brightness * SHADES.length) | 0)].push(col * cellW, y);
      }
    }

    layerCtx.clearRect(0, 0, width, height);
    layerCtx.fillStyle = ink.arm;
    buckets.forEach((cells, shade) => {
      layerCtx.globalAlpha = (ink.light ? 0.12 : 0.1) + (shade / SHADES.length) * (ink.light ? 0.35 : 0.45);
      for (let k = 0; k < cells.length; k += 2) layerCtx.fillText(SHADES[shade], cells[k], cells[k + 1]);
    });

    // the sunflower in the core grows one seed at a time, each 137.5° from the last
    const seeds = reduceMotion ? SEEDS : Math.min(SEEDS, (age / SEED_EVERY_MS) | 0);
    const spacing = Math.min(width, height) * 0.009;
    layerCtx.fillStyle = ink.star;
    for (let n = 1; n < seeds; n++) {
      const radius = spacing * Math.sqrt(n), angle = n * GOLDEN_ANGLE + rotation * 0.5;
      const fresh = n > seeds - 10;
      layerCtx.globalAlpha = fresh ? 0.7 : 0.35;
      layerCtx.fillText(fresh ? 'o' : '.', snapX(centerX + radius * Math.cos(angle)) - cellW / 2, snapY(centerY + radius * Math.sin(angle)));
    }
    layerCtx.globalAlpha = 1;
  }

  function drawFrame(t, dt) {
    const age = t - born;
    const rotation = reduceMotion ? 0 : t * ROTATION;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(layer, 0, 0, width, height);

    // sparks flowing outward along the arm, each with a short fading tail
    ctx.fillStyle = ink.arm;
    for (const spark of sparks) {
      if (!reduceMotion) spark.s += spark.speed * dt * 0.06;
      if (armStart * Math.exp(spark.s) > maxRadius) spark.s = rand(0, 1.5);
      for (let tail = 0; tail < 3; tail++) {
        const s = spark.s - tail * 0.05;
        const radius = armStart * Math.exp(s), angle = s / GROWTH - rotation; // a point on the arm
        ctx.globalAlpha = (0.75 - tail * 0.25) * Math.max(0, 1 - radius / maxRadius);
        ctx.fillText('*+.'[tail], snapX(centerX + radius * Math.cos(angle)) - cellW / 2, snapY(centerY + radius * Math.sin(angle)));
      }
    }

    ctx.fillStyle = ink.star;
    for (const star of stars) {
      const x = star.x * width, y = star.y * height;
      const flare = Math.max(0, 1 - (t - star.pickedAt) / STAR_FLARE_MS);
      if (flare) {
        // a clicked star flares up for a few seconds
        ctx.globalAlpha = 0.6 + 0.4 * flare;
        ctx.fillText('*', x, y);
        ctx.globalAlpha = 0.5 * flare;
        for (const [dx, dy, ray] of [[-cellW, 0, '-'], [cellW, 0, '-'], [0, -cellH, '|'], [0, cellH, '|']]) ctx.fillText(ray, x + dx, y + dy);
      } else {
        ctx.globalAlpha = 0.15 + 0.45 * (0.5 + 0.5 * Math.sin(star.twinklePhase + t * star.twinkleSpeed));
        ctx.fillText(star.glyph, x, y);
      }
    }

    if (!reduceMotion && !shootingStar && age > nextShootingStar) {
      shootingStar = { x: rand(width * 0.3, width), y: rand(0, height * 0.4), since: t };
      nextShootingStar = age + rand(6000, 14000);
      Sky.onShootingStar?.();
    }
    if (shootingStar) {
      const progress = (t - shootingStar.since) / SHOOTING_STAR_MS;
      if (progress > 1) shootingStar = null;
      else {
        for (let tail = 0; tail < 8; tail++) {
          const at = Math.max(0, progress - tail * 0.02);
          ctx.globalAlpha = (1 - progress) * (1 - tail / 8) * 0.9;
          ctx.fillText(tail ? '/' : '*', shootingStar.x - at * width * 0.35, shootingStar.y + at * height * 0.25);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  function redraw(t) {
    readInk();
    if (t - lastLayer >= LAYER_MS) {
      drawLayer(t);
      lastLayer = t;
    }
    drawFrame(t, Math.min(100, t - lastFrame || 16));
    lastFrame = t;
  }

  function loop(t) {
    requestAnimationFrame(loop);
    if (!Sky.paused && t - lastFrame >= FRAME_MS) redraw(t);
  }

  addEventListener('pointerdown', (event) => {
    if (Sky.paused) return;
    let picked = null, nearest = STAR_REACH_PX;
    for (const star of stars) {
      const distance = Math.hypot(event.clientX - star.x * width - cellW / 2, event.clientY - star.y * height);
      if (distance < nearest) {
        picked = star;
        nearest = distance;
      }
    }
    if (!picked) return;
    picked.pickedAt = performance.now();
    if (reduceMotion) redraw(performance.now());
    Sky.onStarPicked?.(picked);
  });

  addEventListener('resize', () => {
    resize();
    if (reduceMotion) redraw(performance.now());
  });

  resize();
  // reduced motion: one still frame instead of an animation
  if (reduceMotion) redraw(performance.now());
  else requestAnimationFrame(loop);
  canvas.classList.add('on');
}
