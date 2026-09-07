// The one-time "2D TAG" logo-build intro that plays on launch, before
// Welcome/Home: two characters run in from the edges and crash into each
// other, forming the "2" right at the point of impact; "D" then pops in out
// of nowhere; then "T", "A" and "G" jump in one after another like clumsy,
// off-balance movers, completing the exact same 2D TAG wordmark the
// Welcome/Home screens show underneath. Purely decorative -- reuses the
// same drawCharacter() renderer as the rest of the game, and is skippable
// with a single tap/click since it plays on every load, not just the first.

import { drawCharacter, Particles } from './render.js';
import { profile } from './storage.js';

const CHAR_SCALE = 3.2;
const CHAR_W = 28 * CHAR_SCALE;
const RUN_TIME = 0.85; // seconds for each runner to close the gap

let ctx = null;
let particles = null;
let raf = null;
let time = 0;
let lastT = 0;
let w = 0;
let h = 0;
let groundY = 0;
let progress = 0; // 0..1, how much of the gap the runners have closed
let collided = false;
let collideAt = 0;

function easeIn(t) {
  return t * t;
}

function resize(canvas) {
  w = canvas.width = canvas.clientWidth;
  h = canvas.height = canvas.clientHeight;
  groundY = h * 0.6;
}

function step(dt) {
  time += dt;
  particles.update(dt);
  if (!collided) {
    progress = Math.min(1, progress + dt / RUN_TIME);
    if (progress >= 1) {
      collided = true;
      collideAt = time;
      const cx = w / 2;
      const cy = groundY - CHAR_W * 0.5;
      particles.spawn(cx, cy, 28, {
        color: '#ffd166', speed: 240, life: 0.55, size: 3.5, gravity: 260, spread: Math.PI * 2,
      });
      particles.spawn(cx, cy, 16, {
        color: '#ff4d6d', speed: 190, life: 0.5, size: 3, gravity: 220, spread: Math.PI * 2,
      });
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, w, h);

  if (!collided) {
    const cx = w / 2;
    const t = easeIn(progress);
    const startGap = w / 2 + CHAR_W;
    const gap = startGap * (1 - t);
    const leftX = cx - gap / 2 - CHAR_W / 2;
    const rightX = cx + gap / 2 - CHAR_W / 2;
    const y = groundY - 38 * CHAR_SCALE;
    const mySkin = profile.skin || 'runner';
    const otherSkin = mySkin === 'ember' ? 'cobalt' : 'ember';

    drawCharacter(ctx, leftX, y, {
      skinId: mySkin, facing: 1, onGround: true, vx: 260, vy: 0, time, scale: CHAR_SCALE,
    });
    drawCharacter(ctx, rightX, y, {
      skinId: otherSkin, facing: -1, onGround: true, vx: -260, vy: 0, time, scale: CHAR_SCALE,
    });
  }

  particles.draw(ctx);
}

/**
 * Play the intro inside `container` (the element holding both
 * [data-intro-canvas] and the [data-intro-letter] spans), then call
 * `onFinish` once it's done (or skipped). Safe to call at most once per
 * container -- there's nothing to replay mid-session, the caller only
 * ever invokes this at startup.
 */
export function play(container, onFinish) {
  const canvas = container.querySelector('[data-intro-canvas]');
  const letters = [...container.querySelectorAll('[data-intro-letter]')];
  const timers = [];
  let done = false;

  const schedule = (fn, ms) => timers.push(setTimeout(fn, ms));

  function finish() {
    if (done) return;
    done = true;
    for (const id of timers) clearTimeout(id);
    cancelAnimationFrame(raf);
    container.removeEventListener('click', finish);
    container.classList.add('is-leaving');
    setTimeout(() => {
      container.hidden = true;
      onFinish();
    }, 400);
  }

  container.addEventListener('click', finish);

  ctx = canvas.getContext('2d');
  particles = new Particles(60);
  time = 0;
  lastT = performance.now();
  progress = 0;
  collided = false;
  resize(canvas);

  function loop(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000 || 0);
    lastT = now;
    step(dt);
    draw();
    // Once the crash has happened and its particle burst has had a moment
    // to read, the canvas has nothing left to show -- stop redrawing it
    // rather than looping forever on an empty frame.
    if (!collided || time - collideAt < 0.6) raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  const runMs = RUN_TIME * 1000;
  schedule(() => letters[0].classList.add('is-in'), runMs + 100);   // "2" -- right at the crash
  schedule(() => letters[1].classList.add('is-in'), runMs + 550);   // "D" -- out of nowhere
  schedule(() => letters[2].classList.add('is-in'), runMs + 950);   // "T"
  schedule(() => letters[3].classList.add('is-in'), runMs + 1120);  // "A"
  schedule(() => letters[4].classList.add('is-in'), runMs + 1290);  // "G"
  schedule(finish, runMs + 2200);
}
