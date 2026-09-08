// Fifteen quick, fully offline single-player mini-games -- no server, no
// multiplayer state, nothing here ever touches net.js. Reachable from
// Home -> Offline Mini Games. Each game reports a single numeric score
// when it ends; a per-game best score is remembered in the profile
// (see storage.js's miniScores) purely for bragging rights -- none of
// this touches coins or the real economy.
//
// Two shapes of game, both exposing the same init(mount, hooks) ->
// { destroy() } contract:
//   'canvas' games get mount.ctx (a 2D context already sized to
//     CANVAS_W x CANVAS_H) and draw every frame themselves.
//   'dom' games get mount.container (an empty element) and build
//     whatever plain buttons/text they need inside it.
// hooks.onEnd(score) is called exactly once, whenever the game is over
// (win, lose, or timer up) -- the caller (app.js) handles the score
// screen and best-score bookkeeping, not the games themselves.
// hooks.setHud(text) updates the one shared status line above the game.

import { profile, save } from './storage.js';

export const CANVAS_W = 480;
export const CANVAS_H = 320;

export function getBest(id) {
  return profile.miniScores?.[id];
}

/** Records a new best if `value` beats the stored one (or there isn't one
 * yet). Returns true when it's a new best, so the caller can say so. */
export function reportScore(id, value, higherIsBetter) {
  profile.miniScores = profile.miniScores || {};
  const prev = profile.miniScores[id];
  const isBest = prev == null || (higherIsBetter ? value > prev : value < prev);
  if (isBest) {
    profile.miniScores[id] = value;
    save();
  }
  return isBest;
}

function rand(min, max) { return min + Math.random() * (max - min); }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }

// ------------------------------------------------------------- 1. Reaction

function initReaction(mount, hooks) {
  const { container } = mount;
  container.innerHTML = '';
  const box = document.createElement('button');
  box.type = 'button';
  box.className = 'mg-reaction-box';
  box.textContent = 'Wait for green...';
  container.append(box);

  let phase = 'waiting'; // waiting -> armed -> done
  let armedAt = 0;
  let timer = null;

  function arm() {
    phase = 'armed';
    armedAt = performance.now();
    box.classList.add('is-go');
    box.textContent = 'CLICK NOW!';
  }

  timer = setTimeout(arm, rand(1000, 3000));
  hooks.setHud('Click the box the instant it turns green.');

  box.addEventListener('click', () => {
    if (phase === 'waiting') {
      box.textContent = 'Too soon! Wait for green...';
      clearTimeout(timer);
      timer = setTimeout(arm, rand(1000, 3000));
      return;
    }
    if (phase === 'armed') {
      const ms = Math.round(performance.now() - armedAt);
      phase = 'done';
      box.classList.remove('is-go');
      box.textContent = `${ms} ms!`;
      hooks.onEnd(ms);
    }
  });

  return {
    destroy() { clearTimeout(timer); },
  };
}

// ---------------------------------------------------------- 2. Whack-a-Mole

function initWhack(mount, hooks) {
  const { ctx } = mount;
  const cols = 3;
  const rows = 3;
  const cellW = CANVAS_W / cols;
  const cellH = CANVAS_H / rows;
  const holes = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      holes.push({ x: c * cellW + cellW / 2, y: r * cellH + cellH / 2, up: false, upUntil: 0 });
    }
  }

  let score = 0;
  let timeLeft = 20;
  let raf = 0;
  let lastT = performance.now();
  let nextPop = performance.now() + rand(400, 900);
  let ended = false;

  function draw() {
    ctx.fillStyle = '#0d1a2b';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    for (const h of holes) {
      ctx.fillStyle = '#1c2f45';
      ctx.beginPath();
      ctx.ellipse(h.x, h.y + 20, 44, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      if (h.up) {
        ctx.fillStyle = '#8a5a2b';
        ctx.beginPath();
        ctx.ellipse(h.x, h.y, 30, 34, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(h.x - 10, h.y - 8, 4, 0, Math.PI * 2);
        ctx.arc(h.x + 10, h.y - 8, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = '#eef4ff';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${score}`, 12, 26);
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.ceil(timeLeft)}s`, CANVAS_W - 12, 26);
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    if (!ended) {
      timeLeft -= dt;
      if (now >= nextPop) {
        const candidates = holes.filter((h) => !h.up);
        if (candidates.length) {
          const h = pick(candidates);
          h.up = true;
          h.upUntil = now + rand(600, 1000);
        }
        nextPop = now + rand(400, 900);
      }
      for (const h of holes) {
        if (h.up && now >= h.upUntil) h.up = false;
      }
      if (timeLeft <= 0) {
        ended = true;
        hooks.onEnd(score);
      }
    }
    draw();
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  function onClick(e) {
    if (ended) return;
    const rect = e.target.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (CANVAS_W / rect.width);
    const y = (e.clientY - rect.top) * (CANVAS_H / rect.height);
    for (const h of holes) {
      if (h.up && Math.hypot(x - h.x, y - h.y) < 34) {
        h.up = false;
        score++;
        break;
      }
    }
  }
  mount.canvas.addEventListener('click', onClick);
  hooks.setHud('Click the moles before they duck -- 20 seconds.');

  return {
    destroy() {
      cancelAnimationFrame(raf);
      mount.canvas.removeEventListener('click', onClick);
    },
  };
}

// ----------------------------------------------------------- 3. Memory Match

function initMemory(mount, hooks) {
  const { container } = mount;
  container.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'mg-memory-grid';
  container.append(grid);

  const symbols = ['\u{1F438}', '\u{1F995}', '\u{1F419}', '\u{1F42C}', '\u{1F98A}', '\u{1F43C}', '\u{1F994}', '\u{1F42D}'];
  const deck = [...symbols, ...symbols];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  let moves = 0;
  let matched = 0;
  let locked = false;
  let first = null;
  const cards = [];

  deck.forEach((symbol, i) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'mg-memory-card';
    card.textContent = '?';
    card.addEventListener('click', () => flip(i));
    grid.append(card);
    cards.push({ el: card, symbol, open: false, done: false });
  });

  function flip(i) {
    const c = cards[i];
    if (locked || c.open || c.done) return;
    c.open = true;
    c.el.textContent = c.symbol;
    c.el.classList.add('is-open');

    if (first == null) {
      first = i;
      return;
    }
    moves++;
    const a = cards[first];
    const b = cards[i];
    if (a.symbol === b.symbol && first !== i) {
      a.done = true;
      b.done = true;
      a.el.classList.add('is-matched');
      b.el.classList.add('is-matched');
      matched += 1;
      first = null;
      if (matched === symbols.length) hooks.onEnd(moves);
    } else {
      locked = true;
      first = null;
      setTimeout(() => {
        a.open = false;
        b.open = false;
        a.el.textContent = '?';
        b.el.textContent = '?';
        a.el.classList.remove('is-open');
        b.el.classList.remove('is-open');
        locked = false;
      }, 650);
    }
  }

  hooks.setHud('Find every matching pair -- fewer moves is better.');
  return { destroy() {} };
}

// ------------------------------------------------------------- 4. Simon Says

function initSimon(mount, hooks) {
  const { container } = mount;
  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'mg-simon-grid';
  container.append(wrap);

  const colors = ['red', 'blue', 'green', 'yellow'];
  const pads = colors.map((color) => {
    const pad = document.createElement('button');
    pad.type = 'button';
    pad.className = `mg-simon-pad mg-simon-${color}`;
    wrap.append(pad);
    return pad;
  });

  let sequence = [];
  let playerIndex = 0;
  let accepting = false;
  let round = 0;
  let timers = [];
  const schedule = (fn, ms) => timers.push(setTimeout(fn, ms));

  function flash(i, ms = 350) {
    pads[i].classList.add('is-lit');
    setTimeout(() => pads[i].classList.remove('is-lit'), ms - 60);
  }

  function playSequence() {
    accepting = false;
    playerIndex = 0;
    sequence.forEach((idx, step) => schedule(() => flash(idx), 500 * step + 400));
    schedule(() => { accepting = true; }, 500 * sequence.length + 500);
  }

  function nextRound() {
    round++;
    sequence.push(randInt(0, 3));
    hooks.setHud(`Round ${round} -- watch, then repeat.`);
    playSequence();
  }

  pads.forEach((pad, i) => {
    pad.addEventListener('click', () => {
      if (!accepting) return;
      flash(i, 250);
      if (sequence[playerIndex] !== i) {
        accepting = false;
        hooks.onEnd(round - 1);
        return;
      }
      playerIndex++;
      if (playerIndex === sequence.length) {
        accepting = false;
        schedule(nextRound, 500);
      }
    });
  });

  nextRound();

  return {
    destroy() { for (const t of timers) clearTimeout(t); },
  };
}

// ------------------------------------------------------------------ 5. Snake

function initSnake(mount, hooks) {
  const { ctx } = mount;
  const cell = 20;
  const cols = CANVAS_W / cell;
  const rows = CANVAS_H / cell;

  let snake = [{ x: 8, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 8 }];
  let dir = { x: 1, y: 0 };
  let nextDir = dir;
  let food = spawnFood();
  let ended = false;

  function spawnFood() {
    let f;
    do {
      f = { x: randInt(0, cols - 1), y: randInt(0, rows - 1) };
    } while (snake.some((s) => s.x === f.x && s.y === f.y));
    return f;
  }

  function draw() {
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(food.x * cell + 2, food.y * cell + 2, cell - 4, cell - 4);
    ctx.fillStyle = '#4ff08a';
    snake.forEach((s, i) => {
      ctx.globalAlpha = i === 0 ? 1 : 0.85;
      ctx.fillRect(s.x * cell + 1, s.y * cell + 1, cell - 2, cell - 2);
    });
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#eef4ff';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Length: ${snake.length}`, 10, 22);
  }

  function tick() {
    if (ended) return;
    dir = nextDir;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    const hitWall = head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows;
    const hitSelf = snake.some((s) => s.x === head.x && s.y === head.y);
    if (hitWall || hitSelf) {
      ended = true;
      draw();
      hooks.onEnd(snake.length);
      return;
    }
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      food = spawnFood();
    } else {
      snake.pop();
    }
    draw();
  }

  function onKey(e) {
    const map = {
      ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 }, ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
      KeyW: { x: 0, y: -1 }, KeyS: { x: 0, y: 1 }, KeyA: { x: -1, y: 0 }, KeyD: { x: 1, y: 0 },
    };
    const d = map[e.code];
    if (!d) return;
    e.preventDefault();
    if (d.x === -dir.x && d.y === -dir.y) return; // no instant reverse
    nextDir = d;
  }
  window.addEventListener('keydown', onKey);

  draw();
  hooks.setHud('Arrow keys / WASD to steer. Eat the gold square, avoid the walls and yourself.');
  const interval = setInterval(tick, 120);

  return {
    destroy() {
      clearInterval(interval);
      window.removeEventListener('keydown', onKey);
    },
  };
}

// -------------------------------------------------------------- 6. Flappy

function initFlappy(mount, hooks) {
  const { ctx, canvas } = mount;
  const bird = { x: 80, y: CANVAS_H / 2, vy: 0 };
  const GRAVITY = 900;
  const FLAP = -300;
  const GAP = 130;
  const PIPE_W = 50;
  const SPEED = 160;
  let pipes = [{ x: CANVAS_W + 40, gapY: rand(80, CANVAS_H - 80) }];
  let score = 0;
  let ended = false;
  let raf = 0;
  let lastT = performance.now();

  function flap() {
    if (ended) return;
    bird.vy = FLAP;
  }

  function draw() {
    ctx.fillStyle = '#1c2f45';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#4ff08a';
    for (const p of pipes) {
      ctx.fillRect(p.x, 0, PIPE_W, p.gapY - GAP / 2);
      ctx.fillRect(p.x, p.gapY + GAP / 2, PIPE_W, CANVAS_H - (p.gapY + GAP / 2));
    }
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(bird.x, bird.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#eef4ff';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${score}`, CANVAS_W / 2, 34);
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    if (!ended) {
      bird.vy += GRAVITY * dt;
      bird.y += bird.vy * dt;
      for (const p of pipes) {
        p.x -= SPEED * dt;
        if (!p.passed && p.x + PIPE_W < bird.x) {
          p.passed = true;
          score++;
        }
      }
      if (pipes[pipes.length - 1].x < CANVAS_W - 220) {
        pipes.push({ x: CANVAS_W + 20, gapY: rand(80, CANVAS_H - 80) });
      }
      pipes = pipes.filter((p) => p.x + PIPE_W > -10);

      const hitBounds = bird.y < 0 || bird.y > CANVAS_H;
      const hitPipe = pipes.some((p) => bird.x + 14 > p.x && bird.x - 14 < p.x + PIPE_W
        && (bird.y - 14 < p.gapY - GAP / 2 || bird.y + 14 > p.gapY + GAP / 2));
      if (hitBounds || hitPipe) {
        ended = true;
        hooks.onEnd(score);
      }
    }
    draw();
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  function onKey(e) {
    if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); flap(); }
  }
  window.addEventListener('keydown', onKey);
  canvas.addEventListener('pointerdown', flap);
  hooks.setHud('Space, tap, or click to flap through the gaps.');

  return {
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      canvas.removeEventListener('pointerdown', flap);
    },
  };
}

// -------------------------------------------------- 7. Rock Paper Scissors

function initRPS(mount, hooks) {
  const { container } = mount;
  container.innerHTML = '';
  const options = [
    { id: 'rock', icon: '✊', beats: 'scissors' },
    { id: 'paper', icon: '\u{1F590}️', beats: 'rock' },
    { id: 'scissors', icon: '✌️', beats: 'paper' },
  ];

  const status = document.createElement('div');
  status.className = 'mg-rps-status';
  status.textContent = 'Best of 5 -- pick your move.';
  const scoreLine = document.createElement('div');
  scoreLine.className = 'mg-rps-score';
  const row = document.createElement('div');
  row.className = 'mg-rps-row';
  container.append(status, scoreLine, row);

  let wins = 0;
  let losses = 0;
  let round = 0;
  let ended = false;

  function updateScore() {
    scoreLine.textContent = `You ${wins} -- ${losses} CPU`;
  }
  updateScore();

  options.forEach((opt) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-small mg-rps-btn';
    btn.textContent = opt.icon;
    btn.addEventListener('click', () => {
      if (ended) return;
      const cpu = pick(options);
      round++;
      let result;
      if (cpu.id === opt.id) result = 'Draw!';
      else if (opt.beats === cpu.id) { wins++; result = 'You win this round!'; }
      else { losses++; result = 'CPU wins this round!'; }
      status.textContent = `You: ${opt.icon}  CPU: ${cpu.icon} -- ${result}`;
      updateScore();
      if (round >= 5) {
        ended = true;
        hooks.onEnd(wins);
      }
    });
    row.append(btn);
  });

  hooks.setHud('Rock beats scissors, scissors beats paper, paper beats rock.');
  return { destroy() {} };
}

// -------------------------------------------------------- 8. Number Guess

function initGuess(mount, hooks) {
  const { container } = mount;
  container.innerHTML = '';
  const secret = randInt(1, 100);
  let guesses = 0;
  let ended = false;

  const status = document.createElement('div');
  status.className = 'mg-guess-status';
  status.textContent = 'Guess a number between 1 and 100.';
  const row = document.createElement('div');
  row.className = 'mg-guess-row';
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '1';
  input.max = '100';
  input.className = 'text-input mg-guess-input';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-primary';
  btn.textContent = 'Guess';
  row.append(input, btn);
  container.append(status, row);

  function submit() {
    if (ended) return;
    const value = Number(input.value);
    if (!Number.isFinite(value) || value < 1 || value > 100) return;
    guesses++;
    if (value === secret) {
      status.textContent = `Correct! It was ${secret}, in ${guesses} guess${guesses === 1 ? '' : 'es'}.`;
      ended = true;
      hooks.onEnd(guesses);
    } else {
      status.textContent = value < secret ? 'Higher!' : 'Lower!';
    }
    input.value = '';
    input.focus();
  }
  btn.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });

  hooks.setHud('Higher/lower hints after every guess -- fewer guesses is better.');
  return { destroy() {} };
}

// -------------------------------------------------------- 9. Tic-Tac-Toe

function initTicTacToe(mount, hooks) {
  const { container } = mount;
  container.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'mg-ttt-grid';
  container.append(grid);
  const status = document.createElement('div');
  status.className = 'mg-ttt-status';
  container.append(status);

  const board = Array(9).fill(null);
  const cells = board.map((_, i) => {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'mg-ttt-cell';
    cell.addEventListener('click', () => playerMove(i));
    grid.append(cell);
    return cell;
  });

  const LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];
  let ended = false;

  function winner(b) {
    for (const [a, c, d] of LINES) {
      if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
    }
    return b.every((v) => v) ? 'draw' : null;
  }

  function render() {
    board.forEach((v, i) => { cells[i].textContent = v || ''; cells[i].disabled = !!v || ended; });
  }

  function finish(result) {
    ended = true;
    render();
    if (result === 'X') { status.textContent = 'You win!'; hooks.onEnd(2); }
    else if (result === 'draw') { status.textContent = "It's a draw."; hooks.onEnd(1); }
    else { status.textContent = 'The CPU wins.'; hooks.onEnd(0); }
  }

  function cpuMove() {
    const empty = board.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
    // Win if possible, else block, else take center/corner/random.
    for (const i of empty) {
      const copy = [...board]; copy[i] = 'O';
      if (winner(copy) === 'O') { board[i] = 'O'; return; }
    }
    for (const i of empty) {
      const copy = [...board]; copy[i] = 'X';
      if (winner(copy) === 'X') { board[i] = 'O'; return; }
    }
    const preferred = [4, 0, 2, 6, 8].filter((i) => empty.includes(i));
    board[preferred.length ? preferred[0] : pick(empty)] = 'O';
  }

  function playerMove(i) {
    if (ended || board[i]) return;
    board[i] = 'X';
    const w = winner(board);
    if (w) { finish(w); return; }
    cpuMove();
    render();
    const w2 = winner(board);
    if (w2) finish(w2);
  }

  render();
  hooks.setHud("You're X, the computer is O. Get three in a row.");
  return { destroy() {} };
}

// -------------------------------------------------------------------- 10. 2048

function init2048(mount, hooks) {
  const { ctx } = mount;
  const size = 4;
  const cell = 63;
  const gap = 6;
  const boardPx = size * cell + (size + 1) * gap;
  const ox = (CANVAS_W - boardPx) / 2;
  // Fixed (not centered) top margin, clear of the score line drawn above
  // the board -- boardPx is tall enough that centering it vertically would
  // push its top edge up under that text.
  const oy = 36;
  let grid = Array.from({ length: size }, () => Array(size).fill(0));
  let score = 0;
  let ended = false;

  function emptyCells() {
    const cells = [];
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (!grid[r][c]) cells.push([r, c]);
    return cells;
  }
  function spawnTile() {
    const cells = emptyCells();
    if (!cells.length) return;
    const [r, c] = pick(cells);
    grid[r][c] = Math.random() < 0.9 ? 2 : 4;
  }
  spawnTile();
  spawnTile();

  function slideRow(row) {
    const vals = row.filter((v) => v);
    const merged = [];
    for (let i = 0; i < vals.length; i++) {
      if (i < vals.length - 1 && vals[i] === vals[i + 1]) {
        const v = vals[i] * 2;
        merged.push(v);
        score += v;
        i++;
      } else {
        merged.push(vals[i]);
      }
    }
    while (merged.length < size) merged.push(0);
    return merged;
  }

  function transpose(g) {
    const out = Array.from({ length: size }, () => Array(size).fill(0));
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) out[c][r] = g[r][c];
    return out;
  }
  function reverseRows(g) { return g.map((row) => [...row].reverse()); }

  function move(dir) {
    if (ended) return;
    // Every direction normalizes to "slide left" (slideRow's own direction)
    // via transpose (turns up/down into left/right) and row-reversal (turns
    // right/down into left/up) -- the standard, easy-to-verify way to reuse
    // one slide function for all four directions instead of four
    // hand-written variants.
    const transposed = dir === 'up' || dir === 'down';
    const reversed = dir === 'right' || dir === 'down';
    let g = grid;
    if (transposed) g = transpose(g);
    if (reversed) g = reverseRows(g);
    const before = JSON.stringify(g);
    g = g.map(slideRow);
    const changed = JSON.stringify(g) !== before;
    if (reversed) g = reverseRows(g);
    if (transposed) g = transpose(g);
    grid = g;
    if (changed) {
      spawnTile();
      if (!emptyCells().length && !anyMovePossible()) {
        ended = true;
        hooks.onEnd(score);
      }
    }
    draw();
  }

  function anyMovePossible() {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const v = grid[r][c];
        if (c < size - 1 && grid[r][c + 1] === v) return true;
        if (r < size - 1 && grid[r + 1][c] === v) return true;
      }
    }
    return false;
  }

  const COLORS = {
    0: '#1c2340', 2: '#3b6fed', 4: '#4d7fff', 8: '#4cc9f0', 16: '#4ff08a', 32: '#61c46b',
    64: '#ffd166', 128: '#ffb347', 256: '#ff8c3a', 512: '#ff6a1f', 1024: '#ff4d6d', 2048: '#ffd700',
  };

  function draw() {
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const v = grid[r][c];
        const x = ox + gap + c * (cell + gap);
        const y = oy + gap + r * (cell + gap);
        ctx.fillStyle = COLORS[v] || '#ff4d6d';
        ctx.fillRect(x, y, cell, cell);
        if (v) {
          ctx.fillStyle = v <= 4 ? '#0b1220' : '#fff';
          ctx.font = 'bold 26px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(v), x + cell / 2, y + cell / 2 + 2);
        }
      }
    }
    ctx.fillStyle = '#eef4ff';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`Score: ${score}`, 10, 22);
  }

  function onKey(e) {
    const map = {
      ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
      KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down',
    };
    if (map[e.code]) { e.preventDefault(); move(map[e.code]); }
  }
  window.addEventListener('keydown', onKey);

  draw();
  hooks.setHud('Arrow keys / WASD to slide. Merge matching tiles to reach 2048.');

  return { destroy() { window.removeEventListener('keydown', onKey); } };
}

// -------------------------------------------------------------- 11. Breakout

function initBreakout(mount, hooks) {
  const { ctx, canvas } = mount;
  const paddle = { w: 80, h: 12, x: CANVAS_W / 2 - 40, y: CANVAS_H - 26 };
  const ball = { x: CANVAS_W / 2, y: CANVAS_H - 40, vx: 160, vy: -220, r: 7 };
  const cols = 8;
  const rowsN = 4;
  const brickW = CANVAS_W / cols;
  const brickH = 20;
  const bricks = [];
  for (let r = 0; r < rowsN; r++) {
    for (let c = 0; c < cols; c++) {
      bricks.push({ x: c * brickW, y: 30 + r * brickH, alive: true });
    }
  }
  let destroyed = 0;
  let lives = 3;
  let ended = false;
  let raf = 0;
  let lastT = performance.now();
  const keys = { left: false, right: false };

  function draw() {
    ctx.fillStyle = '#12091f';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    for (const b of bricks) {
      if (!b.alive) continue;
      ctx.fillStyle = '#a06bff';
      ctx.fillRect(b.x + 2, b.y + 2, brickW - 4, brickH - 4);
    }
    ctx.fillStyle = '#4cc9f0';
    ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#eef4ff';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Bricks: ${destroyed}/${bricks.length}`, 10, 20);
    ctx.textAlign = 'right';
    ctx.fillText(`Lives: ${lives}`, CANVAS_W - 10, 20);
  }

  function loop(now) {
    const dt = Math.min(0.02, (now - lastT) / 1000);
    lastT = now;
    if (!ended) {
      if (keys.left) paddle.x -= 320 * dt;
      if (keys.right) paddle.x += 320 * dt;
      paddle.x = clamp(paddle.x, 0, CANVAS_W - paddle.w);

      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      if (ball.x < ball.r || ball.x > CANVAS_W - ball.r) ball.vx *= -1;
      if (ball.y < ball.r) ball.vy *= -1;
      if (ball.y > paddle.y - ball.r && ball.y < paddle.y + paddle.h
        && ball.x > paddle.x && ball.x < paddle.x + paddle.w && ball.vy > 0) {
        ball.vy *= -1;
        const hitPos = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
        ball.vx = hitPos * 220;
      }
      for (const b of bricks) {
        if (!b.alive) continue;
        if (ball.x > b.x && ball.x < b.x + brickW && ball.y - ball.r < b.y + brickH && ball.y + ball.r > b.y) {
          b.alive = false;
          destroyed++;
          ball.vy *= -1;
          break;
        }
      }
      if (ball.y > CANVAS_H) {
        lives--;
        if (lives <= 0) {
          ended = true;
          hooks.onEnd(destroyed);
        } else {
          ball.x = CANVAS_W / 2; ball.y = CANVAS_H - 40; ball.vx = 160; ball.vy = -220;
        }
      }
      if (destroyed === bricks.length) {
        ended = true;
        hooks.onEnd(destroyed);
      }
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
    const x = (e.clientX - rect.left) * (CANVAS_W / rect.width);
    paddle.x = clamp(x - paddle.w / 2, 0, CANVAS_W - paddle.w);
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointermove', onPointerMove);
  hooks.setHud('Arrow keys or mouse to move the paddle. Clear every brick.');

  return {
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('pointermove', onPointerMove);
    },
  };
}

// ---------------------------------------------------------- 12. Dodge Blocks

function initDodge(mount, hooks) {
  const { ctx, canvas } = mount;
  const player = { w: 30, h: 30, x: CANVAS_W / 2 - 15, y: CANVAS_H - 40 };
  let blocks = [];
  let survived = 0;
  let ended = false;
  let raf = 0;
  let lastT = performance.now();
  let nextSpawn = 0;
  const keys = { left: false, right: false };

  function draw() {
    ctx.fillStyle = '#0d1a2b';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#ff4d6d';
    for (const b of blocks) ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#4ff08a';
    ctx.fillRect(player.x, player.y, player.w, player.h);
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
      if (keys.left) player.x -= 260 * dt;
      if (keys.right) player.x += 260 * dt;
      player.x = clamp(player.x, 0, CANVAS_W - player.w);

      const speed = 120 + survived * 8;
      if (now >= nextSpawn) {
        const w = rand(24, 60);
        blocks.push({ x: rand(0, CANVAS_W - w), y: -30, w, h: 22 });
        nextSpawn = now + Math.max(220, 700 - survived * 15);
      }
      for (const b of blocks) b.y += speed * dt;
      blocks = blocks.filter((b) => b.y < CANVAS_H + 40);

      const hit = blocks.some((b) => player.x < b.x + b.w && player.x + player.w > b.x
        && player.y < b.y + b.h && player.y + player.h > b.y);
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
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { e.preventDefault(); keys.left = true; }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') { e.preventDefault(); keys.right = true; }
  }
  function onKeyUp(e) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
  }
  function onPointerMove(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (CANVAS_W / rect.width);
    player.x = clamp(x - player.w / 2, 0, CANVAS_W - player.w);
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointermove', onPointerMove);
  hooks.setHud('Arrow keys or mouse to dodge -- survive as long as you can.');

  return {
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('pointermove', onPointerMove);
    },
  };
}

// ------------------------------------------------------------ 13. Color Match

function initColorMatch(mount, hooks) {
  const { container } = mount;
  container.innerHTML = '';
  const COLORS = [
    { name: 'RED', hex: '#ff4d6d' }, { name: 'BLUE', hex: '#4d7fff' },
    { name: 'GREEN', hex: '#4ff08a' }, { name: 'YELLOW', hex: '#ffd166' },
  ];

  const word = document.createElement('div');
  word.className = 'mg-colorword';
  const row = document.createElement('div');
  row.className = 'mg-color-row';
  container.append(word, row);

  let score = 0;
  let timeLeft = 30;
  let ended = false;
  let current = null;
  let interval = null;

  const buttons = COLORS.map((c) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn mg-color-btn';
    btn.style.background = c.hex;
    btn.addEventListener('click', () => {
      if (ended) return;
      if (c.hex === current.hex) score++;
      nextWord();
    });
    row.append(btn);
    return btn;
  });

  function nextWord() {
    const textColor = pick(COLORS);
    const inkColor = pick(COLORS);
    current = inkColor;
    word.textContent = textColor.name;
    word.style.color = inkColor.hex;
  }
  nextWord();

  hooks.setHud(`Tap the button matching the ink color, not the word -- ${timeLeft}s.`);
  interval = setInterval(() => {
    timeLeft--;
    hooks.setHud(`Tap the button matching the ink color, not the word -- ${timeLeft}s.`);
    if (timeLeft <= 0) {
      ended = true;
      clearInterval(interval);
      buttons.forEach((b) => { b.disabled = true; });
      hooks.onEnd(score);
    }
  }, 1000);

  return { destroy() { clearInterval(interval); } };
}

// ------------------------------------------------------------- 14. Math Blitz

function initMathBlitz(mount, hooks) {
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

  let score = 0;
  let timeLeft = 30;
  let ended = false;
  let answer = 0;

  function nextProblem() {
    const ops = ['+', '-', '×'];
    const op = pick(ops);
    let a = randInt(2, 12);
    let b = randInt(2, 12);
    if (op === '-' && b > a) [a, b] = [b, a];
    answer = op === '+' ? a + b : op === '-' ? a - b : a * b;
    problem.textContent = `${a} ${op} ${b} = ?`;
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

  hooks.setHud(`Solve as many as you can -- ${timeLeft}s.`);
  const interval = setInterval(() => {
    timeLeft--;
    hooks.setHud(`Solve as many as you can -- ${timeLeft}s.`);
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

// -------------------------------------------------------------- 15. Catcher

function initCatcher(mount, hooks) {
  const { ctx, canvas } = mount;
  const basket = { w: 60, h: 16, x: CANVAS_W / 2 - 30, y: CANVAS_H - 30 };
  let items = [];
  let score = 0;
  let elapsed = 0;
  let ended = false;
  let raf = 0;
  let lastT = performance.now();
  let nextSpawn = 0;
  const keys = { left: false, right: false };

  function draw() {
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    for (const it of items) {
      ctx.fillStyle = it.bomb ? '#333' : '#ffd166';
      ctx.beginPath();
      ctx.arc(it.x, it.y, it.r, 0, Math.PI * 2);
      ctx.fill();
      if (it.bomb) {
        ctx.fillStyle = '#ff4d6d';
        ctx.font = 'bold 14px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('!', it.x, it.y + 5);
      }
    }
    ctx.fillStyle = '#4d7fff';
    ctx.fillRect(basket.x, basket.y, basket.w, basket.h);
    ctx.fillStyle = '#eef4ff';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Coins: ${score}`, 10, 26);
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    if (!ended) {
      elapsed += dt;
      if (keys.left) basket.x -= 280 * dt;
      if (keys.right) basket.x += 280 * dt;
      basket.x = clamp(basket.x, 0, CANVAS_W - basket.w);

      const speed = 130 + elapsed * 6;
      if (now >= nextSpawn) {
        items.push({ x: rand(20, CANVAS_W - 20), y: -10, r: 12, bomb: Math.random() < 0.22 });
        nextSpawn = now + Math.max(280, 800 - elapsed * 12);
      }
      for (const it of items) it.y += speed * dt;

      const caught = items.filter((it) => it.y + it.r > basket.y && it.y - it.r < basket.y + basket.h
        && it.x > basket.x && it.x < basket.x + basket.w);
      for (const it of caught) {
        if (it.bomb) {
          ended = true;
          hooks.onEnd(score);
        } else {
          score++;
        }
      }
      items = items.filter((it) => !caught.includes(it) && it.y < CANVAS_H + 20);
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
    const x = (e.clientX - rect.left) * (CANVAS_W / rect.width);
    basket.x = clamp(x - basket.w / 2, 0, CANVAS_W - basket.w);
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointermove', onPointerMove);
  hooks.setHud('Catch the gold coins, dodge the bombs.');

  return {
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('pointermove', onPointerMove);
    },
  };
}

// ----------------------------------------------------------------- registry

export const GAMES = [
  { id: 'reaction', name: 'Reaction Test', icon: '⚡', type: 'dom', blurb: 'Click the instant it turns green.', scoreLabel: 'ms', higherIsBetter: false, init: initReaction },
  { id: 'whack', name: 'Whack-a-Mole', icon: '\u{1F528}', type: 'canvas', blurb: 'Smack moles before they duck -- 20s.', scoreLabel: 'hits', higherIsBetter: true, init: initWhack },
  { id: 'memory', name: 'Memory Match', icon: '\u{1F9E0}', type: 'dom', blurb: 'Find every matching pair.', scoreLabel: 'moves', higherIsBetter: false, init: initMemory },
  { id: 'simon', name: 'Simon Says', icon: '\u{1F3B5}', type: 'dom', blurb: 'Watch, then repeat the growing pattern.', scoreLabel: 'rounds', higherIsBetter: true, init: initSimon },
  { id: 'snake', name: 'Snake', icon: '\u{1F40D}', type: 'canvas', blurb: "Eat, grow, don't hit yourself.", scoreLabel: 'length', higherIsBetter: true, init: initSnake },
  { id: 'flappy', name: 'Flappy Blob', icon: '\u{1F424}', type: 'canvas', blurb: 'Tap to flap through the gaps.', scoreLabel: 'pipes', higherIsBetter: true, init: initFlappy },
  { id: 'rps', name: 'Rock Paper Scissors', icon: '✊', type: 'dom', blurb: 'Best of 5 against the computer.', scoreLabel: 'wins', higherIsBetter: true, init: initRPS },
  { id: 'guess', name: 'Number Guess', icon: '\u{1F522}', type: 'dom', blurb: 'Find the secret number, 1-100.', scoreLabel: 'guesses', higherIsBetter: false, init: initGuess },
  { id: 'tictactoe', name: 'Tic-Tac-Toe', icon: '⭕', type: 'dom', blurb: 'Beat the computer -- if you can.', scoreLabel: 'result', higherIsBetter: true, init: initTicTacToe },
  { id: '2048', name: '2048', icon: '\u{1F536}', type: 'canvas', blurb: 'Slide and merge to reach 2048.', scoreLabel: 'points', higherIsBetter: true, init: init2048 },
  { id: 'breakout', name: 'Brick Breaker', icon: '\u{1F9F1}', type: 'canvas', blurb: 'Clear every brick, 3 lives.', scoreLabel: 'bricks', higherIsBetter: true, init: initBreakout },
  { id: 'dodge', name: 'Dodge the Blocks', icon: '\u{1F6A7}', type: 'canvas', blurb: 'Survive the falling blocks.', scoreLabel: 'seconds', higherIsBetter: true, init: initDodge },
  { id: 'colormatch', name: 'Color Match', icon: '\u{1F3A8}', type: 'dom', blurb: 'Tap the ink color, not the word -- 30s.', scoreLabel: 'correct', higherIsBetter: true, init: initColorMatch },
  { id: 'mathblitz', name: 'Math Blitz', icon: '➕', type: 'dom', blurb: 'Solve as many as you can -- 30s.', scoreLabel: 'correct', higherIsBetter: true, init: initMathBlitz },
  { id: 'catcher', name: 'Coin Catcher', icon: '\u{1FA99}', type: 'canvas', blurb: 'Catch coins, dodge bombs.', scoreLabel: 'coins', higherIsBetter: true, init: initCatcher },
];
export const GAME_BY_ID = Object.fromEntries(GAMES.map((g) => [g.id, g]));

let activeHandle = null;

/** Mount and start one game. `mount` is { canvas, ctx, container } -- the
 * caller (app.js) owns showing/hiding the right element for the game's
 * `type` before calling this. Stops whatever was running first, so it's
 * safe to call again without an explicit stopGame() in between. */
export function startGame(id, mount, hooks) {
  stopGame();
  const game = GAME_BY_ID[id];
  if (!game) return null;
  activeHandle = game.init(mount, hooks);
  return game;
}

/** Tears down the currently-running game's listeners/timers, if any. Safe
 * to call even when nothing is running. */
export function stopGame() {
  if (activeHandle?.destroy) activeHandle.destroy();
  activeHandle = null;
}
