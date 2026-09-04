// A tiny looping "two characters tagging each other" animation for the top
// corner of the Home screen. Purely decorative -- reuses the exact same
// drawCharacter() renderer the real game uses, so it matches the actual art
// style instead of being a separate illustration.

import { drawCharacter, Particles } from './render.js';
import { profile } from './storage.js';

const W = 160;
const H = 100;
const SCALE = 1.3;
const CHAR_W = 28 * SCALE;
const GROUND_Y = 78;
const LEFT_X = 14;
const RIGHT_X = W - 14 - CHAR_W;
const RUN_TIME = 1.1; // seconds to cross from one side to the other
const PAUSE_TIME = 0.4; // hold at contact, spark, then reverse

let ctx = null;
let particles = null;
let raf = null;
let time = 0;
let taggerOnLeft = true; // which side is currently chasing
let progress = 0; // 0 = tagger at their own side, 1 = they've reached the other
let phase = 'run'; // 'run' | 'pause'
let pauseElapsed = 0;
let lastT = 0;

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
}

function step(dt) {
  time += dt;
  particles.update(dt);

  if (phase === 'run') {
    progress = Math.min(1, progress + dt / RUN_TIME);
    if (progress >= 1) {
      phase = 'pause';
      pauseElapsed = 0;
      const contactX = taggerOnLeft ? RIGHT_X + CHAR_W * 0.15 : LEFT_X + CHAR_W * 0.85;
      particles.spawn(contactX, GROUND_Y - CHAR_W * 1.1, 12, {
        color: '#ff4d6d', speed: 90, life: 0.4, size: 2.5, gravity: 140, spread: Math.PI * 2,
      });
      particles.spawn(contactX, GROUND_Y - CHAR_W * 1.1, 7, {
        color: '#ffd166', speed: 70, life: 0.35, size: 2, gravity: 90, spread: Math.PI * 2,
      });
    }
  } else {
    pauseElapsed += dt;
    if (pauseElapsed >= PAUSE_TIME) {
      taggerOnLeft = !taggerOnLeft;
      progress = 0;
      phase = 'run';
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(W / 2, GROUND_Y + 8, 58, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Stops a little short of a full overlap -- reaching all the way to the
  // other's exact position would draw one sprite completely on top of the
  // other for the whole pause, reading as "one character" in a still frame.
  const travel = RIGHT_X - LEFT_X - CHAR_W * 0.4;
  const t = easeInOut(progress);
  const leftCharX = taggerOnLeft ? LEFT_X + travel * t : LEFT_X;
  const rightCharX = taggerOnLeft ? RIGHT_X : RIGHT_X - travel * t;
  const y = GROUND_Y - 38 * SCALE;

  const mySkin = profile.skin || 'runner';
  const otherSkin = mySkin === 'ember' ? 'cobalt' : 'ember';

  drawCharacter(ctx, leftCharX, y, {
    skinId: mySkin,
    facing: taggerOnLeft ? 1 : -1,
    it: taggerOnLeft,
    onGround: true,
    vx: taggerOnLeft && phase === 'run' ? 220 : 0,
    vy: 0,
    time,
    scale: SCALE,
  });
  drawCharacter(ctx, rightCharX, y, {
    skinId: otherSkin,
    facing: taggerOnLeft ? -1 : 1,
    it: !taggerOnLeft,
    onGround: true,
    vx: !taggerOnLeft && phase === 'run' ? -220 : 0,
    vy: 0,
    time,
    scale: SCALE,
  });

  particles.draw(ctx);
  ctx.globalAlpha = 1;
}

function loop(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000 || 0);
  lastT = now;
  step(dt);
  draw();
  raf = requestAnimationFrame(loop);
}

/** Start (or restart) the loop on the given canvas. Cheap to call again --
 * a no-op if it's already running on the same element. */
export function start(canvas) {
  if (raf && ctx?.canvas === canvas) return;
  stop();
  canvas.width = W;
  canvas.height = H;
  ctx = canvas.getContext('2d');
  particles = new Particles(60);
  time = 0;
  taggerOnLeft = true;
  progress = 0;
  phase = 'run';
  pauseElapsed = 0;
  lastT = performance.now();
  raf = requestAnimationFrame(loop);
}

export function stop() {
  if (raf) cancelAnimationFrame(raf);
  raf = null;
  ctx = null;
}
