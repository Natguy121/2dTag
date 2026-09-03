// Bot brains. Bots are ordinary players from the simulation's point of view --
// they just produce an input bitmask every tick instead of receiving one over
// the network, so they obey the same physics as everyone else.

import * as C from '../shared/constants.js';
import { PLATFORM_H } from '../shared/maps.js';
import { IN_LEFT, IN_RIGHT, IN_JUMP, IN_DOWN } from '../shared/physics.js';

export const DIFFICULTIES = {
  easy:   { react: 0.34, accuracy: 0.62, jumpiness: 0.5, threat: 260, panic: 0.55 },
  normal: { react: 0.20, accuracy: 0.80, jumpiness: 0.7, threat: 340, panic: 0.75 },
  hard:   { react: 0.11, accuracy: 0.93, jumpiness: 0.9, threat: 430, panic: 0.92 },
};

export function createBrain(difficulty = 'normal') {
  const d = DIFFICULTIES[difficulty] || DIFFICULTIES.normal;
  return {
    cfg: d,
    think: 0,
    dir: Math.random() < 0.5 ? -1 : 1,
    targetId: null,
    wantJump: false,
    wantDown: false,
    stuck: 0,
    lastX: 0,
    unstickTimer: 0,
    detour: 0,
    jumpHold: 0,
    roamX: null,
  };
}

function solidAt(map, x, y) {
  for (const s of map.solids) {
    if (x >= s[0] && x <= s[0] + s[2] && y >= s[1] && y <= s[1] + s[3]) return true;
  }
  return false;
}

// Distance down to the nearest standable surface, or Infinity if it is a pit.
function dropBelow(map, x, y, maxDist = 220) {
  let best = Infinity;
  for (const s of map.solids) {
    if (x < s[0] || x > s[0] + s[2]) continue;
    if (s[1] >= y) best = Math.min(best, s[1] - y);
  }
  for (const p of map.platforms) {
    if (x < p[0] || x > p[0] + p[2]) continue;
    if (p[1] >= y) best = Math.min(best, p[1] - y);
  }
  return best > maxDist ? Infinity : best;
}

// True if landing in this column means lava or the void.
function unsafeColumn(map, x, y) {
  for (const h of map.hazards || []) {
    if (x >= h[0] - 8 && x <= h[0] + h[2] + 8 && h[1] >= y - 60) return true;
  }
  return dropBelow(map, x, y, 420) === Infinity;
}

// Nearest horizontal offset that lands on something safe, or 0 if we are fine.
function safeSteer(map, x, y, range = 300) {
  if (!unsafeColumn(map, x, y)) return 0;
  for (let d = 24; d <= range; d += 24) {
    if (!unsafeColumn(map, x + d, y)) return 1;
    if (!unsafeColumn(map, x - d, y)) return -1;
  }
  return 0;
}

function platformAbove(map, x, y, maxUp = 200) {
  let best = null;
  for (const p of map.platforms) {
    if (x < p[0] - 30 || x > p[0] + p[2] + 30) continue;
    const dy = y - (p[1] + PLATFORM_H);
    if (dy > 0 && dy < maxUp && (!best || dy < best.dy)) best = { dy, p };
  }
  return best;
}

/**
 * Decide this bot's input for the current tick.
 * `self` and `others` are room player objects; returns an input bitmask.
 */
export function think(self, others, map, dt, state) {
  const brain = self.ai;
  const cfg = brain.cfg;
  const b = self.body;

  brain.think -= dt;
  brain.unstickTimer = Math.max(0, brain.unstickTimer - dt);
  brain.detour = Math.max(0, brain.detour - dt);

  // Wedged against geometry? Force a hop and a direction flip.
  if (b.onGround && Math.abs(b.x - brain.lastX) < 1.2) {
    brain.stuck += dt;
    if (brain.stuck > 0.55) {
      brain.stuck = 0;
      brain.dir *= -1;
      brain.unstickTimer = 0.4;
    }
  } else {
    brain.stuck = 0;
  }
  brain.lastX = b.x;

  const cx = b.x + C.PLAYER_W / 2;
  const cy = b.y + C.PLAYER_H / 2;

  const alive = others.filter((p) => p.id !== self.id && p.respawn <= 0);
  const tagger = alive.find((p) => p.it) || null;

  if (brain.think <= 0) {
    // A detour is a commitment: keep walking around the obstacle instead of
    // turning straight back into it the moment we re-target.
    const lockedDir = brain.detour > 0 ? brain.dir : null;
    brain.think = cfg.react * (0.7 + Math.random() * 0.6);
    brain.wantJump = false;
    brain.wantDown = false;

    if (state !== 'playing') {
      // Idle milling about in the lobby.
      if (Math.random() < 0.25) brain.dir = Math.random() < 0.5 ? -1 : 1;
      brain.wantJump = Math.random() < 0.15;
    } else if (self.it) {
      // --- chase -----------------------------------------------------------
      const targets = alive.filter((p) => p.immunity <= 0);
      let best = null;
      let bestScore = Infinity;
      for (const p of targets) {
        const px = p.body.x + C.PLAYER_W / 2;
        const py = p.body.y + C.PLAYER_H / 2;
        // Prefer targets that are close and roughly on our level.
        const score = Math.hypot(px - cx, (py - cy) * 1.6);
        if (score < bestScore) { bestScore = score; best = p; }
      }
      brain.targetId = best ? best.id : null;
      if (best) {
        const tx = best.body.x + C.PLAYER_W / 2;
        const ty = best.body.y + C.PLAYER_H / 2;
        brain.dir = tx > cx ? 1 : -1;
        if (Math.random() > cfg.accuracy) brain.dir *= -1; // occasional misread
        // Jump toward a target that is above us, or drop toward one below.
        if (ty < cy - 40) brain.wantJump = true;
        else if (ty > cy + 60) brain.wantDown = Math.random() < 0.7;
      } else if (self.tagCooldown > 0) {
        brain.dir = Math.random() < 0.5 ? -1 : 1;
      }
    } else {
      // --- flee ------------------------------------------------------------
      const threat = tagger
        ? Math.hypot(tagger.body.x + C.PLAYER_W / 2 - cx, (tagger.body.y - b.y) * 0.8)
        : Infinity;
      if (tagger && threat < cfg.threat) {
        const tx = tagger.body.x + C.PLAYER_W / 2;
        brain.dir = tx > cx ? -1 : 1;
        if (Math.random() > cfg.panic) brain.dir *= -1;
        // Break line of sight vertically when they are right on top of us.
        const above = tagger.body.y + C.PLAYER_H < b.y + 8;
        if (above && Math.abs(tx - cx) < 90) brain.wantDown = true;
        else if (Math.random() < cfg.jumpiness * 0.8) brain.wantJump = true;
        brain.roamX = null;
      } else {
        // Roam toward a random part of the map so runners spread out.
        if (brain.roamX === null || Math.abs(brain.roamX - cx) < 120) {
          brain.roamX = 80 + Math.random() * (map.width - 160);
        }
        brain.dir = brain.roamX > cx ? 1 : -1;
        if (Math.random() < 0.18) brain.wantJump = true;
      }
    }

    if (lockedDir !== null) brain.dir = lockedDir;
  }

  let dir = brain.dir;
  if (brain.unstickTimer > 0) {
    // While unsticking, commit to the flipped direction and hop.
    brain.wantJump = true;
  }

  // --- reflexes (evaluated every tick, not on the think timer) -------------
  const footY = b.y + C.PLAYER_H;
  const aheadX = cx + dir * (C.PLAYER_W / 2 + 12);

  // Wall directly ahead: hop it if we can clear it, otherwise commit to
  // walking around. Towers are several times taller than a jump, and bots
  // that keep hopping into them never catch anybody.
  const wallAhead = solidAt(map, aheadX, footY - 8) || solidAt(map, aheadX, footY - 26);
  if (wallAhead && b.onGround) {
    const jumpClearance = C.PLAYER_H + 62;
    const clearable = !solidAt(map, aheadX, footY - jumpClearance);
    if (clearable) {
      brain.wantJump = true;
    } else if (brain.detour <= 0) {
      brain.detour = 0.9 + Math.random() * 0.7;
      dir = brain.dir = -dir;
    }
  }

  // Pit or lava ahead -> jump it, or turn around if it looks unjumpable.
  if (b.onGround && !wallAhead) {
    const probeX = cx + dir * (C.PLAYER_W + 18);
    if (unsafeColumn(map, probeX, footY + 4)) {
      // Is there safe ground within a running jump on the far side?
      const landable = !unsafeColumn(map, cx + dir * 170, footY + 4);
      if (landable) brain.wantJump = true;
      else dir = brain.dir = -dir;
    }
  }

  // Airborne over lava or a pit -> steer toward the nearest safe column.
  if (!b.onGround) {
    const steer = safeSteer(map, cx, footY);
    if (steer !== 0) dir = brain.dir = steer;
  }

  // Reaching for a ledge just overhead.
  if (b.onGround && brain.wantJump === false && Math.random() < 0.02) {
    const up = platformAbove(map, cx, b.y, 150);
    if (up) brain.wantJump = true;
  }

  // Jump height is variable: releasing the key early cuts the arc short. A bot
  // that pressed jump for a single tick would only ever manage a stub of a hop,
  // so hold the key down for a while and then release it, which also re-arms
  // the rising-edge detection for the next jump.
  if (brain.wantJump && (b.onGround || b.coyote > 0) && brain.jumpHold <= 0) {
    brain.jumpHold = 0.16 + Math.random() * 0.14;
    brain.wantJump = false;
  }
  const holding = brain.jumpHold > 0;
  brain.jumpHold = Math.max(0, brain.jumpHold - dt);

  let bits = 0;
  if (dir < 0) bits |= IN_LEFT;
  if (dir > 0) bits |= IN_RIGHT;
  if (holding) bits |= IN_JUMP;
  if (brain.wantDown) bits |= IN_DOWN;

  return bits;
}
