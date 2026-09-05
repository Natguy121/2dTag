// Bot brains. Bots are ordinary players from the simulation's point of view --
// they just produce an input bitmask every tick instead of receiving one over
// the network, so they obey the same physics as everyone else.

import * as C from '../shared/constants.js';
import { PLATFORM_H } from '../shared/maps.js';
import { IN_LEFT, IN_RIGHT, IN_JUMP, IN_DOWN, IN_SHOOT, resolveShot } from '../shared/physics.js';

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
    chairTarget: null, // [x, y] center of the chair to home in on, freeze phase only
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
 * `chairs` (Musical Chairs maps only) is { stage, activeChairs, eliminated }
 * from the Room -- null/undefined everywhere else.
 */
export function think(self, others, map, dt, state, chairs = null) {
  const brain = self.ai;
  const cfg = brain.cfg;
  const b = self.body;

  brain.think -= dt;
  brain.unstickTimer = Math.max(0, brain.unstickTimer - dt);
  brain.detour = Math.max(0, brain.detour - dt);

  // Wedged against geometry? Force a hop and a direction flip -- unless
  // we've simply arrived at our Musical Chairs seat and are deliberately
  // holding still, which looks identical (onGround, not moving) but isn't
  // stuck at all.
  const parkedOnChair = brain.chairTarget
    && Math.abs((b.x + C.PLAYER_W / 2) - brain.chairTarget[0]) < 6;
  if (b.onGround && Math.abs(b.x - brain.lastX) < 1.2 && !parkedOnChair) {
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

  function inDetectionRange(p) {
    if (!map.detectionRange) return true;
    const px = p.body.x + C.PLAYER_W / 2;
    const py = p.body.y + C.PLAYER_H / 2;
    return Math.hypot(px - cx, py - cy) <= map.detectionRange;
  }
  // A bot can't react to a threat it can't perceive: too far away on a map
  // with limited detection, or the tagger is mid-invisible on Blackout.
  const perceivedTagger = tagger && !tagger.invisible && inDetectionRange(tagger) ? tagger : null;

  if (brain.think <= 0) {
    // A detour is a commitment: keep walking around the obstacle instead of
    // turning straight back into it the moment we re-target.
    const lockedDir = brain.detour > 0 ? brain.dir : null;
    brain.think = cfg.react * (0.7 + Math.random() * 0.6);
    brain.wantJump = false;
    brain.wantDown = false;

    if (map.musicalChairs) {
      // --- musical chairs ----------------------------------------------
      if (state !== 'playing' || chairs?.eliminated?.has(self.id)) {
        // Lobby, or already out -- just mill about like a spectator.
        if (Math.random() < 0.25) brain.dir = Math.random() < 0.5 ? -1 : 1;
        brain.chairTarget = null;
      } else if (chairs?.stage === 'freeze') {
        // The music stopped. Head for the chair the room's assignment
        // hint says is ours (a snapshot of who's closest to what, taken
        // the instant the music stopped) -- without this every bot
        // independently beelines for whichever chair looks nearest to
        // *itself* and they all pile onto the same one, leaving several
        // other empty chairs untouched. Only fall back to raw nearest-chair
        // when there's no assignment (e.g. more players than chairs). The
        // actual homing happens every tick below (see chairTarget), not
        // just on this slower decision cadence, so a bot can stop dead on
        // the seat instead of overshooting it before its next think.
        const assignedIdx = chairs.assignment?.get(self.id);
        let best = assignedIdx !== undefined ? map.chairs[assignedIdx] : null;
        if (!best) {
          let bestDist = Infinity;
          for (const idx of chairs.activeChairs || []) {
            const c = map.chairs[idx];
            const ccx = c[0] + c[2] / 2;
            const ccy = c[1] + c[3] / 2;
            const d = Math.hypot(ccx - cx, (ccy - cy) * 1.4);
            if (d < bestDist) { bestDist = d; best = c; }
          }
        }
        brain.chairTarget = best ? [best[0] + best[2] / 2, best[1] + best[3] / 2] : null;
      } else {
        // Music's playing -- just roam so the room doesn't clump in place.
        brain.chairTarget = null;
        if (brain.roamX === null || Math.abs(brain.roamX - cx) < 120) {
          brain.roamX = 80 + Math.random() * (map.width - 160);
        }
        brain.dir = brain.roamX > cx ? 1 : -1;
        if (Math.random() < 0.15) brain.wantJump = true;
      }
    } else if (state !== 'playing') {
      // Idle milling about in the lobby.
      if (Math.random() < 0.25) brain.dir = Math.random() < 0.5 ? -1 : 1;
      brain.wantJump = Math.random() < 0.15;
    } else if (self.it) {
      // --- chase -----------------------------------------------------------
      const targets = alive.filter((p) => p.immunity <= 0 && inDetectionRange(p));
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
      } else {
        // No valid target (everyone reachable is immune) -- pace around.
        brain.dir = Math.random() < 0.5 ? -1 : 1;
      }
    } else {
      // --- flee ------------------------------------------------------------
      const threat = perceivedTagger
        ? Math.hypot(perceivedTagger.body.x + C.PLAYER_W / 2 - cx, (perceivedTagger.body.y - b.y) * 0.8)
        : Infinity;
      if (perceivedTagger && threat < cfg.threat) {
        const tx = perceivedTagger.body.x + C.PLAYER_W / 2;
        brain.dir = tx > cx ? -1 : 1;
        if (Math.random() > cfg.panic) brain.dir *= -1;
        // Break line of sight vertically when they are right on top of us.
        const above = perceivedTagger.body.y + C.PLAYER_H < b.y + 8;
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

  // Musical Chairs homing runs every tick, not just on the slower think
  // cadence above -- otherwise a bot barrels past its target at full speed
  // for up to a whole think interval before re-checking, which is exactly
  // how a chair sitting near a wall turns into "smash into the wall, then
  // spend the rest of the grace period unstick-detouring the wrong way."
  if (brain.chairTarget) {
    const [tx, ty] = brain.chairTarget;
    const ddx = tx - cx;
    dir = brain.dir = Math.abs(ddx) < 6 ? 0 : (ddx > 0 ? 1 : -1);
    if (ty < cy - 30) brain.wantJump = true;
    else if (ty > cy + 40) brain.wantDown = true;
  }

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

  // Crossfire Yard: only fire when a shot would actually land -- reusing the
  // real resolver means a bot never wastes a shot on a wall or thin air.
  let wantShoot = false;
  if (map.guns && self.it && self.shotCooldown <= 0) {
    const facing = dir !== 0 ? dir : b.facing;
    const candidates = alive.filter((p) => p.immunity <= 0).map((p) => ({ id: p.id, body: p.body }));
    wantShoot = resolveShot({ x: b.x, y: b.y, facing }, map, candidates).hitId !== null;
  }

  let bits = 0;
  if (dir < 0) bits |= IN_LEFT;
  if (dir > 0) bits |= IN_RIGHT;
  if (holding) bits |= IN_JUMP;
  if (brain.wantDown) bits |= IN_DOWN;
  if (wantShoot) bits |= IN_SHOOT;

  return bits;
}
