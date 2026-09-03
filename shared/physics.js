// Deterministic character physics. The server runs this to produce the
// authoritative state and the client runs the exact same function to predict
// its own player, so a correct prediction reconciles to a zero-delta.

import * as C from './constants.js';
import { PLATFORM_H, SPRING_H, PORTAL_W, PORTAL_H } from './maps.js';

export const IN_LEFT = 1;
export const IN_RIGHT = 2;
export const IN_JUMP = 4;
export const IN_DOWN = 8;

export function encodeInput({ left, right, jump, down }) {
  return (left ? IN_LEFT : 0) | (right ? IN_RIGHT : 0) | (jump ? IN_JUMP : 0) | (down ? IN_DOWN : 0);
}

export function decodeInput(bits) {
  return {
    left: !!(bits & IN_LEFT),
    right: !!(bits & IN_RIGHT),
    jump: !!(bits & IN_JUMP),
    down: !!(bits & IN_DOWN),
  };
}

export function createBody(x = 0, y = 0) {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    facing: 1,
    onGround: false,
    coyote: 0,
    jumpBuf: 0,
    prevJump: false,
    dropTimer: 0,
    springTimer: 0,
    portalTimer: 0,
    jumped: false, // set for one step when a jump starts (drives sfx/particles)
    landed: false,
  };
}

export function placeAtSpawn(body, spawn) {
  body.x = spawn[0] - C.PLAYER_W / 2;
  body.y = spawn[1] - C.PLAYER_H;
  body.vx = 0;
  body.vy = 0;
  body.onGround = true;
  body.coyote = 0;
  body.jumpBuf = 0;
  body.dropTimer = 0;
  body.springTimer = 0;
  body.portalTimer = 0;
  return body;
}

function overlaps(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/**
 * Advance one body by one fixed timestep.
 * Returns an event object describing anything the game rules care about.
 */
export function stepBody(b, inputBits, map, dt, opts = {}) {
  const input = decodeInput(inputBits);
  const speedMult = opts.speedMult ?? 1;
  const gravityScale = map.gravityScale ?? 1;
  const frictionScale = map.frictionScale ?? 1;
  const airScale = map.airScale ?? 1;

  const events = { jumped: false, landed: false, hazard: false, outOfBounds: false, spring: false, portal: null };
  b.jumped = false;
  b.landed = false;

  // --- horizontal intent -------------------------------------------------
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir !== 0) b.facing = dir;

  const maxSpeed = C.MOVE_SPEED * speedMult;
  // Ice keeps most of its acceleration but loses nearly all of its braking.
  const groundAccel = C.ACCEL_GROUND * (0.4 + 0.6 * frictionScale);
  const accel = b.onGround ? groundAccel : C.ACCEL_AIR * airScale;

  if (dir !== 0) {
    const target = dir * maxSpeed;
    if (b.vx < target) b.vx = Math.min(target, b.vx + accel * dt);
    else if (b.vx > target) b.vx = Math.max(target, b.vx - accel * dt);
  } else {
    const drag = (b.onGround ? C.FRICTION_GROUND * frictionScale : C.FRICTION_AIR) * dt;
    if (b.vx > 0) b.vx = Math.max(0, b.vx - drag);
    else if (b.vx < 0) b.vx = Math.min(0, b.vx + drag);
  }
  // A spring launch or an overspeed slide is allowed to exceed max speed, it
  // just bleeds back down instead of being hard clamped.
  const hardCap = maxSpeed * 2.2;
  if (b.vx > hardCap) b.vx = hardCap;
  if (b.vx < -hardCap) b.vx = -hardCap;

  // --- jump --------------------------------------------------------------
  b.coyote = b.onGround ? C.COYOTE_TIME : Math.max(0, b.coyote - dt);
  if (input.jump && !b.prevJump) b.jumpBuf = C.JUMP_BUFFER;
  else b.jumpBuf = Math.max(0, b.jumpBuf - dt);

  if (b.jumpBuf > 0 && b.coyote > 0) {
    // Launch velocity does NOT scale with gravity, so a low gravity map jumps
    // proportionally higher: height = v^2 / (2 * G * gravityScale). Moon Base
    // at 0.34 gravity gives roughly three times the arc of a normal map.
    b.vy = -C.JUMP_VELOCITY * (map.jumpScale ?? 1);
    b.jumpBuf = 0;
    b.coyote = 0;
    b.onGround = false;
    b.jumped = true;
    events.jumped = true;
  }
  // Releasing jump early cuts the arc short.
  if (!input.jump && b.vy < 0 && b.springTimer <= 0) b.vy *= Math.pow(C.JUMP_CUT, dt * 30);
  b.prevJump = input.jump;

  // --- drop through one-way platforms ------------------------------------
  if (input.down && b.onGround) b.dropTimer = C.DROP_TIME;
  else b.dropTimer = Math.max(0, b.dropTimer - dt);
  b.springTimer = Math.max(0, b.springTimer - dt);

  // --- gravity -----------------------------------------------------------
  b.vy += C.GRAVITY * gravityScale * dt;
  const maxFall = C.MAX_FALL * Math.sqrt(Math.max(gravityScale, 0.05));
  if (b.vy > maxFall) b.vy = maxFall;

  // --- integrate + collide ----------------------------------------------
  const W = C.PLAYER_W;
  const H = C.PLAYER_H;
  const solids = map.solids;

  // Horizontal pass.
  b.x += b.vx * dt;
  for (let i = 0; i < solids.length; i++) {
    const s = solids[i];
    if (!overlaps(b.x, b.y, W, H, s[0], s[1], s[2], s[3])) continue;
    if (b.vx > 0) b.x = s[0] - W;
    else if (b.vx < 0) b.x = s[0] + s[2];
    b.vx = 0;
  }
  // World edges are always solid so nobody can leave sideways.
  if (b.x < 0) { b.x = 0; if (b.vx < 0) b.vx = 0; }
  if (b.x > map.width - W) { b.x = map.width - W; if (b.vx > 0) b.vx = 0; }

  // Vertical pass.
  const prevBottom = b.y + H;
  b.y += b.vy * dt;
  const wasOnGround = b.onGround;
  b.onGround = false;

  for (let i = 0; i < solids.length; i++) {
    const s = solids[i];
    if (!overlaps(b.x, b.y, W, H, s[0], s[1], s[2], s[3])) continue;
    if (b.vy > 0) {
      b.y = s[1] - H;
      b.onGround = true;
    } else if (b.vy < 0) {
      b.y = s[1] + s[3];
    }
    b.vy = 0;
  }

  if (b.vy >= 0 && b.dropTimer <= 0) {
    const platforms = map.platforms;
    for (let i = 0; i < platforms.length; i++) {
      const p = platforms[i];
      if (!overlaps(b.x, b.y, W, H, p[0], p[1], p[2], PLATFORM_H)) continue;
      // Only land on it if we were above the surface at the start of the step.
      if (prevBottom <= p[1] + 1) {
        b.y = p[1] - H;
        b.vy = 0;
        b.onGround = true;
      }
    }
  }

  if (b.y < 0) { b.y = 0; if (b.vy < 0) b.vy = 0; }
  if (b.onGround && !wasOnGround) { b.landed = true; events.landed = true; }

  // --- springs -----------------------------------------------------------
  const springs = map.springs || [];
  for (let i = 0; i < springs.length; i++) {
    const s = springs[i];
    if (!overlaps(b.x, b.y, W, H, s[0], s[1] - 4, s[2], SPRING_H + 4)) continue;
    if (b.vy < 0) continue;
    b.y = s[1] - H;
    b.vy = -C.SPRING_VELOCITY * (map.jumpScale ?? 1);
    b.onGround = false;
    b.springTimer = 0.35;
    events.spring = true;
  }

  // --- portals -------------------------------------------------------------
  // A brief post-warp timer stops the player from immediately re-triggering
  // the portal they just arrived through and bouncing straight back.
  b.portalTimer = Math.max(0, b.portalTimer - dt);
  if (b.portalTimer <= 0) {
    const portals = map.portals || [];
    for (let i = 0; i < portals.length; i++) {
      const pr = portals[i];
      let dest = null;
      if (overlaps(b.x, b.y, W, H, pr.a[0], pr.a[1], PORTAL_W, PORTAL_H)) dest = pr.b;
      else if (overlaps(b.x, b.y, W, H, pr.b[0], pr.b[1], PORTAL_W, PORTAL_H)) dest = pr.a;
      if (!dest) continue;

      const from = { x: b.x + W / 2, y: b.y + H / 2 };
      b.x = dest[0] + PORTAL_W / 2 - W / 2;
      b.y = dest[1] + PORTAL_H / 2 - H / 2;
      b.portalTimer = 0.5;
      events.portal = { from, to: { x: b.x + W / 2, y: b.y + H / 2 } };
      break;
    }
  }

  // --- hazards / falling out of the world --------------------------------
  const hazards = map.hazards || [];
  for (let i = 0; i < hazards.length; i++) {
    const h = hazards[i];
    if (overlaps(b.x, b.y, W, H, h[0], h[1], h[2], h[3])) { events.hazard = true; break; }
  }
  if (b.y > map.height + 140) events.outOfBounds = true;

  return events;
}

export function bodiesTouch(a, b, reach = 0) {
  return overlaps(
    a.x - reach, a.y - reach, C.PLAYER_W + reach * 2, C.PLAYER_H + reach * 2,
    b.x, b.y, C.PLAYER_W, C.PLAYER_H,
  );
}

export function centerOf(b) {
  return { x: b.x + C.PLAYER_W / 2, y: b.y + C.PLAYER_H / 2 };
}

export { overlaps };
