// Shared plumbing for the Offline Mini Games hub: canvas size, small math
// helpers, the five-tier difficulty system, per-game/per-difficulty best
// score bookkeeping, and the mount/teardown harness. Split out of
// minigames.js so the original 15 games and the 30 added later
// (minigames2.js) can both depend on this without importing each other.
//
// Every game exposes init(mount, hooks, difficulty) -> { destroy() }.
// `difficulty` is one of DIFFICULTIES. hooks.onEnd(score) is called
// exactly once when the game is over; the host (app.js) owns the score
// screen and best-score bookkeeping via getBest()/reportScore(), not the
// games themselves.

import { profile, save } from './storage.js';

export const CANVAS_W = 480;
export const CANVAS_H = 320;

export function rand(min, max) { return min + Math.random() * (max - min); }
export function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
export function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
export function pick(arr) { return arr[randInt(0, arr.length - 1)]; }

// ------------------------------------------------------------- difficulty

export const DIFFICULTIES = ['veryeasy', 'easy', 'medium', 'hard', 'superhard'];
export const DIFFICULTY_META = {
  veryeasy: { label: 'Very Easy', btnClass: 'btn-teal' },
  easy: { label: 'Easy', btnClass: 'btn-cyan' },
  medium: { label: 'Medium', btnClass: 'btn-primary' },
  hard: { label: 'Hard', btnClass: 'btn-gold' },
  superhard: { label: 'Super Hard', btnClass: 'btn-danger' },
};

/** Index (0-4) of a difficulty id for indexing tuning arrays. Falls back
 * to Medium (2) for anything unrecognized rather than throwing. */
export function diffIdx(difficulty) {
  const i = DIFFICULTIES.indexOf(difficulty);
  return i < 0 ? 2 : i;
}

// ------------------------------------------------------------ best scores

export function getBest(id, difficulty) {
  return profile.miniScores?.[id]?.[difficulty];
}

/** The single best score across every difficulty this game has been
 * played at, plus which difficulty it happened on -- used for the quick
 * glance on the hub card, before drilling into a specific difficulty. */
export function getBestOverall(id, higherIsBetter) {
  const scores = profile.miniScores?.[id];
  if (!scores) return null;
  let value = null;
  let difficulty = null;
  for (const d of DIFFICULTIES) {
    const v = scores[d];
    if (v == null) continue;
    if (value == null || (higherIsBetter ? v > value : v < value)) {
      value = v;
      difficulty = d;
    }
  }
  return value == null ? null : { value, difficulty };
}

/** Records a new best for this game+difficulty if `value` beats the
 * stored one (or there isn't one yet). Returns true on a new best. */
export function reportScore(id, difficulty, value, higherIsBetter) {
  profile.miniScores = profile.miniScores || {};
  profile.miniScores[id] = profile.miniScores[id] || {};
  const prev = profile.miniScores[id][difficulty];
  const isBest = prev == null || (higherIsBetter ? value > prev : value < prev);
  if (isBest) {
    profile.miniScores[id][difficulty] = value;
    save();
  }
  return isBest;
}

// ----------------------------------------------------------------- harness

export let GAMES = [];
export let GAME_BY_ID = {};

/** Combines every game source's own GAMES array into the one registry the
 * hub renders from. Called once at startup (app.js) after importing both
 * minigames.js and minigames2.js, so neither of those has to import the
 * other (or this module's registry) to know about the full game list. */
export function registerGames(list) {
  GAMES = list;
  GAME_BY_ID = Object.fromEntries(list.map((g) => [g.id, g]));
}

let activeHandle = null;

/** Mount and start one game. `mount` is { canvas, ctx, container } -- the
 * caller (app.js) owns showing/hiding the right element for the game's
 * `type` before calling this. Stops whatever was running first, so it's
 * safe to call again without an explicit stopGame() in between. */
export function startGame(id, mount, hooks, difficulty) {
  stopGame();
  const game = GAME_BY_ID[id];
  if (!game) return null;
  activeHandle = game.init(mount, hooks, difficulty || 'medium');
  return game;
}

/** Tears down the currently-running game's listeners/timers, if any. Safe
 * to call even when nothing is running. */
export function stopGame() {
  if (activeHandle?.destroy) activeHandle.destroy();
  activeHandle = null;
}
