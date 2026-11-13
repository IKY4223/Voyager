'use strict';

// The ASCII sky behind the second half of the story. Uses core.js; colours come from the CSS
// variables --pink and --gold.
//
// Two modes:
//  - 'spiral' (the monologue and the first white lines): a golden spiral with a sunflower growing in
//    its core, sparks flowing along the arm, dust, a scan ring, and two faint sparks drifting apart
//    from the centre: Voyager 1 and Voyager 2, each clickable.
//  - 'beams' (the ending): slanted bands of scattered sunlight, as on the Pale Blue Dot photograph.
//    The blue dot itself is a page element (see #earth in index.html), not drawn here.
// Twinkling stars and the odd shooting star appear in both.
//
// Keeping it cheap:
//  - per-cell geometry (distance, angle, band position) is computed once per resize, never per frame;
//  - the dense layer is redrawn ~12 times a second onto an offscreen canvas; only the few moving
//    glyphs on top run at ~30 fps;
//  - nothing is drawn while Sky.paused is set (something opaque covers the sky).

const Sky = {
  canvas: $('#sky'),
  paused: false,
  mode: 'spiral',
  onShootingStar: null, // () => void
  onSparkPicked: null, // (which: 1 | 2) => void
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
  const FRAME_MS = 33, LAYER_MS = 80, BEAMS_LAYER_MS = 400; // the sunlight bands barely change: redraw them rarely
  const SEEDS = 320, SEED_EVERY_MS = 120;
  const RING_EVERY_MS = 11000, RING_SWEEP_MS = 4500;
  const SHOOTING_STAR_MS = 900;
  // [centre, half-width, strength] of each sunlight band, along a diagonal running 0..1 across the screen
  const BANDS = [[0.18, 0.1, 0.9], [0.43, 0.06, 0.6], [0.66, 0.13, 1], [0.88, 0.05, 0.5]];
  // the two Voyagers: direction on screen and drift speed in share-of-screen per second, in the
  // ratio of their real speeds (17 vs 15.4 km/s); they separate during the ~40 s of the dark scene
  const VOYAGERS = [
    // upward, so they drift through the empty sky above the monologue instead of under its lines
    { which: 1, angle: -0.9, speed: 0.01, glyph: '*', ink: 'arm' },
    { which: 2, angle: -2.25, speed: 0.0091, glyph: '*', ink: 'star' },
  ];
  const VOYAGER_REACH_PX = 24, VOYAGER_MAX = 0.42; // they stop drifting at this share of the screen

  const stars = Array.from({ length: 90 }, () => ({
    x: Math.random(), y: Math.random(), // as a share of the screen
    glyph: pick('.+*'),
    twinklePhase: rand(0, TAU), twinkleSpeed: rand(0.0006, 0.0026),
  }));
  // sparks travel outward along the arm; `s` is ln(radius / armStart)
  const sparks = Array.from({ length: 70 }, () => ({ s: rand(0, 7), speed: rand(0.0012, 0.003) }));
  const buckets = Array.from(SHADES, () => []); // cell positions per shade, reused every layer redraw

  const born = performance.now();
  let width, height, cellW, cellH, cols, rows, centerX, centerY, armStart, maxRadius;
  let cellTurns, cellRadius, cellFalloff, cellDiagonal, cellBand; // per grid cell, see resize()
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
    cellBand = new Float32Array(cols * rows);
    for (let row = 0, i = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++, i++) {
        const dx = (col + 0.5) * cellW - centerX, dy = (row + 0.5) * cellH - centerY;
        const radius = Math.hypot(dx, dy);
        cellRadius[i] = radius;
        // where the cell sits relative to the arm, in turns, before rotation; NaN marks the very centre
        cellTurns[i] = radius < 3 ? NaN : (Math.log(radius / armStart) / GROWTH - Math.atan2(dy, dx)) / TAU;
        cellFalloff[i] = Math.max(0, 1 - radius / maxRadius) ** 0.5;
        cellDiagonal[i] = Math.round(col + (row * cellH) / cellW);
        // brightness of the sunlight bands at this cell (beams mode), before shimmer
        const along = (col / cols) * 0.35 + (row / rows) * 0.65;
        let band = 0;
        for (const [centre, halfWidth, strength] of BANDS) {
          const off = Math.abs(along - centre) / halfWidth;
          if (off < 1) band = Math.max(band, strength * (1 - off) ** 2);
        }
        cellBand[i] = band;
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

  function drawShades(color, alphaBase, alphaRange) {
    layerCtx.fillStyle = color;
    buckets.forEach((cells, shade) => {
      layerCtx.globalAlpha = alphaBase + (shade / SHADES.length) * alphaRange;
      for (let k = 0; k < cells.length; k += 2) layerCtx.fillText(SHADES[shade], cells[k], cells[k + 1]);
    });
  }

  function drawSpiralLayer(t) {
    const age = t - born;
    const rotation = reduceMotion ? 0 : t * ROTATION;
    const breathe = 0.85 + 0.15 * Math.sin(t * 0.0006);
    const ringProgress = (age % RING_EVERY_MS) / RING_SWEEP_MS;
    const ringRadius = ringProgress * maxRadius;
    const ringStrength = ringProgress < 1 ? 1 - ringProgress : 0;

    for (let col = 0; col < cols; col++) dustCol[col] = Math.sin((col + 0.5) * cellW * 0.011 + t * 0.00021);
    for (let row = 0; row < rows; row++) dustRow[row] = Math.sin((row + 0.5) * cellH * 0.019 - t * 0.00013);
    for (let d = 0; d < dustDiagonal.length; d++) dustDiagonal[d] = Math.sin(d * cellW * 0.007 + t * 0.0001);

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
    drawShades(ink.arm, ink.light ? 0.12 : 0.1, ink.light ? 0.35 : 0.45);

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
  }

  function drawBeamsLayer(t) {
    const shimmer = reduceMotion ? 0 : t * 0.0004;
    for (let row = 0, i = 0; row < rows; row++) {
      const y = (row + 0.5) * cellH;
      for (let col = 0; col < cols; col++, i++) {
        if (cellBand[i] === 0) continue;
        const brightness = cellBand[i] * (0.75 + 0.25 * Math.sin(col * 0.37 + row * 0.23 + shimmer));
        if (brightness < 0.08) continue;
        buckets[Math.min(SHADES.length - 1, (brightness * 9) | 0)].push(col * cellW, y);
      }
    }
    drawShades(ink.star, ink.light ? 0.14 : 0.08, ink.light ? 0.5 : 0.4);
  }

  function drawLayer(t) {
    for (const bucket of buckets) bucket.length = 0;
    layerCtx.clearRect(0, 0, width, height);
    if (Sky.mode === 'beams') drawBeamsLayer(t);
    else drawSpiralLayer(t);
    layerCtx.globalAlpha = 1;
  }

  // where each Voyager spark is now, in px
  function voyagerPosition(voyager, t) {
    const drift = reduceMotion ? VOYAGER_MAX : Math.min(VOYAGER_MAX, 0.03 + ((t - born) / 1000) * voyager.speed);
    const reach = drift * Math.min(width, height);
    return [centerX + Math.cos(voyager.angle) * reach, centerY + Math.sin(voyager.angle) * reach];
  }

  function drawFrame(t, dt) {
    const age = t - born;
    const rotation = reduceMotion ? 0 : t * ROTATION;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(layer, 0, 0, width, height);

    if (Sky.mode === 'spiral') {
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
      // the two Voyagers drifting apart, each trailing a faint dotted path back to the centre
      for (const voyager of VOYAGERS) {
        const [x, y] = voyagerPosition(voyager, t);
        ctx.fillStyle = ink[voyager.ink];
        for (let step = 1; step <= 12; step++) {
          ctx.globalAlpha = 0.05 + (step / 12) * 0.3;
          ctx.fillText('.', centerX + ((x - centerX) * step) / 12, centerY + ((y - centerY) * step) / 12);
        }
        const pulse = 0.75 + 0.25 * Math.sin(t * 0.002 + voyager.which);
        ctx.globalAlpha = pulse;
        ctx.fillText(voyager.glyph, x, y);
        ctx.globalAlpha = 0.3 * pulse; // a faint cross of light around it
        for (const [dx, dy, ray] of [[-cellW, 0, '-'], [cellW, 0, '-'], [0, -cellH, '|'], [0, cellH, '|']]) ctx.fillText(ray, x + dx, y + dy);
      }
    }

    ctx.fillStyle = ink.star;
    for (const star of stars) {
      ctx.globalAlpha = 0.15 + 0.45 * (0.5 + 0.5 * Math.sin(star.twinklePhase + t * star.twinkleSpeed));
      ctx.fillText(star.glyph, star.x * width, star.y * height);
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

  let drawnMode = Sky.mode;
  function redraw(t) {
    readInk();
    if (drawnMode !== Sky.mode) {
      drawnMode = Sky.mode;
      lastLayer = -Infinity;
    }
    if (t - lastLayer >= (Sky.mode === 'beams' ? BEAMS_LAYER_MS : LAYER_MS)) {
      drawLayer(t);
      lastLayer = t;
    }
    drawFrame(t, Math.min(100, t - lastFrame || 16));
    lastFrame = t;
  }
  Sky.redraw = () => redraw(performance.now()); // used when reduced motion means no animation loop

  function loop(t) {
    requestAnimationFrame(loop);
    if (!Sky.paused && t - lastFrame >= FRAME_MS) redraw(t);
  }

  addEventListener('pointerdown', (event) => {
    if (Sky.paused || Sky.mode !== 'spiral') return;
    const t = performance.now();
    const hit = VOYAGERS.find((voyager) => {
      const [x, y] = voyagerPosition(voyager, t);
      return Math.hypot(event.clientX - x - cellW / 2, event.clientY - y) < VOYAGER_REACH_PX;
    });
    if (hit) Sky.onSparkPicked?.(hit.which);
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
