// Thirty more offline mini-games, added alongside the original fifteen in
// minigames.js. Same contract, same shared plumbing -- see
// minigames-core.js for CANVAS_W/CANVAS_H, the math helpers, and the five
// difficulty tiers every game here scales its own tuning arrays against
// via diffIdx(difficulty) (0=Very Easy .. 4=Super Hard).

import { CANVAS_W, CANVAS_H, rand, randInt, clamp, pick, diffIdx } from './minigames-core.js';

// -------------------------------------------------------- 16. Asteroid Dodge

function initAsteroid(mount, hooks, difficulty) {
  const i = diffIdx(difficulty);
  const SPEED = [70, 90, 110, 140, 180][i];
  const SPAWN_BASE = [1200, 1000, 850, 650, 480][i];
  const SPAWN_RAMP = [10, 14, 18, 24, 32][i];
  const SPAWN_MIN = [260, 220, 190, 150, 120][i];
  const SHIP_R = [12, 11, 10, 9, 8][i];

  const { ctx, canvas } = mount;
  const ship = { x: CANVAS_W / 2, y: CANVAS_H / 2, r: SHIP_R };
  let rocks = [];
  let survived = 0;
  let ended = false;
  let raf = 0;
  let lastT = performance.now();
  let nextSpawn = 0;
  const keys = { up: false, down: false, left: false, right: false };

  function spawnRock() {
    const edge = randInt(0, 3);
    let x; let y;
    if (edge === 0) { x = rand(0, CANVAS_W); y = -20; }
    else if (edge === 1) { x = rand(0, CANVAS_W); y = CANVAS_H + 20; }
    else if (edge === 2) { x = -20; y = rand(0, CANVAS_H); }
    else { x = CANVAS_W + 20; y = rand(0, CANVAS_H); }
    const angle = Math.atan2(CANVAS_H / 2 - y, CANVAS_W / 2 - x) + rand(-0.6, 0.6);
    const speed = SPEED * rand(0.75, 1.3);
    const r = rand(9, 19);
    rocks.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r });
  }

  function draw() {
    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#9aa4bd';
    for (const r of rocks) {
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#4ff08a';
    ctx.beginPath();
    ctx.arc(ship.x, ship.y, ship.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#eef4ff';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${survived.toFixed(1)}s`, 10, 26);
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    if (!ended) {
      survived += dt;
      const shipSpeed = 220;
      if (keys.up) ship.y -= shipSpeed * dt;
      if (keys.down) ship.y += shipSpeed * dt;
      if (keys.left) ship.x -= shipSpeed * dt;
      if (keys.right) ship.x += shipSpeed * dt;
      ship.x = clamp(ship.x, ship.r, CANVAS_W - ship.r);
      ship.y = clamp(ship.y, ship.r, CANVAS_H - ship.r);

      if (now >= nextSpawn) {
        spawnRock();
        nextSpawn = now + Math.max(SPAWN_MIN, SPAWN_BASE - survived * SPAWN_RAMP);
      }
      for (const r of rocks) { r.x += r.vx * dt; r.y += r.vy * dt; }
      rocks = rocks.filter((r) => r.x > -60 && r.x < CANVAS_W + 60 && r.y > -60 && r.y < CANVAS_H + 60);

      const hit = rocks.some((r) => Math.hypot(r.x - ship.x, r.y - ship.y) < r.r + ship.r);
      if (hit) {
        ended = true;
        hooks.onEnd(Math.round(survived * 10) / 10);
      }
    }
    draw();
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  function onKeyDown(e) {
    if (e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); keys.up = true; }
    if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); keys.down = true; }
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { e.preventDefault(); keys.left = true; }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') { e.preventDefault(); keys.right = true; }
  }
  function onKeyUp(e) {
    if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.up = false;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.down = false;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
  }
  function onPointerMove(e) {
    const rect = canvas.getBoundingClientRect();
    ship.x = clamp((e.clientX - rect.left) * (CANVAS_W / rect.width), ship.r, CANVAS_W - ship.r);
    ship.y = clamp((e.clientY - rect.top) * (CANVAS_H / rect.height), ship.r, CANVAS_H - ship.r);
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointermove', onPointerMove);
  hooks.setHud('Arrow keys, WASD, or mouse -- dodge the asteroids from every side.');

  return {
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('pointermove', onPointerMove);
    },
  };
}

// ------------------------------------------------------------- 17. Fruit Slice

function initFruitSlice(mount, hooks, difficulty) {
  const i = diffIdx(difficulty);
  const SPAWN_MS = [1000, 850, 700, 550, 420][i];
  const BOMB_CHANCE = [0.10, 0.15, 0.20, 0.28, 0.36][i];
  const LAUNCH_SPEED = [280, 300, 320, 350, 380][i];
  const TIME = 30;
  const GRAVITY = 500;
  const FRUITS = ['\u{1F34E}', '\u{1F34C}', '\u{1F349}', '\u{1F347}', '\u{1F34D}', '\u{1F353}'];

  const { ctx, canvas } = mount;
  let items = [];
  let score = 0;
  let timeLeft = TIME;
  let ended = false;
  let raf = 0;
  let lastT = performance.now();
  let nextSpawn = 0;

  function spawn() {
    const bomb = Math.random() < BOMB_CHANCE;
    items.push({
      x: rand(60, CANVAS_W - 60), y: CANVAS_H + 20,
      vx: rand(-40, 40), vy: -LAUNCH_SPEED * rand(0.9, 1.1),
      r: 20, bomb, icon: bomb ? '\u{1F4A3}' : pick(FRUITS), sliced: false,
    });
  }

  function draw() {
    ctx.fillStyle = '#122032';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.font = '32px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const it of items) ctx.fillText(it.icon, it.x, it.y);
    ctx.fillStyle = '#eef4ff';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Sliced: ${score}`, 10, 26);
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.ceil(timeLeft)}s`, CANVAS_W - 10, 26);
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    if (!ended) {
      timeLeft -= dt;
      if (now >= nextSpawn) { spawn(); nextSpawn = now + SPAWN_MS * rand(0.7, 1.3); }
      for (const it of items) { it.vy += GRAVITY * dt; it.x += it.vx * dt; it.y += it.vy * dt; }
      items = items.filter((it) => it.y < CANVAS_H + 40 && !it.sliced);
      if (timeLeft <= 0) { ended = true; hooks.onEnd(score); }
    }
    draw();
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  function onClick(e) {
    if (ended) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (CANVAS_W / rect.width);
    const y = (e.clientY - rect.top) * (CANVAS_H / rect.height);
    for (const it of items) {
      if (it.sliced) continue;
      if (Math.hypot(x - it.x, y - it.y) < it.r) {
        it.sliced = true;
        if (it.bomb) { ended = true; hooks.onEnd(score); }
        else score++;
        break;
      }
    }
  }
  canvas.addEventListener('click', onClick);
  hooks.setHud(`Click fruit to slice it, avoid the bombs -- ${TIME}s.`);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('click', onClick);
    },
  };
}

// ------------------------------------------------------------------ 18. Pong

function initPong(mount, hooks, difficulty) {
  const i = diffIdx(difficulty);
  const BALL_SPEED_START = [150, 180, 210, 250, 300][i];
  const SPEED_INC = [8, 10, 14, 18, 24][i];
  const PADDLE_H = [100, 85, 70, 55, 45][i];

  const { ctx, canvas } = mount;
  const paddle = { x: 16, w: 12, h: PADDLE_H, y: CANVAS_H / 2 - PADDLE_H / 2 };
  const ball = { x: CANVAS_W / 2, y: CANVAS_H / 2, r: 8, vx: -BALL_SPEED_START, vy: rand(-120, 120) };
  let hits = 0;
  let ended = false;
  let raf = 0;
  let lastT = performance.now();
  const keys = { up: false, down: false };

  function draw() {
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#4cc9f0';
    ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#eef4ff';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Hits: ${hits}`, 10, 26);
  }

  function loop(now) {
    const dt = Math.min(0.02, (now - lastT) / 1000);
    lastT = now;
    if (!ended) {
      if (keys.up) paddle.y -= 300 * dt;
      if (keys.down) paddle.y += 300 * dt;
      paddle.y = clamp(paddle.y, 0, CANVAS_H - paddle.h);

      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      if (ball.y < ball.r || ball.y > CANVAS_H - ball.r) ball.vy *= -1;
      if (ball.x > CANVAS_W - ball.r) ball.vx *= -1;
      if (ball.x < paddle.x + paddle.w + ball.r && ball.x > paddle.x
        && ball.y > paddle.y && ball.y < paddle.y + paddle.h && ball.vx < 0) {
        hits++;
        const speed = Math.hypot(ball.vx, ball.vy) + SPEED_INC;
        const hitPos = (ball.y - (paddle.y + paddle.h / 2)) / (paddle.h / 2);
        const angle = hitPos * 0.9;
        ball.vx = Math.cos(angle) * speed;
        ball.vy = Math.sin(angle) * speed;
        ball.x = paddle.x + paddle.w + ball.r + 1;
      }
      if (ball.x < -20) { ended = true; hooks.onEnd(hits); }
    }
    draw();
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  function onKeyDown(e) {
    if (e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); keys.up = true; }
    if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); keys.down = true; }
  }
  function onKeyUp(e) {
    if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.up = false;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.down = false;
  }
  function onPointerMove(e) {
    const rect = canvas.getBoundingClientRect();
    const y = (e.clientY - rect.top) * (CANVAS_H / rect.height);
    paddle.y = clamp(y - paddle.h / 2, 0, CANVAS_H - paddle.h);
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointermove', onPointerMove);
  hooks.setHud('Arrow keys, WASD or mouse -- keep the rally alive.');

  return {
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('pointermove', onPointerMove);
    },
  };
}

// ---------------------------------------------------------- 19. Space Invaders

function initInvaders(mount, hooks, difficulty) {
  const i = diffIdx(difficulty);
  const ROWS = [3, 3, 4, 4, 5][i];
  const COLS = [6, 7, 7, 8, 8][i];
  const ALIEN_SPEED = [40, 55, 70, 90, 110][i];
  const FIRE_INTERVAL = [1800, 1400, 1100, 800, 600][i];
  const PLAYER_COOLDOWN = [350, 300, 260, 220, 180][i];

  const { ctx, canvas } = mount;
  const cellW = Math.min(50, (CANVAS_W - 20) / COLS);
  const player = { x: CANVAS_W / 2, w: 26, h: 12, y: CANVAS_H - 20 };
  let aliens = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      aliens.push({ x: 20 + c * cellW, y: 30 + r * 26, alive: true });
    }
  }
  let alienDir = 1;
  let alienVy = 0;
  let bullets = [];
  let alienBullets = [];
  let destroyed = 0;
  let ended = false;
  let raf = 0;
  let lastT = performance.now();
  let lastShot = 0;
  let nextAlienFire = performance.now() + FIRE_INTERVAL;
  const keys = { left: false, right: false, fire: false };

  function draw() {
    ctx.fillStyle = '#050a14';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#4ff08a';
    for (const a of aliens) { if (a.alive) ctx.fillRect(a.x, a.y, cellW - 8, 16); }
    ctx.fillStyle = '#4cc9f0';
    ctx.fillRect(player.x - player.w / 2, player.y, player.w, player.h);
    ctx.fillStyle = '#ffd166';
    for (const b of bullets) ctx.fillRect(b.x - 2, b.y, 4, 10);
    ctx.fillStyle = '#ff4d6d';
    for (const b of alienBullets) ctx.fillRect(b.x - 2, b.y, 4, 10);
    ctx.fillStyle = '#eef4ff';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Aliens: ${destroyed}/${aliens.length}`, 10, 20);
  }

  function loop(now) {
    const dt = Math.min(0.03, (now - lastT) / 1000);
    lastT = now;
    if (!ended) {
      if (keys.left) player.x -= 260 * dt;
      if (keys.right) player.x += 260 * dt;
      player.x = clamp(player.x, player.w / 2, CANVAS_W - player.w / 2);
      if (keys.fire && now - lastShot > PLAYER_COOLDOWN) {
        bullets.push({ x: player.x, y: player.y });
        lastShot = now;
      }

      const alive = aliens.filter((a) => a.alive);
      let hitEdge = false;
      for (const a of alive) {
        a.x += alienDir * ALIEN_SPEED * dt;
        if (a.x < 6 || a.x > CANVAS_W - cellW + 2) hitEdge = true;
      }
      if (hitEdge) {
        alienDir *= -1;
        for (const a of alive) a.y += 12;
      }
      if (alive.some((a) => a.y + 16 >= player.y)) { ended = true; hooks.onEnd(destroyed); }

      if (now >= nextAlienFire && alive.length) {
        const shooter = pick(alive);
        alienBullets.push({ x: shooter.x + cellW / 2, y: shooter.y + 16 });
        nextAlienFire = now + FIRE_INTERVAL * rand(0.6, 1.4);
      }

      for (const b of bullets) b.y -= 300 * dt;
      for (const b of alienBullets) b.y += 220 * dt;
      bullets = bullets.filter((b) => b.y > -10);
      alienBullets = alienBullets.filter((b) => b.y < CANVAS_H + 10);

      for (const b of bullets) {
        for (const a of aliens) {
          if (a.alive && b.x > a.x && b.x < a.x + cellW - 8 && b.y > a.y && b.y < a.y + 16) {
            a.alive = false;
            destroyed++;
            b.hit = true;
          }
        }
      }
      bullets = bullets.filter((b) => !b.hit);

      for (const b of alienBullets) {
        if (Math.abs(b.x - player.x) < player.w / 2 && b.y > player.y && b.y < player.y + player.h) {
          ended = true; hooks.onEnd(destroyed);
        }
      }
      if (destroyed === aliens.length) { ended = true; hooks.onEnd(destroyed); }
    }
    draw();
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  function onKeyDown(e) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { e.preventDefault(); keys.left = true; }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') { e.preventDefault(); keys.right = true; }
    if (e.code === 'Space') { e.preventDefault(); keys.fire = true; }
  }
  function onKeyUp(e) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
    if (e.code === 'Space') keys.fire = false;
  }
  function onPointerDown() { keys.fire = true; }
  function onPointerUp() { keys.fire = false; }
  function onPointerMove(e) {
    const rect = canvas.getBoundingClientRect();
    player.x = clamp((e.clientX - rect.left) * (CANVAS_W / rect.width), player.w / 2, CANVAS_W - player.w / 2);
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  hooks.setHud('Arrows/mouse to move, Space or hold click to fire. Clear the invaders.');

  return {
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
    },
  };
}

// ------------------------------------------------------------- 20. Endless Runner

function initRunner(mount, hooks, difficulty) {
  const i = diffIdx(difficulty);
  const BASE_SPEED = [180, 210, 240, 280, 330][i];
  const SPEED_RAMP = [3, 5, 7, 10, 14][i];
  const BASE_SPAWN = [1100, 950, 800, 650, 500][i];
  const SPAWN_RAMP = [8, 10, 13, 16, 20][i];
  const MIN_SPAWN = [380, 340, 300, 260, 220][i];
  const GRAVITY = 1400;
  const JUMP_V = -420;
  const GROUND_Y = CANVAS_H - 40;

  const { ctx, canvas } = mount;
  const player = { x: 60, y: GROUND_Y, w: 22, h: 30, vy: 0, onGround: true };
  let obstacles = [];
  let cleared = 0;
  let elapsed = 0;
  let ended = false;
  let raf = 0;
  let lastT = performance.now();
  let nextSpawn = 0;

  function jump() {
    if (ended) return;
    if (player.onGround) { player.vy = JUMP_V; player.onGround = false; }
  }

  function draw() {
    ctx.fillStyle = '#101a2c';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.strokeStyle = '#2a3a56';
    ctx.beginPath(); ctx.moveTo(0, GROUND_Y + player.h); ctx.lineTo(CANVAS_W, GROUND_Y + player.h); ctx.stroke();
    ctx.fillStyle = '#ff4d6d';
    for (const o of obstacles) ctx.fillRect(o.x, GROUND_Y + player.h - o.h, o.w, o.h);
    ctx.fillStyle = '#4ff08a';
    ctx.fillRect(player.x, player.y, player.w, player.h);
    ctx.fillStyle = '#eef4ff';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Cleared: ${cleared}`, 10, 26);
  }

  function loop(now) {
    const dt = Math.min(0.03, (now - lastT) / 1000);
    lastT = now;
    if (!ended) {
      elapsed += dt;
      const speed = BASE_SPEED + elapsed * SPEED_RAMP;
      player.vy += GRAVITY * dt;
      player.y += player.vy * dt;
      if (player.y >= GROUND_Y) { player.y = GROUND_Y; player.vy = 0; player.onGround = true; }

      if (now >= nextSpawn) {
        obstacles.push({ x: CANVAS_W + 10, w: rand(16, 26), h: rand(24, 42), passed: false });
        nextSpawn = now + Math.max(MIN_SPAWN, BASE_SPAWN - elapsed * SPAWN_RAMP);
      }
      for (const o of obstacles) {
        o.x -= speed * dt;
        if (!o.passed && o.x + o.w < player.x) { o.passed = true; cleared++; }
      }
      obstacles = obstacles.filter((o) => o.x + o.w > -10);

      const hit = obstacles.some((o) => player.x < o.x + o.w && player.x + player.w > o.x
        && player.y + player.h > GROUND_Y + player.h - o.h);
      if (hit) { ended = true; hooks.onEnd(cleared); }
    }
    draw();
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  function onKey(e) { if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); jump(); } }
  window.addEventListener('keydown', onKey);
  canvas.addEventListener('pointerdown', jump);
  hooks.setHud('Space, tap, or click to jump over the obstacles.');

  return {
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      canvas.removeEventListener('pointerdown', jump);
    },
  };
}

// ------------------------------------------------------------- 21. Maze Escape

function initMaze(mount, hooks, difficulty) {
  const i = diffIdx(difficulty);
  const W = [6, 8, 10, 13, 16][i];
  const H = [4, 5, 7, 9, 11][i];
  const TIME = [60, 50, 45, 40, 35][i];

  const { ctx } = mount;
  const cellSize = Math.floor(Math.min(CANVAS_W / W, CANVAS_H / H));
  const offX = (CANVAS_W - cellSize * W) / 2;
  const offY = (CANVAS_H - cellSize * H) / 2;

  function genMaze() {
    const cells = Array.from({ length: H }, () => Array.from({ length: W },
      () => ({ N: true, S: true, E: true, W: true, visited: false })));
    const stack = [[0, 0]];
    cells[0][0].visited = true;
    while (stack.length) {
      const [cx, cy] = stack[stack.length - 1];
      const options = [];
      if (cy > 0 && !cells[cy - 1][cx].visited) options.push(['N', cx, cy - 1]);
      if (cy < H - 1 && !cells[cy + 1][cx].visited) options.push(['S', cx, cy + 1]);
      if (cx > 0 && !cells[cy][cx - 1].visited) options.push(['W', cx - 1, cy]);
      if (cx < W - 1 && !cells[cy][cx + 1].visited) options.push(['E', cx + 1, cy]);
      if (!options.length) { stack.pop(); continue; }
      const [dir, nx, ny] = pick(options);
      const opp = { N: 'S', S: 'N', E: 'W', W: 'E' }[dir];
      cells[cy][cx][dir] = false;
      cells[ny][nx][opp] = false;
      cells[ny][nx].visited = true;
      stack.push([nx, ny]);
    }
    return cells;
  }

  const maze = genMaze();
  const player = { cx: 0, cy: 0 };
  let timeLeft = TIME;
  let ended = false;
  let interval = null;

  function draw() {
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.strokeStyle = '#4d7fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        const x = offX + c * cellSize; const y = offY + r * cellSize;
        const cell = maze[r][c];
        if (cell.N) { ctx.moveTo(x, y); ctx.lineTo(x + cellSize, y); }
        if (cell.W) { ctx.moveTo(x, y); ctx.lineTo(x, y + cellSize); }
        if (r === H - 1 && cell.S) { ctx.moveTo(x, y + cellSize); ctx.lineTo(x + cellSize, y + cellSize); }
        if (c === W - 1 && cell.E) { ctx.moveTo(x + cellSize, y); ctx.lineTo(x + cellSize, y + cellSize); }
      }
    }
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(offX + (W - 1) * cellSize + cellSize * 0.2, offY + (H - 1) * cellSize + cellSize * 0.2, cellSize * 0.6, cellSize * 0.6);
    ctx.fillStyle = '#4ff08a';
    ctx.beginPath();
    ctx.arc(offX + player.cx * cellSize + cellSize / 2, offY + player.cy * cellSize + cellSize / 2, cellSize * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#eef4ff';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.ceil(timeLeft)}s`, CANVAS_W - 8, 20);
  }

  function tryMove(dir) {
    if (ended) return;
    const cell = maze[player.cy][player.cx];
    if (dir === 'N' && !cell.N) player.cy--;
    else if (dir === 'S' && !cell.S) player.cy++;
    else if (dir === 'W' && !cell.W) player.cx--;
    else if (dir === 'E' && !cell.E) player.cx++;
    draw();
    if (player.cx === W - 1 && player.cy === H - 1) {
      ended = true;
      clearInterval(interval);
      hooks.onEnd(Math.max(1, Math.round(timeLeft)));
    }
  }

  function onKey(e) {
    const map = { ArrowUp: 'N', ArrowDown: 'S', ArrowLeft: 'W', ArrowRight: 'E', KeyW: 'N', KeyS: 'S', KeyA: 'W', KeyD: 'E' };
    if (map[e.code]) { e.preventDefault(); tryMove(map[e.code]); }
  }
  window.addEventListener('keydown', onKey);

  draw();
  hooks.setHud(`Arrow keys / WASD -- reach the gold square before time runs out.`);
  interval = setInterval(() => {
    timeLeft -= 1;
    if (timeLeft <= 0 && !ended) { ended = true; clearInterval(interval); hooks.onEnd(0); }
    draw();
  }, 1000);

  return { destroy() { clearInterval(interval); window.removeEventListener('keydown', onKey); } };
}

// ------------------------------------------------------------ 22. Bubble Shooter

function initBubbles(mount, hooks, difficulty) {
  const i = diffIdx(difficulty);
  const COLOR_COUNT = [3, 4, 4, 5, 6][i];
  const COLS = [5, 6, 6, 7, 8][i];
  const START_ROWS = [3, 4, 5, 6, 7][i];
  const DROP_MS = [9000, 7000, 5500, 4000, 3000][i];
  const MAX_ROWS = 10;
  const PALETTE = ['#ff4d6d', '#4d7fff', '#4ff08a', '#ffd166', '#a06bff', '#ff8c3a'].slice(0, COLOR_COUNT);

  const { ctx, canvas } = mount;
  const cellW = CANVAS_W / COLS;
  const rowH = 22;
  const floorY = CANVAS_H - 8;
  let columns = Array.from({ length: COLS }, () => []);
  for (let r = 0; r < START_ROWS; r++) for (let c = 0; c < COLS; c++) columns[c].push(pick(PALETTE));
  let nextColor = pick(PALETTE);
  let score = 0;
  let ended = false;
  let dropTimer = null;

  function neighbors(c, r) {
    const out = [[c - 1, r], [c + 1, r]];
    if (r > 0) out.push([c, r - 1]);
    out.push([c, r + 1]);
    return out;
  }

  function popFrom(c, r) {
    const color = columns[c][r];
    if (!color) return;
    const seen = new Set([`${c},${r}`]);
    const stack = [[c, r]];
    while (stack.length) {
      const [cc, cr] = stack.pop();
      for (const [nc, nr] of neighbors(cc, cr)) {
        const key = `${nc},${nr}`;
        if (nc < 0 || nc >= COLS || nr < 0 || seen.has(key)) continue;
        if (columns[nc][nr] === color) { seen.add(key); stack.push([nc, nr]); }
      }
    }
    if (seen.size >= 3) {
      for (const key of seen) {
        const [cc, cr] = key.split(',').map(Number);
        columns[cc][cr] = null;
      }
      for (let cc = 0; cc < COLS; cc++) columns[cc] = columns[cc].filter((v) => v != null);
      score += seen.size;
    }
  }

  function checkOverflow() {
    if (columns.some((col) => col.length >= MAX_ROWS)) {
      ended = true;
      clearInterval(dropTimer);
      hooks.onEnd(score);
    }
  }

  function draw() {
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < columns[c].length; r++) {
        ctx.fillStyle = columns[c][r];
        ctx.beginPath();
        ctx.arc(c * cellW + cellW / 2, floorY - r * rowH - rowH / 2, rowH / 2 - 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = '#eef4ff';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Popped: ${score}`, 10, 20);
    ctx.textAlign = 'right';
    ctx.fillText('Next:', CANVAS_W - 34, 20);
    ctx.fillStyle = nextColor;
    ctx.beginPath();
    ctx.arc(CANVAS_W - 14, 16, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  function onClick(e) {
    if (ended) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (CANVAS_W / rect.width);
    const c = clamp(Math.floor(x / cellW), 0, COLS - 1);
    if (columns[c].length >= MAX_ROWS) return;
    const landedRow = columns[c].length;
    columns[c].push(nextColor);
    popFrom(c, landedRow);
    nextColor = pick(PALETTE);
    draw();
    checkOverflow();
  }
  canvas.addEventListener('click', onClick);

  dropTimer = setInterval(() => {
    if (ended) return;
    for (let c = 0; c < COLS; c++) columns[c].push(pick(PALETTE));
    draw();
    checkOverflow();
  }, DROP_MS);

  draw();
  hooks.setHud('Click a column to fire -- match 3+ same colors to pop them.');

  return { destroy() { clearInterval(dropTimer); canvas.removeEventListener('click', onClick); } };
}

// -------------------------------------------------------------- 23. Tower Stack

function initTowerStack(mount, hooks, difficulty) {
  const i = diffIdx(difficulty);
  const BLOCK_SPEED = [90, 120, 150, 190, 240][i];
  const rowH = 22;
  const visibleRows = Math.floor(CANVAS_H / rowH) - 1;

  const { ctx, canvas } = mount;
  let stack = [{ x: 0, w: CANVAS_W }];
  let current = { x: 0, w: CANVAS_W, dir: 1 };
  let ended = false;
  let raf = 0;
  let lastT = performance.now();

  function spawnNext() {
    const w = current.w;
    const fromLeft = Math.random() < 0.5;
    current = { x: fromLeft ? -w : CANVAS_W, w, dir: fromLeft ? 1 : -1 };
  }

  function draw() {
    ctx.fillStyle = '#0d1a2b';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    const baseIdx = Math.max(0, stack.length - visibleRows);
    const rows = stack.slice(baseIdx);
    rows.forEach((row, idx) => {
      const y = CANVAS_H - (idx + 1) * rowH;
      ctx.fillStyle = idx % 2 === 0 ? '#4d7fff' : '#4cc9f0';
      ctx.fillRect(row.x, y, row.w, rowH - 2);
    });
    const curY = CANVAS_H - (rows.length + 1) * rowH;
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(current.x, curY, current.w, rowH - 2);
    ctx.fillStyle = '#eef4ff';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Height: ${stack.length - 1}`, 10, 22);
  }

  function loop(now) {
    const dt = Math.min(0.03, (now - lastT) / 1000);
    lastT = now;
    if (!ended) {
      const speed = BLOCK_SPEED * (1 + stack.length * 0.025);
      current.x += current.dir * speed * dt;
      if (current.x <= -current.w || current.x >= CANVAS_W) current.dir *= -1;
    }
    draw();
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  function drop() {
    if (ended) return;
    const below = stack[stack.length - 1];
    const overlapStart = Math.max(current.x, below.x);
    const overlapEnd = Math.min(current.x + current.w, below.x + below.w);
    const overlapW = overlapEnd - overlapStart;
    if (overlapW <= 3) {
      ended = true;
      hooks.onEnd(stack.length - 1);
      return;
    }
    stack.push({ x: overlapStart, w: overlapW });
    spawnNext();
  }

  function onKey(e) { if (e.code === 'Space') { e.preventDefault(); drop(); } }
  window.addEventListener('keydown', onKey);
  canvas.addEventListener('pointerdown', drop);
  hooks.setHud('Space, tap, or click to drop the block -- line it up with the tower.');

  return {
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      canvas.removeEventListener('pointerdown', drop);
    },
  };
}

// -------------------------------------------------------------- 24. Balloon Pop

function initBalloons(mount, hooks, difficulty) {
  const i = diffIdx(difficulty);
  const RISE_SPEED = [60, 80, 100, 130, 170][i];
  const SPAWN_MS = [900, 750, 620, 480, 360][i];
  const BOMB_CHANCE = [0.08, 0.13, 0.18, 0.25, 0.32][i];
  const MISS_LIMIT = [8, 6, 5, 4, 3][i];

  const { ctx, canvas } = mount;
  let balloons = [];
  let score = 0;
  let misses = 0;
  let ended = false;
  let raf = 0;
  let lastT = performance.now();
  let nextSpawn = 0;

  function spawn() {
    const bomb = Math.random() < BOMB_CHANCE;
    balloons.push({
      x: rand(30, CANVAS_W - 30), y: CANVAS_H + 20, r: 18,
      sway: rand(-30, 30), phase: rand(0, Math.PI * 2), bomb,
      color: bomb ? '#222' : pick(['#ff4d6d', '#4d7fff', '#4ff08a', '#ffd166', '#a06bff']),
    });
  }

  function draw() {
    ctx.fillStyle = '#122032';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    for (const b of balloons) {
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, b.r * 0.8, b.r, 0, 0, Math.PI * 2);
      ctx.fill();
      if (b.bomb) {
        ctx.fillStyle = '#ff4d6d';
        ctx.font = 'bold 14px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('!', b.x, b.y + 5);
      }
    }
    ctx.fillStyle = '#eef4ff';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Popped: ${score}`, 10, 22);
    ctx.textAlign = 'right';
    ctx.fillText(`Misses: ${misses}/${MISS_LIMIT}`, CANVAS_W - 10, 22);
  }

  function loop(now) {
    const dt = Math.min(0.04, (now - lastT) / 1000);
    lastT = now;
    if (!ended) {
      if (now >= nextSpawn) { spawn(); nextSpawn = now + SPAWN_MS * rand(0.75, 1.25); }
      for (const b of balloons) {
        b.y -= RISE_SPEED * dt;
        b.x += Math.sin(now / 400 + b.phase) * b.sway * dt;
      }
      const escaped = balloons.filter((b) => b.y < -30);
      if (escaped.some((b) => !b.bomb)) misses += escaped.filter((b) => !b.bomb).length;
      balloons = balloons.filter((b) => b.y >= -30);
      if (misses >= MISS_LIMIT) { ended = true; hooks.onEnd(score); }
    }
    draw();
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  function onClick(e) {
    if (ended) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (CANVAS_W / rect.width);
    const y = (e.clientY - rect.top) * (CANVAS_H / rect.height);
    for (const b of balloons) {
      if (Math.hypot(x - b.x, y - b.y) < b.r) {
        if (b.bomb) { ended = true; hooks.onEnd(score); return; }
        score++;
        balloons = balloons.filter((o) => o !== b);
        break;
      }
    }
  }
  canvas.addEventListener('click', onClick);
  hooks.setHud(`Pop the balloons, avoid the bombs -- ${MISS_LIMIT} misses allowed.`);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('click', onClick);
    },
  };
}

// --------------------------------------------------------------- 25. Laser Dodge

function initLaser(mount, hooks, difficulty) {
  const i = diffIdx(difficulty);
  const TELEGRAPH_MS = [900, 750, 600, 450, 320][i];
  const FIRE_MS = [500, 450, 400, 350, 300][i];
  const SPAWN_MS = [1400, 1150, 950, 750, 600][i];
  const MAX_BEAMS = [1, 1, 2, 2, 3][i];
  const THICK = 26;

  const { ctx, canvas } = mount;
  const player = { x: CANVAS_W / 2, y: CANVAS_H / 2, r: 10 };
  let beams = [];
  let survived = 0;
  let ended = false;
  let raf = 0;
  let lastT = performance.now();
  let nextSpawn = 0;
  const keys = { up: false, down: false, left: false, right: false };

  function spawnBeam() {
    if (beams.length >= MAX_BEAMS) return;
    const axis = Math.random() < 0.5 ? 'h' : 'v';
    const pos = axis === 'h' ? rand(30, CANVAS_H - 30) : rand(30, CANVAS_W - 30);
    beams.push({ axis, pos, state: 'telegraph', t: 0 });
  }

  function draw() {
    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    for (const b of beams) {
      const firing = b.state === 'fire';
      ctx.fillStyle = firing ? 'rgba(255,77,109,0.85)' : 'rgba(255,77,109,0.25)';
      if (b.axis === 'h') ctx.fillRect(0, b.pos - THICK / 2, CANVAS_W, THICK);
      else ctx.fillRect(b.pos - THICK / 2, 0, THICK, CANVAS_H);
    }
    ctx.fillStyle = '#4ff08a';
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#eef4ff';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${survived.toFixed(1)}s`, 10, 26);
  }

  function loop(now) {
    const dt = Math.min(0.04, (now - lastT) / 1000);
    lastT = now;
    if (!ended) {
      survived += dt;
      const speed = 220;
      if (keys.up) player.y -= speed * dt;
      if (keys.down) player.y += speed * dt;
      if (keys.left) player.x -= speed * dt;
      if (keys.right) player.x += speed * dt;
      player.x = clamp(player.x, player.r, CANVAS_W - player.r);
      player.y = clamp(player.y, player.r, CANVAS_H - player.r);

      if (now >= nextSpawn) { spawnBeam(); nextSpawn = now + SPAWN_MS * rand(0.7, 1.3); }
      for (const b of beams) {
        b.t += dt * 1000;
        if (b.state === 'telegraph' && b.t >= TELEGRAPH_MS) { b.state = 'fire'; b.t = 0; }
        else if (b.state === 'fire' && b.t >= FIRE_MS) { b.done = true; }
      }
      beams = beams.filter((b) => !b.done);

      const hit = beams.some((b) => {
        if (b.state !== 'fire') return false;
        if (b.axis === 'h') return Math.abs(player.y - b.pos) < THICK / 2 + player.r;
        return Math.abs(player.x - b.pos) < THICK / 2 + player.r;
      });
      if (hit) { ended = true; hooks.onEnd(Math.round(survived * 10) / 10); }
    }
    draw();
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  function onKeyDown(e) {
    if (e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); keys.up = true; }
    if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); keys.down = true; }
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { e.preventDefault(); keys.left = true; }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') { e.preventDefault(); keys.right = true; }
  }
  function onKeyUp(e) {
    if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.up = false;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.down = false;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
  }
  function onPointerMove(e) {
    const rect = canvas.getBoundingClientRect();
    player.x = clamp((e.clientX - rect.left) * (CANVAS_W / rect.width), player.r, CANVAS_W - player.r);
    player.y = clamp((e.clientY - rect.top) * (CANVAS_H / rect.height), player.r, CANVAS_H - player.r);
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointermove', onPointerMove);
  hooks.setHud('Dodge the lasers -- solid means live, faint means telegraphed.');

  return {
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('pointermove', onPointerMove);
    },
  };
}

// -------------------------------------------------------------- 26. Slalom Ski

function initSki(mount, hooks, difficulty) {
  const i = diffIdx(difficulty);
  const SPEED = [110, 140, 170, 210, 260][i];
  const GAP_W = [150, 120, 95, 75, 60][i];
  const SPAWN_GAP_MS = [1600, 1400, 1200, 1000, 850][i];

  const { ctx, canvas } = mount;
  const skierY = CANVAS_H - 40;
  const player = { x: CANVAS_W / 2, r: 12 };
  let gates = [];
  let passed = 0;
  let ended = false;
  let raf = 0;
  let lastT = performance.now();
  let nextSpawn = 0;
  const keys = { left: false, right: false };

  function spawnGate() {
    const gapX = rand(30, CANVAS_W - GAP_W - 30);
    gates.push({ y: -20, gapX, resolved: false });
  }

  function draw() {
    ctx.fillStyle = '#e8f4ff';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#ff4d6d';
    for (const g of gates) {
      ctx.fillRect(0, g.y - 4, g.gapX, 8);
      ctx.fillRect(g.gapX + GAP_W, g.y - 4, CANVAS_W - (g.gapX + GAP_W), 8);
    }
    ctx.fillStyle = '#1a4dff';
    ctx.beginPath();
    ctx.arc(player.x, skierY, player.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0b1220';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Gates: ${passed}`, 10, 26);
  }

  function loop(now) {
    const dt = Math.min(0.04, (now - lastT) / 1000);
    lastT = now;
    if (!ended) {
      const speed = SPEED * (1 + passed * 0.02);
      if (keys.left) player.x -= 260 * dt;
      if (keys.right) player.x += 260 * dt;
      player.x = clamp(player.x, player.r, CANVAS_W - player.r);

      if (now >= nextSpawn) { spawnGate(); nextSpawn = now + SPAWN_GAP_MS; }
      for (const g of gates) g.y += speed * dt;
      for (const g of gates) {
        if (!g.resolved && g.y >= skierY) {
          g.resolved = true;
          if (player.x - player.r < g.gapX || player.x + player.r > g.gapX + GAP_W) {
            ended = true;
            hooks.onEnd(passed);
          } else {
            passed++;
          }
        }
      }
      gates = gates.filter((g) => g.y < CANVAS_H + 20);
    }
    draw();
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  function onKeyDown(e) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { e.preventDefault(); keys.left = true; }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') { e.preventDefault(); keys.right = true; }
  }
  function onKeyUp(e) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
  }
  function onPointerMove(e) {
    const rect = canvas.getBoundingClientRect();
    player.x = clamp((e.clientX - rect.left) * (CANVAS_W / rect.width), player.r, CANVAS_W - player.r);
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointermove', onPointerMove);
  hooks.setHud('Arrow keys or mouse -- steer through each gate.');

  return {
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('pointermove', onPointerMove);
    },
  };
}

// --------------------------------------------------------- 27. Basketball Shots

function initBasketball(mount, hooks, difficulty) {
  const i = diffIdx(difficulty);
  const TIME = [35, 30, 25, 22, 18][i];
  const RIM_W = [70, 60, 52, 44, 38][i];
  const HOOP_AMP = [0, 0, 40, 70, 100][i];
  const GRAVITY = 700;

  const { ctx, canvas } = mount;
  const hoopY = 55;
  const hoop = { x: CANVAS_W / 2, w: RIM_W };
  const ball = { x: CANVAS_W / 2, y: CANVAS_H - 30, vx: 0, vy: 0, r: 12, moving: false, lastY: CANVAS_H - 30 };
  let dragStart = null;
  let score = 0;
  let timeLeft = TIME;
  let ended = false;
  let raf = 0;
  let lastT = performance.now();
  let elapsed = 0;

  function resetBall() {
    ball.x = CANVAS_W / 2; ball.y = CANVAS_H - 30; ball.vx = 0; ball.vy = 0; ball.moving = false; ball.lastY = ball.y;
  }

  function draw() {
    ctx.fillStyle = '#3a2313';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(hoop.x - hoop.w / 2, hoopY);
    ctx.lineTo(hoop.x + hoop.w / 2, hoopY);
    ctx.stroke();
    ctx.fillStyle = '#eee';
    ctx.fillRect(hoop.x - 3, hoopY - 24, 6, 24);
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    if (dragStart) {
      ctx.strokeStyle = '#4ff08a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(ball.x, ball.y);
      ctx.lineTo(dragStart.curX, dragStart.curY);
      ctx.stroke();
    }
    ctx.fillStyle = '#eef4ff';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${score}`, 10, 20);
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.ceil(timeLeft)}s`, CANVAS_W - 10, 20);
  }

  function loop(now) {
    const dt = Math.min(0.03, (now - lastT) / 1000);
    lastT = now;
    if (!ended) {
      elapsed += dt;
      timeLeft -= dt;
      if (HOOP_AMP > 0) hoop.x = CANVAS_W / 2 + Math.sin(elapsed * 1.3) * HOOP_AMP;
      if (ball.moving) {
        ball.lastY = ball.y;
        ball.vy += GRAVITY * dt;
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        if (ball.lastY < hoopY && ball.y >= hoopY && ball.vy > 0 && Math.abs(ball.x - hoop.x) < hoop.w / 2 - 6) {
          score++;
          resetBall();
        } else if (ball.y > CANVAS_H + 30 || ball.x < -30 || ball.x > CANVAS_W + 30) {
          resetBall();
        }
      }
      if (timeLeft <= 0) { ended = true; hooks.onEnd(score); }
    }
    draw();
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  function toCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (CANVAS_W / rect.width),
      y: (e.clientY - rect.top) * (CANVAS_H / rect.height),
    };
  }
  function onPointerDown(e) {
    if (ball.moving || ended) return;
    const p = toCanvasCoords(e);
    dragStart = { x: p.x, y: p.y, curX: p.x, curY: p.y };
  }
  function onPointerMoveCanvas(e) {
    if (!dragStart) return;
    const p = toCanvasCoords(e);
    dragStart.curX = p.x; dragStart.curY = p.y;
  }
  function onPointerUp(e) {
    if (!dragStart) return;
    const p = toCanvasCoords(e);
    const dx = ball.x - p.x; const dy = ball.y - p.y;
    ball.vx = dx * 3.2;
    ball.vy = dy * 3.2;
    ball.moving = true;
    dragStart = null;
  }
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMoveCanvas);
  window.addEventListener('pointerup', onPointerUp);
  hooks.setHud('Drag back from the ball and release to shoot -- sink as many as you can.');

  return {
    destroy() {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMoveCanvas);
      window.removeEventListener('pointerup', onPointerUp);
    },
  };
}

// ---------------------------------------------------------------- 28. Piano Tiles

function initPianoTiles(mount, hooks, difficulty) {
  const i = diffIdx(difficulty);
  const TILE_SPEED = [220, 260, 300, 360, 430][i];
  const SPAWN_MS = [750, 620, 520, 420, 340][i];
  const LANES = 4;

  const { ctx, canvas } = mount;
  const laneW = CANVAS_W / LANES;
  const zoneY = CANVAS_H - 50;
  const tileH = 60;
  let tiles = [];
  let score = 0;
  let ended = false;
  let raf = 0;
  let lastT = performance.now();
  let nextSpawn = 0;

  function draw() {
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.strokeStyle = '#333';
    for (let l = 1; l < LANES; l++) {
      ctx.beginPath(); ctx.moveTo(l * laneW, 0); ctx.lineTo(l * laneW, CANVAS_H); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(79,240,138,0.25)';
    ctx.fillRect(0, zoneY, CANVAS_W, CANVAS_H - zoneY);
    ctx.fillStyle = '#4d7fff';
    for (const t of tiles) ctx.fillRect(t.lane * laneW + 4, t.y, laneW - 8, tileH);
    ctx.fillStyle = '#eef4ff';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${score}`, 10, 26);
  }

  function loop(now) {
    const dt = Math.min(0.03, (now - lastT) / 1000);
    lastT = now;
    if (!ended) {
      if (now >= nextSpawn) {
        tiles.push({ lane: randInt(0, LANES - 1), y: -tileH, hit: false });
        nextSpawn = now + SPAWN_MS;
      }
      for (const t of tiles) t.y += TILE_SPEED * dt;
      const missed = tiles.some((t) => !t.hit && t.y > CANVAS_H);
      tiles = tiles.filter((t) => t.y <= CANVAS_H);
      if (missed) { ended = true; hooks.onEnd(score); }
    }
    draw();
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  function tapLane(lane) {
    if (ended) return;
    const target = tiles.find((t) => t.lane === lane && !t.hit && t.y + tileH > zoneY && t.y < CANVAS_H);
    if (target) {
      target.hit = true;
      tiles = tiles.filter((t) => t !== target);
      score++;
    }
  }

  function onClick(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (CANVAS_W / rect.width);
    tapLane(clamp(Math.floor(x / laneW), 0, LANES - 1));
  }
  function onKey(e) {
    const map = { KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3 };
    if (map[e.code] != null) { e.preventDefault(); tapLane(map[e.code]); }
  }
  canvas.addEventListener('click', onClick);
  window.addEventListener('keydown', onKey);
  hooks.setHud('Click a lane (or D F J K) the instant a tile crosses the green zone.');

  return {
    destroy() {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onKey);
    },
  };
}

// ------------------------------------------------------------- 29. Target Practice

function initTargets(mount, hooks, difficulty) {
  const i = diffIdx(difficulty);
  const RADIUS = [30, 26, 22, 18, 15][i];
  const VISIBLE_MS = [1300, 1050, 850, 650, 500][i];
  const SPAWN_MS = [700, 600, 500, 400, 300][i];
  const TIME = [25, 22, 20, 18, 15][i];

  const { ctx, canvas } = mount;
  let target = null;
  let score = 0;
  let timeLeft = TIME;
  let ended = false;
  let raf = 0;
  let lastT = performance.now();
  let nextSpawn = 0;

  function spawn() {
    target = {
      x: rand(RADIUS + 10, CANVAS_W - RADIUS - 10),
      y: rand(RADIUS + 40, CANVAS_H - RADIUS - 10),
      r: RADIUS, expiresAt: performance.now() + VISIBLE_MS,
    };
  }

  function draw() {
    ctx.fillStyle = '#132436';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    if (target) {
      ctx.fillStyle = '#ff4d6d';
      ctx.beginPath(); ctx.arc(target.x, target.y, target.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(target.x, target.y, target.r * 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff4d6d';
      ctx.beginPath(); ctx.arc(target.x, target.y, target.r * 0.22, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#eef4ff';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${score}`, 10, 26);
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.ceil(timeLeft)}s`, CANVAS_W - 10, 26);
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    if (!ended) {
      timeLeft -= dt;
      if (target && now >= target.expiresAt) target = null;
      if (!target && now >= nextSpawn) { spawn(); nextSpawn = now + SPAWN_MS; }
      if (timeLeft <= 0) { ended = true; hooks.onEnd(score); }
    }
    draw();
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  function onClick(e) {
    if (ended || !target) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (CANVAS_W / rect.width);
    const y = (e.clientY - rect.top) * (CANVAS_H / rect.height);
    if (Math.hypot(x - target.x, y - target.y) < target.r) {
      score++;
      target = null;
      nextSpawn = performance.now() + SPAWN_MS * 0.3;
    }
  }
  canvas.addEventListener('click', onClick);
  hooks.setHud(`Click each target before it disappears -- ${TIME}s.`);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('click', onClick);
    },
  };
}

// ---------------------------------------------------------------- 30. Lane Dodge

function initLaneDodge(mount, hooks, difficulty) {
  const i = diffIdx(difficulty);
  const BASE_SPEED = [140, 170, 210, 260, 320][i];
  const SPEED_RAMP = [5, 7, 10, 14, 18][i];
  const BASE_SPAWN = [850, 720, 600, 480, 380][i];
  const SPAWN_RAMP = [8, 10, 13, 16, 20][i];
  const MIN_SPAWN = [280, 250, 220, 190, 160][i];
  const LANES = 3;

  const { ctx, canvas } = mount;
  const laneW = CANVAS_W / LANES;
  let playerLane = 1;
  const player = { x: laneW * 1.5, y: CANVAS_H - 44, w: 34, h: 46 };
  let cars = [];
  let survived = 0;
  let ended = false;
  let raf = 0;
  let lastT = performance.now();
  let nextSpawn = 0;

  function draw() {
    ctx.fillStyle = '#333';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.strokeStyle = '#666';
    ctx.setLineDash([12, 10]);
    for (let l = 1; l < LANES; l++) { ctx.beginPath(); ctx.moveTo(l * laneW, 0); ctx.lineTo(l * laneW, CANVAS_H); ctx.stroke(); }
    ctx.setLineDash([]);
    ctx.fillStyle = '#ff4d6d';
    for (const c of cars) ctx.fillRect(c.x - player.w / 2, c.y, player.w, player.h);
    ctx.fillStyle = '#4ff08a';
    ctx.fillRect(player.x - player.w / 2, player.y, player.w, player.h);
    ctx.fillStyle = '#eef4ff';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${survived.toFixed(1)}s`, 10, 26);
  }

  function loop(now) {
    const dt = Math.min(0.04, (now - lastT) / 1000);
    lastT = now;
    if (!ended) {
      survived += dt;
      const targetX = laneW * (playerLane + 0.5);
      player.x += (targetX - player.x) * Math.min(1, dt * 12);

      const speed = BASE_SPEED + survived * SPEED_RAMP;
      if (now >= nextSpawn) {
        cars.push({ lane: randInt(0, LANES - 1), y: -60 });
        cars[cars.length - 1].x = laneW * (cars[cars.length - 1].lane + 0.5);
        nextSpawn = now + Math.max(MIN_SPAWN, BASE_SPAWN - survived * SPAWN_RAMP);
      }
      for (const c of cars) c.y += speed * dt;
      cars = cars.filter((c) => c.y < CANVAS_H + 60);

      const hit = cars.some((c) => Math.abs(c.x - player.x) < player.w * 0.8
        && player.y < c.y + player.h && player.y + player.h > c.y);
      if (hit) { ended = true; hooks.onEnd(Math.round(survived * 10) / 10); }
    }
    draw();
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  function onKey(e) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { e.preventDefault(); playerLane = clamp(playerLane - 1, 0, LANES - 1); }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') { e.preventDefault(); playerLane = clamp(playerLane + 1, 0, LANES - 1); }
  }
  window.addEventListener('keydown', onKey);
  hooks.setHud('Arrow keys or A/D -- switch lanes to dodge the oncoming cars.');

  return { destroy() { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); } };
}

// ---------------------------------------------------------------- 31. Air Hockey

function initAirHockey(mount, hooks, difficulty) {
  const i = diffIdx(difficulty);
  const CPU_SPEED = [110, 150, 190, 240, 300][i];
  const PUCK_SPEED = [180, 200, 220, 250, 280][i];
  const WIN_SCORE = 7;
  const TIME_LIMIT = 60;

  const { ctx, canvas } = mount;
  const paddleR = 20;
  const puckR = 10;
  const player = { x: CANVAS_W / 2, y: CANVAS_H - 40 };
  const cpu = { x: CANVAS_W / 2, y: 40 };
  let puck = { x: CANVAS_W / 2, y: CANVAS_H / 2, vx: 0, vy: 0 };
  let playerScore = 0;
  let cpuScore = 0;
  let timeLeft = TIME_LIMIT;
  let ended = false;
  let raf = 0;
  let lastT = performance.now();

  function resetPuck(dir) {
    puck = { x: CANVAS_W / 2, y: CANVAS_H / 2, vx: rand(-100, 100), vy: dir * PUCK_SPEED };
  }
  resetPuck(Math.random() < 0.5 ? 1 : -1);

  function collide(paddle) {
    const dx = puck.x - paddle.x; const dy = puck.y - paddle.y;
    const dist = Math.hypot(dx, dy) || 0.01;
    if (dist < puckR + paddleR) {
      const nx = dx / dist; const ny = dy / dist;
      const speed = Math.min(500, Math.hypot(puck.vx, puck.vy) * 1.08 + 30);
      puck.vx = nx * speed;
      puck.vy = ny * speed;
      const overlap = puckR + paddleR - dist;
      puck.x += nx * overlap;
      puck.y += ny * overlap;
    }
  }

  function draw() {
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.strokeStyle = '#2a3a56';
    ctx.beginPath(); ctx.moveTo(0, CANVAS_H / 2); ctx.lineTo(CANVAS_W, CANVAS_H / 2); ctx.stroke();
    ctx.fillStyle = '#4d7fff';
    ctx.beginPath(); ctx.arc(player.x, player.y, paddleR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff4d6d';
    ctx.beginPath(); ctx.arc(cpu.x, cpu.y, paddleR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#eef4ff';
    ctx.beginPath(); ctx.arc(puck.x, puck.y, puckR, 0, Math.PI * 2); ctx.fill();
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`You ${playerScore} -- ${cpuScore} CPU`, 10, 22);
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.ceil(timeLeft)}s`, CANVAS_W - 10, 22);
  }

  function loop(now) {
    const dt = Math.min(0.03, (now - lastT) / 1000);
    lastT = now;
    if (!ended) {
      timeLeft -= dt;
      const dir = puck.y < CANVAS_H / 2 ? -1 : 1;
      if (dir === -1 && cpu.x < puck.x - 4) cpu.x += CPU_SPEED * dt;
      else if (dir === -1 && cpu.x > puck.x + 4) cpu.x -= CPU_SPEED * dt;
      else cpu.x += (CANVAS_W / 2 - cpu.x) * Math.min(1, dt * 2);
      cpu.x = clamp(cpu.x, paddleR, CANVAS_W - paddleR);
      cpu.y = clamp(cpu.y, paddleR, CANVAS_H / 2 - paddleR);

      puck.x += puck.vx * dt;
      puck.y += puck.vy * dt;
      if (puck.x < puckR || puck.x > CANVAS_W - puckR) puck.vx *= -1;
      collide(player);
      collide(cpu);

      if (puck.y < -puckR) { playerScore++; resetPuck(-1); }
      else if (puck.y > CANVAS_H + puckR) { cpuScore++; resetPuck(1); }

      if (playerScore >= WIN_SCORE || cpuScore >= WIN_SCORE || timeLeft <= 0) {
        ended = true;
        hooks.onEnd(playerScore);
      }
    }
    draw();
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  function onPointerMove(e) {
    const rect = canvas.getBoundingClientRect();
    player.x = clamp((e.clientX - rect.left) * (CANVAS_W / rect.width), paddleR, CANVAS_W - paddleR);
    player.y = clamp((e.clientY - rect.top) * (CANVAS_H / rect.height), CANVAS_H / 2 + paddleR, CANVAS_H - paddleR);
  }
  canvas.addEventListener('pointermove', onPointerMove);
  hooks.setHud(`Move your mouse to control your paddle -- first to ${WIN_SCORE} wins.`);

  return { destroy() { cancelAnimationFrame(raf); canvas.removeEventListener('pointermove', onPointerMove); } };
}

function shuffle(arr) {
  const a = [...arr];
  for (let k = a.length - 1; k > 0; k--) {
    const j = randInt(0, k);
    [a[k], a[j]] = [a[j], a[k]];
  }
  return a;
}

// ------------------------------------------------------------- 32. Connect Four

function initConnect4(mount, hooks, difficulty) {
  const i = diffIdx(difficulty);
  const STRATEGY = ['random', 'easy', 'heuristic', 'minimax3', 'minimax5'][i];
  const ROWS = 6;
  const COLS = 7;

  const { container } = mount;
  container.innerHTML = '';
  const status = document.createElement('div');
  status.className = 'mg-ttt-status';
  const colsRow = document.createElement('div');
  colsRow.className = 'mg-c4-cols';
  const grid = document.createElement('div');
  grid.className = 'mg-c4-grid';
  container.append(status, colsRow, grid);

  let board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  let ended = false;
  const cells = [];
  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement('div');
      cell.className = 'mg-c4-cell';
      grid.append(cell);
      row.push(cell);
    }
    cells.push(row);
  }
  const colButtons = [];
  for (let c = 0; c < COLS; c++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-small mg-c4-colbtn';
    btn.textContent = '↓';
    btn.addEventListener('click', () => playerDrop(c));
    colsRow.append(btn);
    colButtons.push(btn);
  }

  function dropRow(b, col) {
    for (let r = ROWS - 1; r >= 0; r--) if (!b[r][col]) return r;
    return -1;
  }
  function validCols(b) {
    const arr = [];
    for (let c = 0; c < COLS; c++) if (dropRow(b, c) >= 0) arr.push(c);
    return arr;
  }
  function winsAt(b, r, c, piece) {
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (const [dr, dc] of dirs) {
      let count = 1;
      for (let s = 1; s < 4; s++) { const rr = r + dr * s; const cc = c + dc * s; if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && b[rr][cc] === piece) count++; else break; }
      for (let s = 1; s < 4; s++) { const rr = r - dr * s; const cc = c - dc * s; if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && b[rr][cc] === piece) count++; else break; }
      if (count >= 4) return true;
    }
    return false;
  }
  function checkWinBoard(b, piece) {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (b[r][c] === piece && winsAt(b, r, c, piece)) return true;
    return false;
  }
  function evalWindow(win, piece) {
    const opp = piece === 'Y' ? 'R' : 'Y';
    const p = win.filter((v) => v === piece).length;
    const e = win.filter((v) => v === null).length;
    const o = win.filter((v) => v === opp).length;
    if (p === 4) return 100;
    if (p === 3 && e === 1) return 5;
    if (p === 2 && e === 2) return 2;
    if (o === 3 && e === 1) return -4;
    return 0;
  }
  function evalBoard(b, piece) {
    let score = 0;
    for (let r = 0; r < ROWS; r++) if (b[r][3] === piece) score += 3;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c <= COLS - 4; c++) score += evalWindow([b[r][c], b[r][c + 1], b[r][c + 2], b[r][c + 3]], piece);
    for (let c = 0; c < COLS; c++) for (let r = 0; r <= ROWS - 4; r++) score += evalWindow([b[r][c], b[r + 1][c], b[r + 2][c], b[r + 3][c]], piece);
    for (let r = 0; r <= ROWS - 4; r++) for (let c = 0; c <= COLS - 4; c++) score += evalWindow([b[r][c], b[r + 1][c + 1], b[r + 2][c + 2], b[r + 3][c + 3]], piece);
    for (let r = 3; r < ROWS; r++) for (let c = 0; c <= COLS - 4; c++) score += evalWindow([b[r][c], b[r - 1][c + 1], b[r - 2][c + 2], b[r - 3][c + 3]], piece);
    return score;
  }
  function minimax(b, depth, alpha, beta, maximizing) {
    const moves = validCols(b);
    const terminal = checkWinBoard(b, 'Y') || checkWinBoard(b, 'R') || !moves.length;
    if (depth === 0 || terminal) {
      if (terminal) {
        if (checkWinBoard(b, 'Y')) return [null, 1000000];
        if (checkWinBoard(b, 'R')) return [null, -1000000];
        return [null, 0];
      }
      return [null, evalBoard(b, 'Y')];
    }
    let bestCol = moves[0];
    if (maximizing) {
      let value = -Infinity;
      for (const c of moves) {
        const r = dropRow(b, c);
        const copy = b.map((row) => [...row]); copy[r][c] = 'Y';
        const [, s] = minimax(copy, depth - 1, alpha, beta, false);
        if (s > value) { value = s; bestCol = c; }
        alpha = Math.max(alpha, value);
        if (alpha >= beta) break;
      }
      return [bestCol, value];
    }
    let value = Infinity;
    for (const c of moves) {
      const r = dropRow(b, c);
      const copy = b.map((row) => [...row]); copy[r][c] = 'R';
      const [, s] = minimax(copy, depth - 1, alpha, beta, true);
      if (s < value) { value = s; bestCol = c; }
      beta = Math.min(beta, value);
      if (alpha >= beta) break;
    }
    return [bestCol, value];
  }

  function cpuChoose() {
    const moves = validCols(board);
    if (STRATEGY === 'random') return pick(moves);
    if (STRATEGY === 'easy') {
      for (const c of moves) { const r = dropRow(board, c); const copy = board.map((row) => [...row]); copy[r][c] = 'Y'; if (checkWinBoard(copy, 'Y')) return c; }
      if (Math.random() < 0.5) {
        for (const c of moves) { const r = dropRow(board, c); const copy = board.map((row) => [...row]); copy[r][c] = 'R'; if (checkWinBoard(copy, 'R')) return c; }
      }
      return pick(moves);
    }
    if (STRATEGY === 'heuristic') {
      for (const c of moves) { const r = dropRow(board, c); const copy = board.map((row) => [...row]); copy[r][c] = 'Y'; if (checkWinBoard(copy, 'Y')) return c; }
      for (const c of moves) { const r = dropRow(board, c); const copy = board.map((row) => [...row]); copy[r][c] = 'R'; if (checkWinBoard(copy, 'R')) return c; }
      const order = [3, 2, 4, 1, 5, 0, 6].filter((c) => moves.includes(c));
      return order[0];
    }
    const depth = STRATEGY === 'minimax3' ? 3 : 5;
    return minimax(board, depth, -Infinity, Infinity, true)[0];
  }

  function render() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = board[r][c];
        cells[r][c].style.background = v === 'R' ? '#ff4d6d' : v === 'Y' ? '#ffd166' : '#0d1a2b';
      }
    }
    colButtons.forEach((btn, c) => { btn.disabled = ended || dropRow(board, c) < 0; });
  }

  function finish(result) {
    ended = true;
    render();
    if (result === 'R') { status.textContent = 'You win!'; hooks.onEnd(2); }
    else if (result === 'draw') { status.textContent = "It's a draw."; hooks.onEnd(1); }
    else { status.textContent = 'The CPU wins.'; hooks.onEnd(0); }
  }

  function playerDrop(col) {
    if (ended) return;
    const r = dropRow(board, col);
    if (r < 0) return;
    board[r][col] = 'R';
    if (checkWinBoard(board, 'R')) { finish('R'); return; }
    if (!validCols(board).length) { finish('draw'); return; }
    render();
    setTimeout(() => {
      const c = cpuChoose();
      const rr = dropRow(board, c);
      board[rr][c] = 'Y';
      if (checkWinBoard(board, 'Y')) { finish('Y'); return; }
      if (!validCols(board).length) { finish('draw'); return; }
      render();
    }, 300);
  }

  render();
  hooks.setHud("You're red, the computer is yellow. Get four in a row.");
  return { destroy() {} };
}

// ------------------------------------------------------------ 33. Minesweeper

function initMinesweeper(mount, hooks, difficulty) {
  const i = diffIdx(difficulty);
  const W = [6, 7, 8, 9, 10][i];
  const H = [6, 7, 8, 9, 10][i];
  const MINES = [5, 8, 12, 18, 25][i];

  const { container } = mount;
  container.innerHTML = '';
  const status = document.createElement('div');
  status.className = 'mg-ttt-status';
  status.textContent = 'Reveal every safe cell.';
  const grid = document.createElement('div');
  grid.className = 'mg-mines-grid';
  grid.style.gridTemplateColumns = `repeat(${W}, 1fr)`;
  container.append(status, grid);

  const total = W * H;
  const mineSet = new Set();
  while (mineSet.size < MINES) mineSet.add(randInt(0, total - 1));
  const counts = Array(total).fill(0);
  function idx(x, y) { return y * W + x; }
  function neighborsOf(x, y) {
    const out = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx; const ny = y + dy;
      if (nx >= 0 && nx < W && ny >= 0 && ny < H) out.push([nx, ny]);
    }
    return out;
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (mineSet.has(idx(x, y))) continue;
    counts[idx(x, y)] = neighborsOf(x, y).filter(([nx, ny]) => mineSet.has(idx(nx, ny))).length;
  }

  const revealed = Array(total).fill(false);
  const cellEls = [];
  let ended = false;
  let elapsed = 0;
  let interval = null;
  let revealedCount = 0;
  const safeTotal = total - MINES;

  function revealFlood(x, y) {
    const stack = [[x, y]];
    while (stack.length) {
      const [cx, cy] = stack.pop();
      const id = idx(cx, cy);
      if (revealed[id]) continue;
      revealed[id] = true;
      revealedCount++;
      if (counts[id] === 0) {
        for (const [nx, ny] of neighborsOf(cx, cy)) if (!revealed[idx(nx, ny)] && !mineSet.has(idx(nx, ny))) stack.push([nx, ny]);
      }
    }
  }

  function render() {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const id = idx(x, y);
        const el = cellEls[id];
        if (revealed[id] || ended) {
          el.classList.add('is-open');
          if (mineSet.has(id)) { el.textContent = '\u{1F4A3}'; }
          else el.textContent = counts[id] || '';
        } else {
          el.classList.remove('is-open');
          el.textContent = '';
        }
      }
    }
  }

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'mg-mines-cell';
      cell.addEventListener('click', () => {
        if (ended || revealed[idx(x, y)]) return;
        if (mineSet.has(idx(x, y))) {
          ended = true;
          clearInterval(interval);
          render();
          status.textContent = 'Boom -- try again next time.';
          hooks.onEnd(9999);
          return;
        }
        revealFlood(x, y);
        render();
        if (revealedCount >= safeTotal) {
          ended = true;
          clearInterval(interval);
          status.textContent = 'Cleared!';
          hooks.onEnd(Math.round(elapsed));
        }
      });
      grid.append(cell);
      cellEls.push(cell);
    }
  }

  render();
  hooks.setHud(`Click a cell to reveal it -- ${MINES} mines hidden, faster is better.`);
  interval = setInterval(() => { elapsed += 1; hooks.setHud(`${MINES} mines hidden -- ${elapsed}s elapsed.`); }, 1000);

  return { destroy() { clearInterval(interval); } };
}

// -------------------------------------------------------------- 34. Lights Out

function initLightsOut(mount, hooks, difficulty) {
  const i = diffIdx(difficulty);
  const SIZE = [3, 4, 5, 5, 6][i];
  const SCRAMBLE = [3, 5, 8, 14, 20][i];

  const { container } = mount;
  container.innerHTML = '';
  const status = document.createElement('div');
  status.className = 'mg-ttt-status';
  status.textContent = 'Turn every light off.';
  const grid = document.createElement('div');
  grid.className = 'mg-lights-grid';
  grid.style.gridTemplateColumns = `repeat(${SIZE}, 1fr)`;
  container.append(status, grid);

  let lights = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
  function toggleAt(r, c) {
    for (const [dr, dc] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr; const nc = c + dc;
      if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) lights[nr][nc] = !lights[nr][nc];
    }
  }
  for (let k = 0; k < SCRAMBLE; k++) toggleAt(randInt(0, SIZE - 1), randInt(0, SIZE - 1));
  if (lights.every((row) => row.every((v) => !v))) toggleAt(randInt(0, SIZE - 1), randInt(0, SIZE - 1));

  let moves = 0;
  let ended = false;
  const cells = [];
  for (let r = 0; r < SIZE; r++) {
    const row = [];
    for (let c = 0; c < SIZE; c++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'mg-lights-cell';
      cell.addEventListener('click', () => {
        if (ended) return;
        toggleAt(r, c);
        moves++;
        render();
        if (lights.every((rowV) => rowV.every((v) => !v))) {
          ended = true;
          status.textContent = 'Solved!';
          hooks.onEnd(moves);
        }
      });
      grid.append(cell);
      row.push(cell);
    }
    cells.push(row);
  }

  function render() {
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) cells[r][c].classList.toggle('is-on', lights[r][c]);
  }

  render();
  hooks.setHud('Clicking a light toggles it and its neighbors -- turn them all off.');
  return { destroy() {} };
}

// ------------------------------------------------------------- 35. Slide Puzzle

function initSlidePuzzle(mount, hooks, difficulty) {
  const i = diffIdx(difficulty);
  const N = [3, 3, 4, 4, 5][i];
  const SHUFFLE_MOVES = [40, 60, 100, 150, 220][i];

  const { container } = mount;
  container.innerHTML = '';
  const status = document.createElement('div');
  status.className = 'mg-ttt-status';
  const grid = document.createElement('div');
  grid.className = 'mg-slide-grid';
  grid.style.gridTemplateColumns = `repeat(${N}, 1fr)`;
  container.append(status, grid);

  const total = N * N;
  let tiles = Array.from({ length: total }, (_, k) => (k === total - 1 ? 0 : k + 1));
  function blankIdx() { return tiles.indexOf(0); }
  function neighborsIdx(id) {
    const r = Math.floor(id / N); const c = id % N;
    const out = [];
    if (r > 0) out.push(id - N);
    if (r < N - 1) out.push(id + N);
    if (c > 0) out.push(id - 1);
    if (c < N - 1) out.push(id + 1);
    return out;
  }
  for (let k = 0; k < SHUFFLE_MOVES; k++) {
    const b = blankIdx();
    const opts = neighborsIdx(b);
    const swapWith = pick(opts);
    [tiles[b], tiles[swapWith]] = [tiles[swapWith], tiles[b]];
  }

  let moves = 0;
  let ended = false;
  const cellEls = tiles.map((_, id) => {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'mg-slide-cell';
    cell.addEventListener('click', () => tryMove(id));
    grid.append(cell);
    return cell;
  });

  function render() {
    tiles.forEach((v, id) => {
      cellEls[id].textContent = v || '';
      cellEls[id].classList.toggle('is-blank', v === 0);
    });
  }

  function isSolved() { return tiles.every((v, id) => (id === total - 1 ? v === 0 : v === id + 1)); }

  function tryMove(id) {
    if (ended) return;
    const b = blankIdx();
    if (!neighborsIdx(b).includes(id)) return;
    [tiles[b], tiles[id]] = [tiles[id], tiles[b]];
    moves++;
    render();
    if (isSolved()) {
      ended = true;
      status.textContent = 'Solved!';
      hooks.onEnd(moves);
    }
  }

  render();
  hooks.setHud('Click a tile next to the blank to slide it -- fewer moves is better.');
  return { destroy() {} };
}

// ------------------------------------------------------------------ 36. Sudoku

function initSudoku(mount, hooks, difficulty) {
  const i = diffIdx(difficulty);
  const CLUES = [24, 20, 16, 12, 9][i];
  const N = 6; const BOX_R = 2; const BOX_C = 3;

  const { container } = mount;
  container.innerHTML = '';
  const status = document.createElement('div');
  status.className = 'mg-ttt-status';
  const grid = document.createElement('div');
  grid.className = 'mg-sudoku-grid';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-primary';
  btn.textContent = 'Check Solution';
  container.append(status, grid, btn);

  function buildSolution() {
    const g = Array.from({ length: N }, () => Array(N).fill(0));
    function valid(r, c, v) {
      for (let k = 0; k < N; k++) { if (g[r][k] === v || g[k][c] === v) return false; }
      const br = Math.floor(r / BOX_R) * BOX_R; const bc = Math.floor(c / BOX_C) * BOX_C;
      for (let rr = br; rr < br + BOX_R; rr++) for (let cc = bc; cc < bc + BOX_C; cc++) if (g[rr][cc] === v) return false;
      return true;
    }
    function fill(pos) {
      if (pos === N * N) return true;
      const r = Math.floor(pos / N); const c = pos % N;
      for (const v of shuffle([1, 2, 3, 4, 5, 6])) {
        if (valid(r, c, v)) { g[r][c] = v; if (fill(pos + 1)) return true; g[r][c] = 0; }
      }
      return false;
    }
    fill(0);
    return g;
  }

  const solution = buildSolution();
  const puzzle = solution.map((row) => [...row]);
  const positions = shuffle(Array.from({ length: N * N }, (_, k) => k));
  for (const pos of positions.slice(0, N * N - CLUES)) puzzle[Math.floor(pos / N)][pos % N] = 0;

  let ended = false;
  let elapsed = 0;
  let interval = null;
  const inputs = [];
  for (let r = 0; r < N; r++) {
    const rowInputs = [];
    for (let c = 0; c < N; c++) {
      const cell = document.createElement('input');
      cell.type = 'text';
      cell.maxLength = 1;
      cell.inputMode = 'numeric';
      cell.className = 'mg-sudoku-cell';
      if (puzzle[r][c]) { cell.value = String(puzzle[r][c]); cell.disabled = true; cell.classList.add('is-fixed'); }
      cell.addEventListener('input', () => { cell.value = cell.value.replace(/[^1-6]/g, '').slice(0, 1); });
      grid.append(cell);
      rowInputs.push(cell);
    }
    inputs.push(rowInputs);
  }

  btn.addEventListener('click', () => {
    if (ended) return;
    let correct = true;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (Number(inputs[r][c].value) !== solution[r][c]) correct = false;
    if (correct) {
      ended = true;
      clearInterval(interval);
      status.textContent = 'Solved!';
      hooks.onEnd(Math.round(elapsed));
    } else {
      status.textContent = 'Not quite -- keep trying.';
    }
  });

  status.textContent = `Fill in the 1-6 grid -- ${CLUES} clues given.`;
  interval = setInterval(() => { elapsed += 1; hooks.setHud(`${Math.round(elapsed)}s elapsed -- solve faster for a better score.`); }, 1000);
  hooks.setHud('0s elapsed -- solve faster for a better score.');

  return { destroy() { clearInterval(interval); } };
}

// --------------------------------------------------------------- 37. Mastermind

function initMastermind(mount, hooks, difficulty) {
  const i = diffIdx(difficulty);
  const CODE_LEN = [3, 4, 4, 5, 6][i];
  const COLOR_COUNT = [4, 5, 6, 6, 8][i];
  const MAX_GUESSES = [12, 10, 10, 8, 8][i];
  const PALETTE = ['#ff4d6d', '#4d7fff', '#4ff08a', '#ffd166', '#a06bff', '#ff8c3a', '#4cc9f0', '#ff6fae'].slice(0, COLOR_COUNT);

  const { container } = mount;
  container.innerHTML = '';
  const status = document.createElement('div');
  status.className = 'mg-ttt-status';
  const guessRow = document.createElement('div');
  guessRow.className = 'mg-mm-guess-row';
  const submitBtn = document.createElement('button');
  submitBtn.type = 'button';
  submitBtn.className = 'btn btn-primary';
  submitBtn.textContent = 'Submit Guess';
  const history = document.createElement('div');
  history.className = 'mg-mm-history';
  container.append(status, guessRow, submitBtn, history);

  const secret = Array.from({ length: CODE_LEN }, () => randInt(0, COLOR_COUNT - 1));
  const current = Array(CODE_LEN).fill(0);
  let guesses = 0;
  let ended = false;

  const slots = current.map((_, slotIdx) => {
    const slot = document.createElement('button');
    slot.type = 'button';
    slot.className = 'mg-mm-slot';
    slot.style.background = PALETTE[0];
    slot.addEventListener('click', () => {
      if (ended) return;
      current[slotIdx] = (current[slotIdx] + 1) % COLOR_COUNT;
      slot.style.background = PALETTE[current[slotIdx]];
    });
    guessRow.append(slot);
    return slot;
  });

  function score(guess) {
    let black = 0;
    const secretLeft = [];
    const guessLeft = [];
    for (let k = 0; k < CODE_LEN; k++) {
      if (guess[k] === secret[k]) black++;
      else { secretLeft.push(secret[k]); guessLeft.push(guess[k]); }
    }
    let white = 0;
    for (const g of guessLeft) {
      const idx2 = secretLeft.indexOf(g);
      if (idx2 >= 0) { white++; secretLeft.splice(idx2, 1); }
    }
    return { black, white };
  }

  submitBtn.addEventListener('click', () => {
    if (ended) return;
    guesses++;
    const { black, white } = score(current);
    const row = document.createElement('div');
    row.className = 'mg-mm-row';
    for (const v of current) {
      const dot = document.createElement('span');
      dot.className = 'mg-mm-dot';
      dot.style.background = PALETTE[v];
      row.append(dot);
    }
    const pegs = document.createElement('span');
    pegs.className = 'mg-mm-pegs';
    pegs.textContent = `${black}● ${white}○`;
    row.append(pegs);
    history.prepend(row);

    if (black === CODE_LEN) {
      ended = true;
      status.textContent = 'Cracked it!';
      hooks.onEnd(guesses);
    } else if (guesses >= MAX_GUESSES) {
      ended = true;
      status.textContent = 'Out of guesses.';
      hooks.onEnd(MAX_GUESSES + 5);
    }
  });

  status.textContent = `Crack the ${CODE_LEN}-color code in ${MAX_GUESSES} guesses.`;
  hooks.setHud('Click a slot to cycle its color, then submit -- ● = right spot, ○ = right color.');
  return { destroy() {} };
}

// ------------------------------------------------------------- 38. Word Scramble

function initWordScramble(mount, hooks, difficulty) {
  const i = diffIdx(difficulty);
  const TIME = [75, 60, 50, 40, 30][i];
  const BANKS = [
    ['cat', 'dog', 'sun', 'run', 'red', 'top', 'map', 'six', 'fun', 'bed'],
    ['apple', 'chair', 'happy', 'quiet', 'plant', 'smile', 'tiger', 'water', 'globe', 'pizza'],
    ['puzzle', 'garden', 'rocket', 'castle', 'winter', 'silver', 'orange', 'purple', 'friend', 'monkey'],
    ['keyboard', 'mountain', 'sandwich', 'elephant', 'universe', 'building', 'daylight', 'triangle', 'sunshine', 'backpack'],
    ['adventure', 'chocolate', 'dangerous', 'important', 'butterfly', 'astronaut', 'basketball', 'wonderful', 'telephone', 'hurricane'],
  ];
  const WORDS = BANKS[i];

  const { container } = mount;
  container.innerHTML = '';
  const scrambled = document.createElement('div');
  scrambled.className = 'mg-scramble-word';
  const row = document.createElement('div');
  row.className = 'mg-guess-row';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'text-input mg-guess-input';
  input.autocomplete = 'off';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-primary';
  btn.textContent = 'Submit';
  row.append(input, btn);
  container.append(scrambled, row);

  let score = 0;
  let timeLeft = TIME;
  let ended = false;
  let currentWord = '';

  function scrambleWord(word) {
    let letters = word.split('');
    let attempt = word;
    let tries = 0;
    while (attempt === word && tries < 10) { letters = shuffle(letters); attempt = letters.join(''); tries++; }
    return attempt;
  }

  function nextWord() {
    currentWord = pick(WORDS);
    scrambled.textContent = scrambleWord(currentWord).toUpperCase();
    input.value = '';
    input.focus();
  }
  nextWord();

  function submit() {
    if (ended) return;
    if (input.value.trim().toLowerCase() === currentWord) score++;
    nextWord();
  }
  btn.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });

  hooks.setHud(`Unscramble the word -- ${timeLeft}s.`);
  const interval = setInterval(() => {
    timeLeft--;
    hooks.setHud(`Unscramble the word -- ${timeLeft}s.`);
    if (timeLeft <= 0) {
      ended = true;
      clearInterval(interval);
      input.disabled = true;
      btn.disabled = true;
      hooks.onEnd(score);
    }
  }, 1000);

  return { destroy() { clearInterval(interval); } };
}

// ---------------------------------------------------------------- 39. Typing Test

function initTyping(mount, hooks, difficulty) {
  const i = diffIdx(difficulty);
  const SENTENCES = [
    ['the cat sat', 'i like dogs', 'run to the sun', 'we ate cake', 'birds can fly'],
    ['the quick fox jumps high', 'she sells sea shells', 'a good book is fun', 'we walked to the park'],
    ['practice makes progress every day', 'the weather is nice this morning', 'coding is a useful skill to learn'],
    ["don't count your chickens before they hatch", 'the early bird catches the worm, they say', 'success is not final, failure is not fatal'],
    ["it's not whether you get knocked down, it's whether you get up!", 'the only way to do great work is to love what you do.'],
  ][i];

  const { container } = mount;
  container.innerHTML = '';
  const target = document.createElement('div');
  target.className = 'mg-typing-target';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'text-input mg-typing-input';
  input.autocomplete = 'off';
  container.append(target, input);

  const sentence = pick(SENTENCES);
  target.textContent = sentence;
  let startedAt = null;
  let ended = false;

  input.addEventListener('input', () => {
    if (ended) return;
    if (startedAt == null) startedAt = performance.now();
    if (input.value === sentence) {
      ended = true;
      const minutes = (performance.now() - startedAt) / 60000;
      const words = sentence.split(' ').length;
      const wpm = Math.max(1, Math.round(words / Math.max(minutes, 0.02)));
      input.disabled = true;
      hooks.onEnd(wpm);
    }
  });

  hooks.setHud('Type the sentence exactly, then keep typing -- your WPM is your score.');
  input.focus();
  return { destroy() {} };
}

// -------------------------------------------------------------- 40. Sequence Recall

function initSeqRecall(mount, hooks, difficulty) {
  const i = diffIdx(difficulty);
  const DIMS = [{ c: 2, r: 2 }, { c: 3, r: 2 }, { c: 3, r: 3 }, { c: 4, r: 3 }, { c: 4, r: 4 }][i];
  const STEP_MS = [700, 600, 500, 400, 300][i];

  const { container } = mount;
  container.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'mg-seq-grid';
  grid.style.gridTemplateColumns = `repeat(${DIMS.c}, 1fr)`;
  container.append(grid);

  const count = DIMS.c * DIMS.r;
  const tiles = Array.from({ length: count }, (_, k) => {
    const t = document.createElement('button');
    t.type = 'button';
    t.className = 'mg-seq-tile';
    t.textContent = String(k + 1);
    t.addEventListener('click', () => onTap(k));
    grid.append(t);
    return t;
  });

  let sequence = [];
  let playerIndex = 0;
  let accepting = false;
  let round = 0;
  let timers = [];
  const schedule = (fn, ms) => timers.push(setTimeout(fn, ms));

  function lightUp(idx, ms) {
    tiles[idx].classList.add('is-lit');
    setTimeout(() => tiles[idx].classList.remove('is-lit'), ms);
  }

  function playSequence() {
    accepting = false;
    playerIndex = 0;
    sequence.forEach((idx, step) => schedule(() => lightUp(idx, STEP_MS * 0.7), STEP_MS * step + STEP_MS));
    schedule(() => { accepting = true; }, STEP_MS * sequence.length + STEP_MS + 150);
  }

  function nextRound() {
    round++;
    sequence.push(randInt(0, count - 1));
    hooks.setHud(`Round ${round} -- memorize the lit tiles, then tap them in order.`);
    playSequence();
  }

  function onTap(idx) {
    if (!accepting) return;
    lightUp(idx, 200);
    if (sequence[playerIndex] !== idx) {
      accepting = false;
      hooks.onEnd(round - 1);
      return;
    }
    playerIndex++;
    if (playerIndex === sequence.length) {
      accepting = false;
      schedule(nextRound, 500);
    }
  }

  nextRound();
  return { destroy() { for (const t of timers) clearTimeout(t); } };
}

// --------------------------------------------------------------- 41. Higher or Lower

function initHighLow(mount, hooks, difficulty) {
  const i = diffIdx(difficulty);
  const TIE_SAFE = [true, true, false, false, false][i];
  const DECKS = [1, 1, 1, 2, 2][i];

  const { container } = mount;
  container.innerHTML = '';
  const status = document.createElement('div');
  status.className = 'mg-highlow-status';
  const cardsRow = document.createElement('div');
  cardsRow.className = 'mg-highlow-cards';
  const btnRow = document.createElement('div');
  btnRow.className = 'mg-rps-row';
  container.append(status, cardsRow, btnRow);

  const NAMES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const SUITS = ['♠', '♥', '♦', '♣'];
  let deck = [];
  for (let d = 0; d < DECKS; d++) for (const suit of SUITS) for (let v = 0; v < 13; v++) deck.push({ v, suit });
  deck = shuffle(deck);

  let pos = 0;
  let streak = 0;
  let ended = false;
  let current = deck[pos];

  const currentEl = document.createElement('div');
  currentEl.className = 'mg-highlow-card';
  cardsRow.append(currentEl);

  function renderCard() {
    currentEl.textContent = `${NAMES[current.v]}${current.suit}`;
  }
  renderCard();

  function guess(dir) {
    if (ended) return;
    pos++;
    if (pos >= deck.length) { ended = true; hooks.onEnd(streak); return; }
    const next = deck[pos];
    let correct;
    if (next.v === current.v) correct = TIE_SAFE;
    else correct = dir === 'higher' ? next.v > current.v : next.v < current.v;
    current = next;
    renderCard();
    if (correct) {
      streak++;
      status.textContent = `Streak: ${streak} -- higher or lower?`;
    } else {
      ended = true;
      status.textContent = `Wrong! Final streak: ${streak}.`;
      hooks.onEnd(streak);
    }
  }

  const higherBtn = document.createElement('button');
  higherBtn.type = 'button';
  higherBtn.className = 'btn btn-primary';
  higherBtn.textContent = 'Higher ↑';
  higherBtn.addEventListener('click', () => guess('higher'));
  const lowerBtn = document.createElement('button');
  lowerBtn.type = 'button';
  lowerBtn.className = 'btn btn-primary';
  lowerBtn.textContent = 'Lower ↓';
  lowerBtn.addEventListener('click', () => guess('lower'));
  btnRow.append(higherBtn, lowerBtn);

  status.textContent = 'Streak: 0 -- higher or lower?';
  hooks.setHud(TIE_SAFE ? 'A tie is safe -- guess again.' : 'A tie counts as a loss on this difficulty.');
  return { destroy() {} };
}

// ---------------------------------------------------------------- 42. Color Flood

function initColorFlood(mount, hooks, difficulty) {
  const i = diffIdx(difficulty);
  const SIZE = [8, 10, 12, 14, 16][i];
  const COLOR_COUNT = [3, 4, 5, 6, 6][i];
  const MOVE_LIMIT = [14, 18, 22, 26, 30][i];
  const PALETTE = ['#ff4d6d', '#4d7fff', '#4ff08a', '#ffd166', '#a06bff', '#ff8c3a'].slice(0, COLOR_COUNT);

  const { container } = mount;
  container.innerHTML = '';
  const status = document.createElement('div');
  status.className = 'mg-ttt-status';
  const grid = document.createElement('div');
  grid.className = 'mg-flood-grid';
  grid.style.gridTemplateColumns = `repeat(${SIZE}, 1fr)`;
  const row = document.createElement('div');
  row.className = 'mg-color-row';
  container.append(status, grid, row);

  let board = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => pick(PALETTE)));
  let moves = 0;
  let ended = false;
  const cells = [];
  for (let r = 0; r < SIZE; r++) {
    const rowEls = [];
    for (let c = 0; c < SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'mg-flood-cell';
      grid.append(cell);
      rowEls.push(cell);
    }
    cells.push(rowEls);
  }

  function render() {
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) cells[r][c].style.background = board[r][c];
    status.textContent = `Moves: ${moves}/${MOVE_LIMIT}`;
  }

  function regionFrom() {
    const startColor = board[0][0];
    const seen = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
    const stack = [[0, 0]];
    seen[0][0] = true;
    const cellsIn = [[0, 0]];
    while (stack.length) {
      const [r, c] = stack.pop();
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = r + dr; const nc = c + dc;
        if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && !seen[nr][nc] && board[nr][nc] === startColor) {
          seen[nr][nc] = true;
          stack.push([nr, nc]);
          cellsIn.push([nr, nc]);
        }
      }
    }
    return cellsIn;
  }

  function flood(color) {
    if (ended || color === board[0][0]) return;
    const region = regionFrom();
    for (const [r, c] of region) board[r][c] = color;
    moves++;
    render();
    if (regionFrom().length === SIZE * SIZE) {
      ended = true;
      status.textContent = 'Flooded the whole board!';
      hooks.onEnd(moves);
    } else if (moves >= MOVE_LIMIT) {
      ended = true;
      status.textContent = "Out of moves -- didn't quite finish.";
      hooks.onEnd(MOVE_LIMIT + 5);
    }
  }

  for (const c of PALETTE) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn mg-color-btn';
    btn.style.background = c;
    btn.addEventListener('click', () => flood(c));
    row.append(btn);
  }

  render();
  hooks.setHud('Pick a color to flood-fill from the top-left -- turn the whole board one color.');
  return { destroy() {} };
}

// -------------------------------------------------------------- 43. Odd One Out

function initOddOneOut(mount, hooks, difficulty) {
  const i = diffIdx(difficulty);
  const DIMS = [{ c: 3, r: 3 }, { c: 4, r: 4 }, { c: 4, r: 4 }, { c: 5, r: 5 }, { c: 5, r: 5 }][i];
  const MAGNITUDE = [35, 25, 18, 12, 7][i];
  const ROUND_TIME = [6, 5, 4, 3, 2.5][i];

  const { container } = mount;
  container.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'mg-oddoneout-grid';
  grid.style.gridTemplateColumns = `repeat(${DIMS.c}, 1fr)`;
  container.append(grid);

  const count = DIMS.c * DIMS.r;
  let score = 0;
  let ended = false;
  let roundTimer = null;
  let tiles = [];

  function newRound() {
    grid.innerHTML = '';
    tiles = [];
    const oddIdx = randInt(0, count - 1);
    for (let k = 0; k < count; k++) {
      const t = document.createElement('button');
      t.type = 'button';
      t.className = 'mg-oddoneout-tile';
      t.textContent = '▲';
      t.style.transform = `rotate(${k === oddIdx ? MAGNITUDE : 0}deg)`;
      t.addEventListener('click', () => {
        if (ended) return;
        clearTimeout(roundTimer);
        if (k === oddIdx) { score++; newRound(); }
        else { ended = true; hooks.onEnd(score); }
      });
      grid.append(t);
      tiles.push(t);
    }
    clearTimeout(roundTimer);
    roundTimer = setTimeout(() => { if (!ended) { ended = true; hooks.onEnd(score); } }, ROUND_TIME * 1000);
    hooks.setHud(`Round ${score + 1} -- find the tile rotated differently. ${ROUND_TIME}s.`);
  }

  newRound();
  return { destroy() { clearTimeout(roundTimer); } };
}

// ------------------------------------------------------------- 44. Pattern Predictor

function initPattern(mount, hooks, difficulty) {
  const i = diffIdx(difficulty);
  const TIME = [45, 40, 35, 30, 25][i];

  const { container } = mount;
  container.innerHTML = '';
  const problem = document.createElement('div');
  problem.className = 'mg-math-problem';
  const row = document.createElement('div');
  row.className = 'mg-guess-row';
  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'text-input mg-guess-input';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-primary';
  btn.textContent = 'Submit';
  row.append(input, btn);
  container.append(problem, row);

  function genArithmetic() {
    const step = randInt(1, 9) * pick([1, -1]);
    const start = randInt(1, 20);
    const terms = [0, 1, 2, 3].map((k) => start + step * k);
    return { terms, answer: start + step * 4 };
  }
  function genGeometric() {
    const ratio = pick([2, 3]);
    const start = randInt(1, 5);
    const terms = [0, 1, 2, 3].map((k) => start * ratio ** k);
    return { terms, answer: start * ratio ** 4 };
  }
  function genFib() {
    let a = randInt(1, 6); let b = randInt(1, 6);
    const terms = [a, b, a + b, a + 2 * b];
    return { terms, answer: terms[2] + terms[3] };
  }
  function genSquares() {
    const n = randInt(1, 6);
    const terms = [0, 1, 2, 3].map((k) => (n + k) ** 2);
    return { terms, answer: (n + 4) ** 2 };
  }
  const POOLS = [
    [genArithmetic],
    [genArithmetic],
    [genArithmetic, genGeometric],
    [genArithmetic, genGeometric, genFib],
    [genArithmetic, genGeometric, genFib, genSquares],
  ];
  const pool = POOLS[i];

  let score = 0;
  let timeLeft = TIME;
  let ended = false;
  let answer = 0;

  function nextProblem() {
    const { terms, answer: a } = pick(pool)();
    answer = a;
    problem.textContent = `${terms.join(', ')}, ?`;
    input.value = '';
    input.focus();
  }
  nextProblem();

  function submit() {
    if (ended) return;
    if (Number(input.value) === answer) score++;
    nextProblem();
  }
  btn.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });

  hooks.setHud(`What comes next in the sequence? -- ${timeLeft}s.`);
  const interval = setInterval(() => {
    timeLeft--;
    hooks.setHud(`What comes next in the sequence? -- ${timeLeft}s.`);
    if (timeLeft <= 0) {
      ended = true;
      clearInterval(interval);
      input.disabled = true;
      btn.disabled = true;
      hooks.onEnd(score);
    }
  }, 1000);

  return { destroy() { clearInterval(interval); } };
}

// ------------------------------------------------------------------ 45. Speed Tap

function initSpeedTap(mount, hooks, difficulty) {
  const i = diffIdx(difficulty);
  const DIMS = [{ c: 3, r: 3 }, { c: 4, r: 3 }, { c: 4, r: 4 }, { c: 5, r: 4 }, { c: 5, r: 5 }][i];
  const TARGET_TAPS = [15, 18, 20, 24, 30][i];

  const { container } = mount;
  container.innerHTML = '';
  const status = document.createElement('div');
  status.className = 'mg-ttt-status';
  const grid = document.createElement('div');
  grid.className = 'mg-speedtap-grid';
  grid.style.gridTemplateColumns = `repeat(${DIMS.c}, 1fr)`;
  container.append(status, grid);

  const count = DIMS.c * DIMS.r;
  const tiles = Array.from({ length: count }, (_, k) => {
    const t = document.createElement('button');
    t.type = 'button';
    t.className = 'mg-speedtap-tile';
    t.addEventListener('click', () => onTap(k));
    grid.append(t);
    return t;
  });

  let taps = 0;
  let activeIdx = -1;
  let startedAt = null;
  let ended = false;

  function light() {
    if (activeIdx >= 0) tiles[activeIdx].classList.remove('is-lit');
    let next = activeIdx;
    while (next === activeIdx) next = randInt(0, count - 1);
    activeIdx = next;
    tiles[activeIdx].classList.add('is-lit');
  }

  function onTap(k) {
    if (ended || k !== activeIdx) return;
    if (startedAt == null) startedAt = performance.now();
    taps++;
    status.textContent = `${taps}/${TARGET_TAPS}`;
    if (taps >= TARGET_TAPS) {
      ended = true;
      tiles[activeIdx].classList.remove('is-lit');
      const ms = Math.round(performance.now() - startedAt);
      hooks.onEnd(ms);
    } else {
      light();
    }
  }

  light();
  status.textContent = `0/${TARGET_TAPS}`;
  hooks.setHud(`Tap the lit tile as fast as you can -- ${TARGET_TAPS} taps, total time is your score.`);
  return { destroy() {} };
}

// ----------------------------------------------------------------- registry

export const GAMES = [
  { id: 'asteroid', name: 'Asteroid Dodge', icon: '\u{1F6F8}', type: 'canvas', blurb: 'Free-fly to dodge asteroids from every side.', scoreLabel: 'seconds', higherIsBetter: true, init: initAsteroid },
  { id: 'fruitslice', name: 'Fruit Slice', icon: '\u{1F52A}', type: 'canvas', blurb: 'Slice the fruit, dodge the bombs.', scoreLabel: 'sliced', higherIsBetter: true, init: initFruitSlice },
  { id: 'pong', name: 'Pong Solo', icon: '\u{1F3D3}', type: 'canvas', blurb: 'Keep the rally going against the wall.', scoreLabel: 'hits', higherIsBetter: true, init: initPong },
  { id: 'invaders', name: 'Space Invaders', icon: '\u{1F47E}', type: 'canvas', blurb: 'Shoot the descending aliens.', scoreLabel: 'aliens', higherIsBetter: true, init: initInvaders },
  { id: 'runner', name: 'Endless Runner', icon: '\u{1F3C3}', type: 'canvas', blurb: 'Jump the obstacles, keep running.', scoreLabel: 'cleared', higherIsBetter: true, init: initRunner },
  { id: 'maze', name: 'Maze Escape', icon: '\u{1F9E9}', type: 'canvas', blurb: 'Navigate to the exit before time runs out.', scoreLabel: 'seconds left', higherIsBetter: true, init: initMaze },
  { id: 'bubbles', name: 'Bubble Shooter', icon: '\u{1FAE7}', type: 'canvas', blurb: 'Match 3+ bubbles of a color to pop them.', scoreLabel: 'popped', higherIsBetter: true, init: initBubbles },
  { id: 'towerstack', name: 'Tower Stack', icon: '\u{1F5FC}', type: 'canvas', blurb: 'Drop each block to keep the tower growing.', scoreLabel: 'height', higherIsBetter: true, init: initTowerStack },
  { id: 'balloons', name: 'Balloon Pop', icon: '\u{1F388}', type: 'canvas', blurb: 'Pop balloons before they float away.', scoreLabel: 'popped', higherIsBetter: true, init: initBalloons },
  { id: 'laser', name: 'Laser Dodge', icon: '\u{1F6F8}', type: 'canvas', blurb: 'Survive the sweeping laser beams.', scoreLabel: 'seconds', higherIsBetter: true, init: initLaser },
  { id: 'ski', name: 'Slalom Ski', icon: '\u{1F3BF}', type: 'canvas', blurb: 'Steer through every gate on the way down.', scoreLabel: 'gates', higherIsBetter: true, init: initSki },
  { id: 'basketball', name: 'Basketball Shots', icon: '\u{1F3C0}', type: 'canvas', blurb: 'Drag back and release to sink the shot.', scoreLabel: 'baskets', higherIsBetter: true, init: initBasketball },
  { id: 'pianotiles', name: 'Piano Tiles', icon: '\u{1F3B9}', type: 'canvas', blurb: 'Tap the tiles the instant they hit the zone.', scoreLabel: 'tiles', higherIsBetter: true, init: initPianoTiles },
  { id: 'targets', name: 'Target Practice', icon: '\u{1F3AF}', type: 'canvas', blurb: 'Click each target before it disappears.', scoreLabel: 'hits', higherIsBetter: true, init: initTargets },
  { id: 'lanedodge', name: 'Lane Dodge', icon: '\u{1F697}', type: 'canvas', blurb: 'Switch lanes to dodge oncoming traffic.', scoreLabel: 'seconds', higherIsBetter: true, init: initLaneDodge },
  { id: 'airhockey', name: 'Air Hockey', icon: '\u{1F3D2}', type: 'canvas', blurb: 'First to 7 goals against the CPU.', scoreLabel: 'goals', higherIsBetter: true, init: initAirHockey },
  { id: 'connect4', name: 'Connect Four', icon: '\u{1F534}', type: 'dom', blurb: 'Get four in a row against the computer.', scoreLabel: 'result', higherIsBetter: true, init: initConnect4 },
  { id: 'minesweeper', name: 'Minesweeper', icon: '\u{1F4A3}', type: 'dom', blurb: 'Clear every safe cell, avoid the mines.', scoreLabel: 'seconds', higherIsBetter: false, init: initMinesweeper },
  { id: 'lightsout', name: 'Lights Out', icon: '\u{1F4A1}', type: 'dom', blurb: 'Toggle lights and neighbors -- turn them all off.', scoreLabel: 'moves', higherIsBetter: false, init: initLightsOut },
  { id: 'slidepuzzle', name: 'Slide Puzzle', icon: '\u{1F522}', type: 'dom', blurb: 'Slide tiles back into numeric order.', scoreLabel: 'moves', higherIsBetter: false, init: initSlidePuzzle },
  { id: 'sudoku', name: 'Sudoku Mini', icon: '\u{1F9E9}', type: 'dom', blurb: 'Fill the 6x6 grid, 1 to 6 per row/column/box.', scoreLabel: 'seconds', higherIsBetter: false, init: initSudoku },
  { id: 'mastermind', name: 'Mastermind', icon: '\u{1F3B1}', type: 'dom', blurb: 'Crack the secret color code.', scoreLabel: 'guesses', higherIsBetter: false, init: initMastermind },
  { id: 'wordscramble', name: 'Word Scramble', icon: '\u{1F524}', type: 'dom', blurb: 'Unscramble as many words as you can.', scoreLabel: 'words', higherIsBetter: true, init: initWordScramble },
  { id: 'typing', name: 'Typing Test', icon: '\u{2328}\u{FE0F}', type: 'dom', blurb: 'Type the sentence -- your WPM is the score.', scoreLabel: 'wpm', higherIsBetter: true, init: initTyping },
  { id: 'seqrecall', name: 'Sequence Recall', icon: '\u{1F522}', type: 'dom', blurb: 'Memorize and repeat the growing tile order.', scoreLabel: 'rounds', higherIsBetter: true, init: initSeqRecall },
  { id: 'highlow', name: 'Higher or Lower', icon: '\u{1F0CF}', type: 'dom', blurb: 'Guess if the next card is higher or lower.', scoreLabel: 'streak', higherIsBetter: true, init: initHighLow },
  { id: 'colorflood', name: 'Color Flood', icon: '\u{1F30A}', type: 'dom', blurb: 'Flood the whole board into one color.', scoreLabel: 'moves', higherIsBetter: false, init: initColorFlood },
  { id: 'oddoneout', name: 'Odd One Out', icon: '\u{1F50D}', type: 'dom', blurb: 'Spot the tile that looks different.', scoreLabel: 'rounds', higherIsBetter: true, init: initOddOneOut },
  { id: 'pattern', name: 'Pattern Predictor', icon: '\u{1F9E9}', type: 'dom', blurb: 'What comes next in the sequence?', scoreLabel: 'correct', higherIsBetter: true, init: initPattern },
  { id: 'speedtap', name: 'Speed Tap', icon: '\u{1F446}', type: 'dom', blurb: 'Tap the lit tile as fast as you can.', scoreLabel: 'ms', higherIsBetter: false, init: initSpeedTap },
];
