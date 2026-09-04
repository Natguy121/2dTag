// Client-side game: renders the world, predicts the local player and
// interpolates everybody else.
//
// The local player runs the same physics as the server. Each snapshot carries
// the sequence number of the last input the server consumed, so we snap to the
// authoritative position and replay any inputs it has not seen yet. Remote
// players have no inputs to replay, so they are drawn slightly in the past and
// interpolated between snapshots, which hides jitter.

import * as C from '/shared/constants.js';
import { getMap } from '/shared/maps.js';
import { createBody, stepBody } from '/shared/physics.js';
import { getTrail } from '/shared/trails.js';
import * as net from './net.js';
import * as input from './input.js';
import { profile, bumpStat, trackMapPlayed } from './storage.js';
import { sfx } from './audio.js';
import {
  drawBackground, drawMap, drawCharacter, Particles, formatTime,
} from './render.js';

const INTERP_DELAY = 0.1; // seconds of buffer for remote players
const CORRECTION_TIME = 0.12;

// Keyed by power name (see C.ORB_POWERS), used for pickup particles/HUD/aura.
export const POWER_COLORS = {
  speed: '#ffd166', jump: '#4ff08a', shield: '#4cc9f0', invis: '#c58bff',
  gravity: '#ff5fd1', doublejump: '#ff9142', freeze: '#b3ecff', radar: '#caff4d', reach: '#ff6b6b',
};
const POWER_LABELS = {
  speed: 'SPEED BOOST!', jump: 'SUPER JUMP!', shield: 'SHIELD UP!', invis: 'INVISIBLE!',
  gravity: 'GRAVITY FLIP!', doublejump: 'DOUBLE JUMP!', freeze: 'FROST TOUCH!', radar: 'RADAR ON!', reach: 'LONG REACH!',
};
const POWER_ICONS = {
  speed: '⚡', jump: '⬆', shield: '\u{1F6E1}', invis: '\u{1F47B}',
  gravity: '\u{1F643}', doublejump: '⏫', freeze: '❄️', radar: '\u{1F9ED}', reach: '\u{1F590}\u{FE0F}',
};

export class Game {
  constructor(canvas, hooks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hooks = hooks;

    this.map = getMap('arena');
    this.youId = null;
    this.roster = new Map(); // id -> { name, skin, isBot }
    this.state = 'lobby';
    this.timer = 0;
    this.seekerFreeze = 0;
    this.orbState = []; // per-orb seconds until it respawns, from the last snapshot
    this.resultsShown = false;

    this.body = createBody();
    this.seq = 0;
    this.pending = [];
    this.predictReady = false;
    this.correction = { x: 0, y: 0, t: 0 };

    this.snapshots = [];
    this.serverNow = 0;

    this.particles = new Particles();
    this.shotBeams = []; // {x1, y1, x2, y2, age, life, hit} -- Crossfire Yard laser flashes
    this.shake = 0;
    this.cam = { x: 0, y: 0, scale: 1, ready: false };
    this.time = 0;
    this.centerMessage = null;
    this.centerUntil = 0;
    this.lastCountdownSecond = null;

    this.accumulator = 0;
    this.lastFrame = 0;
    this.raf = 0;
    this.running = false;
    this.fps = 0;
    this.fpsAccum = 0;
    this.fpsFrames = 0;

    this.scores = new Map(); // id -> itTime, kept from roster updates
    this.onResize = () => this.resize();
  }

  // ------------------------------------------------------------- lifecycle

  start(youId) {
    this.youId = youId;
    this.running = true;
    this.lastFrame = performance.now();
    this.resize();
    window.addEventListener('resize', this.onResize);
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.frame.bind(this));
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    this.particles.clear();
    this.snapshots.length = 0;
    this.pending.length = 0;
    this.predictReady = false;
    this.cam.ready = false;
    input.clear();
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    this.dpr = dpr;
    this.viewW = w;
    this.viewH = h;
  }

  // --------------------------------------------------------------- network

  setRoom(room) {
    this.map = getMap(room.mapId);
    this.roster.clear();
    for (const p of room.players) {
      this.roster.set(p.id, p);
      this.scores.set(p.id, p.itTime || 0);
    }
    // Roster messages carry the room state too, and they arrive just before the
    // snapshot that ends a round. Route both through the same transition check
    // so whichever lands first still fires onStateChange exactly once.
    this.applyState(room.state);
    this.hooks.onHud?.(this.hudData());
  }

  applyState(next) {
    if (next === this.state) return;
    const prev = this.state;
    this.state = next;
    this.onStateChange(prev, next);
  }

  onSnapshot(msg) {
    this.timer = msg.timer;
    this.seekerFreeze = msg.seekerFreeze || 0;
    this.orbState = msg.orbs || [];
    this.applyState(msg.state);

    const byId = new Map();
    for (const p of msg.players) {
      byId.set(p[0], {
        x: p[1], y: p[2], vx: p[3], vy: p[4], facing: p[5], flags: p[6], power: p[7] || 0, powerT: p[8] || 0,
      });
    }
    this.snapshots.push({ time: performance.now() / 1000, players: byId });
    if (this.snapshots.length > 16) this.snapshots.shift();

    // Reconcile the local player.
    const mine = byId.get(this.youId);
    if (mine) this.reconcile(mine, msg.ack);

    this.handleEvents(msg.ev || []);

    // The server keeps sending the same standings on every snapshot for the
    // whole results window, but the round only ended once -- show it, award
    // stats/coins for it, exactly one time.
    if (msg.state === 'results' && msg.standings && !this.resultsShown) {
      this.resultsShown = true;
      this.hooks.onResults?.(msg.standings, this.youId);
    }
    this.hooks.onHud?.(this.hudData());
  }

  reconcile(server, ack) {
    const b = this.body;
    const beforeX = b.x;
    const beforeY = b.y;

    b.x = server.x;
    b.y = server.y;
    b.vx = server.vx;
    b.vy = server.vy;
    b.facing = server.facing;
    b.onGround = !!(server.flags & 1);

    // Replay everything the server has not acknowledged yet.
    this.pending = this.pending.filter((p) => p.seq > ack);
    for (const p of this.pending) {
      stepBody(b, p.bits, this.map, C.DT, {
        speedMult: this.localSpeedMult(), jumpMult: this.localJumpMult(),
        gravityFlip: this.localGravityFlip(), canDoubleJump: this.localCanDoubleJump(),
      });
    }

    if (this.predictReady) {
      // Smooth out the visual pop instead of teleporting.
      const dx = beforeX - b.x;
      const dy = beforeY - b.y;
      if (Math.abs(dx) < 240 && Math.abs(dy) < 240) {
        this.correction.x = dx;
        this.correction.y = dy;
        this.correction.t = CORRECTION_TIME;
      }
    }
    this.predictReady = true;
  }

  /** Which power (if any) the local player is currently holding, per the
   * latest server snapshot -- the single source every local-prediction
   * opt below reads from, so they can never disagree with each other. */
  localPower() {
    const me = this.latestServerSelf();
    return me && me.powerT > 0 ? C.ORB_POWERS[me.power - 1] : null;
  }

  localSpeedMult() {
    const me = this.latestServerSelf();
    const isIt = me ? !!(me.flags & 2) : false;
    let mult = isIt && this.state === 'playing' ? C.TAGGER_SPEED_MULT : 1;
    if (this.localPower() === 'speed') mult *= C.ORB_SPEED_MULT;
    return mult;
  }

  localJumpMult() {
    return this.localPower() === 'jump' ? C.ORB_JUMP_MULT : 1;
  }

  localGravityFlip() {
    return this.localPower() === 'gravity';
  }

  localCanDoubleJump() {
    return this.localPower() === 'doublejump';
  }

  /** Radar power: while not "it", points at the current tagger; while "it",
   * points at the nearest other (non-invisible) player instead, so it's
   * useful either way you're holding it. Pure client-side lookup -- every
   * player's live position is already in the snapshot the radar just reads
   * from, so there's nothing new for the server to send. */
  radarTarget() {
    if (this.localPower() !== 'radar') return null;
    const me = this.latestServerSelf();
    if (!me) return null;
    const meIsIt = !!(me.flags & 2);
    let targetId = null;
    if (!meIsIt) {
      for (const [id, meta] of this.roster) if (meta.it) { targetId = id; break; }
    } else {
      let bestDist = Infinity;
      for (const [id] of this.roster) {
        if (id === this.youId) continue;
        const p = this.interpolated(id);
        if (!p || (p.flags & 16)) continue; // radar doesn't see through invisibility
        const d = Math.hypot(p.x - this.body.x, p.y - this.body.y);
        if (d < bestDist) { bestDist = d; targetId = id; }
      }
    }
    if (!targetId || targetId === this.youId) return null;
    const pos = this.interpolated(targetId);
    if (!pos || (pos.flags & 16)) return null;
    return { x: pos.x + C.PLAYER_W / 2, y: pos.y + C.PLAYER_H / 2 };
  }

  latestServerSelf() {
    for (let i = this.snapshots.length - 1; i >= 0; i--) {
      const p = this.snapshots[i].players.get(this.youId);
      if (p) return p;
    }
    return null;
  }

  handleEvents(events) {
    for (const ev of events) {
      const mine = ev.id === this.youId || ev.to === this.youId || ev.by === this.youId;
      switch (ev.type) {
        case 'tag':
        case 'shotTag': {
          const shot = ev.type === 'shotTag';
          const pos = { x: ev.x, y: ev.y };
          if (profile.particles) {
            this.particles.spawn(pos.x, pos.y, 26, { color: '#ff4d6d', speed: 260, life: 0.6, size: 4, gravity: 700 });
            this.particles.spawn(pos.x, pos.y, 14, { color: '#ffd166', speed: 180, life: 0.5, size: 3, gravity: 500 });
          }
          if (profile.shake) this.shake = Math.max(this.shake, mine ? 14 : 7);
          if (ev.to === this.youId) {
            sfx.tagged();
            navigator.vibrate?.([30, 40, 60]);
            this.showCenter("YOU'RE IT!", 1.1);
          } else if (ev.by === this.youId) {
            sfx.tag();
            bumpStat('tags');
            if (shot) bumpStat('shotHits');
            const name = this.roster.get(ev.to)?.name || 'them';
            this.showCenter(shot ? `SHOT ${name.toUpperCase()}` : `TAGGED ${name.toUpperCase()}`, 0.9);
          } else {
            sfx.tag();
          }
          break;
        }
        case 'shot': {
          const mineShot = ev.by === this.youId;
          this.shotBeams.push({
            x1: ev.fromX, y1: ev.fromY, x2: ev.toX, y2: ev.fromY,
            age: 0, life: mineShot ? 0.16 : 0.22, hit: !!ev.hitId,
          });
          if (mineShot) sfx.shoot();
          if (profile.particles) {
            this.particles.spawn(ev.toX, ev.fromY, ev.hitId ? 10 : 5, {
              color: ev.hitId ? '#ff4d6d' : '#ffb38a', speed: 140, life: 0.3, size: 2.5, gravity: 0,
            });
          }
          break;
        }
        case 'spring':
          if (profile.particles) {
            this.particles.spawn(ev.x + C.PLAYER_W / 2, ev.y + C.PLAYER_H, 12, {
              color: this.map.theme.accent, speed: 180, life: 0.4, size: 3, gravity: 600, angle: -Math.PI / 2, spread: 1.6,
            });
          }
          if (mine) sfx.spring();
          break;
        case 'portal':
          // The local player already got instant feedback in tickInput() the
          // moment their own prediction crossed the threshold -- this branch
          // is only for seeing OTHER players use a portal.
          if (!mine) {
            if (profile.particles) {
              this.particles.spawn(ev.fromX, ev.fromY, 14, { color: '#ffffff', speed: 150, life: 0.35, size: 3, gravity: 0 });
              this.particles.spawn(ev.x, ev.y, 14, { color: '#ffffff', speed: 150, life: 0.4, size: 3, gravity: 0 });
            }
            sfx.portal();
          }
          break;
        case 'hazard':
          if (profile.particles) {
            this.particles.spawn(ev.x + C.PLAYER_W / 2, ev.y + C.PLAYER_H, 20, {
              color: '#ff7a30', speed: 200, life: 0.7, size: 4, gravity: 400, angle: -Math.PI / 2, spread: 2.2,
            });
          }
          if (mine) { sfx.hazard(); this.showCenter('OUCH!', 0.7); }
          break;
        case 'fell':
          if (mine) { sfx.hazard(); this.showCenter('OUT OF BOUNDS', 0.8); }
          break;
        case 'spawn':
          if (profile.particles) {
            this.particles.spawn(ev.x + C.PLAYER_W / 2, ev.y + C.PLAYER_H / 2, 14, {
              color: '#ffffff', speed: 150, life: 0.4, size: 3, gravity: 0,
            });
          }
          break;
        case 'candy':
          if (profile.particles) {
            this.particles.spawn(ev.x + C.PLAYER_W / 2, ev.y + C.PLAYER_H / 2, 18, {
              color: '#ffb3d9', speed: 170, life: 0.5, size: 3, gravity: 200, spread: Math.PI * 2,
            });
          }
          if (mine) {
            sfx.candy();
            this.showCenter('STUCK IN CANDY!', 2.6);
          } else {
            sfx.candyPop();
          }
          break;
        case 'freeze':
          // Same frozen-in-place mechanic as candy (see the shared
          // candyFreeze flag in drawPlayer), but triggered by another
          // player's Frost Touch power instead of a map candy tile -- an
          // icy cue instead of a wrapper crinkle so it doesn't sound like
          // candy appeared out of nowhere on a non-Candy-Land map.
          if (profile.particles) {
            this.particles.spawn(ev.x + C.PLAYER_W / 2, ev.y + C.PLAYER_H / 2, 18, {
              color: '#b3ecff', speed: 170, life: 0.5, size: 3, gravity: 100, spread: Math.PI * 2,
            });
          }
          if (ev.id === this.youId) {
            sfx.freeze();
            this.showCenter('FROZEN!', 2.6);
          } else if (ev.by === this.youId) {
            sfx.freezePop();
            const name = this.roster.get(ev.id)?.name || 'them';
            this.showCenter(`FROZE ${name.toUpperCase()}`, 1.2);
          } else {
            sfx.freezePop();
          }
          break;
        case 'orb': {
          const color = POWER_COLORS[ev.power] || '#ffffff';
          if (profile.particles) {
            this.particles.spawn(ev.x + C.PLAYER_W / 2, ev.y + C.PLAYER_H / 2, 22, {
              color, speed: 220, life: 0.55, size: 3.5, gravity: -60, spread: Math.PI * 2,
            });
          }
          if (mine) {
            sfx.orb();
            this.showCenter(POWER_LABELS[ev.power] || 'POWER UP!', 1.6);
          } else {
            sfx.orbFar();
          }
          break;
        }
        case 'go':
          sfx.go();
          this.showCenter('GO!', 0.8);
          break;
        default:
          break;
      }
    }
  }

  onStateChange(from, to) {
    if (to !== 'results') this.resultsShown = false;
    if (to === 'countdown') {
      this.lastCountdownSecond = null;
      this.hooks.onResults?.(null);
    }
    if (to === 'playing') {
      this.particles.clear();
    }
    if (to === 'results') {
      bumpStat('games');
      if (this.map.moon) bumpStat('moonRounds');
      trackMapPlayed(this.map.id);
    }
    if (to === 'lobby' && from === 'results') {
      this.hooks.onResults?.(null);
    }
  }

  showCenter(text, seconds) {
    this.centerMessage = text;
    this.centerUntil = this.time + seconds;
    this.hooks.onCenter?.(text);
  }

  // ------------------------------------------------------------- main loop

  frame(now) {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.frame.bind(this));

    let dt = (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    if (dt > 0.25) dt = 0.25;
    this.time += dt;

    this.fpsAccum += dt;
    this.fpsFrames++;
    if (this.fpsAccum >= 0.5) {
      this.fps = Math.round(this.fpsFrames / this.fpsAccum);
      this.fpsAccum = 0;
      this.fpsFrames = 0;
    }

    // Fixed-step input sampling and prediction.
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= C.DT && steps < 6) {
      this.tickInput();
      this.accumulator -= C.DT;
      steps++;
    }
    if (steps === 6) this.accumulator = 0;

    if (this.correction.t > 0) {
      this.correction.t = Math.max(0, this.correction.t - dt);
    }
    this.particles.update(dt);
    for (let i = this.shotBeams.length - 1; i >= 0; i--) {
      const b = this.shotBeams[i];
      b.age += dt;
      if (b.age >= b.life) this.shotBeams.splice(i, 1);
    }
    this.shake = Math.max(0, this.shake - dt * 40);

    if (this.centerMessage && this.time > this.centerUntil) {
      this.centerMessage = null;
      this.hooks.onCenter?.(null);
    }
    this.updateCountdownMessage();

    this.draw(dt);
  }

  tickInput() {
    const bits = input.currentBits();
    this.seq++;
    this.pending.push({ seq: this.seq, bits });
    if (this.pending.length > 180) this.pending.shift();

    net.send({ t: 'input', seq: this.seq, bits });

    const frozen = this.state === 'countdown' || this.state === 'results';
    const self = this.latestServerSelf();
    const respawning = self ? !!(self.flags & 8) : false;
    // Candy Land's freeze and the Frost Touch power both hold movement
    // still server-side (see room.js's step()) -- mirror that here too, or
    // the local prediction would keep drifting on stale input until the
    // next snapshot yanks it back.
    const iceFrozen = self ? !!(self.flags & 32) : false;
    if (!frozen && !respawning && !iceFrozen) {
      const ev = stepBody(this.body, bits, this.map, C.DT, {
        speedMult: this.localSpeedMult(), jumpMult: this.localJumpMult(),
        gravityFlip: this.localGravityFlip(), canDoubleJump: this.localCanDoubleJump(),
      });
      // Local feedback fires immediately rather than waiting for the server.
      if (ev.jumped) sfx.jump();
      if (ev.landed) {
        sfx.land();
        if (profile.particles) {
          this.particles.spawn(this.body.x + C.PLAYER_W / 2, this.body.y + C.PLAYER_H, 5, {
            color: 'rgba(255,255,255,0.8)', speed: 70, life: 0.3, size: 2.5, gravity: 300, angle: -Math.PI / 2, spread: 2.4,
          });
        }
      }
      if (ev.portal) {
        sfx.portal();
        if (profile.particles) {
          this.particles.spawn(ev.portal.from.x, ev.portal.from.y, 16, {
            color: '#ffffff', speed: 160, life: 0.35, size: 3, gravity: 0,
          });
          this.particles.spawn(ev.portal.to.x, ev.portal.to.y, 16, {
            color: '#ffffff', speed: 160, life: 0.4, size: 3, gravity: 0,
          });
        }
      }
    }
  }

  updateCountdownMessage() {
    if (this.state !== 'countdown') return;
    const secs = Math.ceil(this.timer);
    if (secs !== this.lastCountdownSecond && secs > 0) {
      this.lastCountdownSecond = secs;
      sfx.count();
      this.showCenter(String(secs), 1);
    }
  }

  // ---------------------------------------------------------------- render

  /** Position of a remote player, interpolated INTERP_DELAY in the past. */
  interpolated(id) {
    const renderTime = performance.now() / 1000 - INTERP_DELAY;
    let older = null;
    let newer = null;
    for (let i = this.snapshots.length - 1; i >= 0; i--) {
      const s = this.snapshots[i];
      if (!s.players.has(id)) continue;
      if (s.time <= renderTime) { older = s; break; }
      newer = s;
    }
    if (!older) {
      const latest = newer || this.snapshots[this.snapshots.length - 1];
      return latest?.players.get(id) || null;
    }
    if (!newer) return older.players.get(id);

    const a = older.players.get(id);
    const b = newer.players.get(id);
    const span = newer.time - older.time;
    const k = span > 0 ? Math.min(1, Math.max(0, (renderTime - older.time) / span)) : 0;
    // Do not interpolate across a teleport (respawn).
    if (Math.abs(b.x - a.x) > 400 || Math.abs(b.y - a.y) > 400) return b;
    return {
      x: a.x + (b.x - a.x) * k,
      y: a.y + (b.y - a.y) * k,
      vx: b.vx,
      vy: b.vy,
      facing: b.facing,
      flags: b.flags,
      power: b.power,
      powerT: b.powerT,
    };
  }

  selfRenderPos() {
    const k = this.correction.t / CORRECTION_TIME;
    return {
      x: this.body.x + this.correction.x * k,
      y: this.body.y + this.correction.y * k,
    };
  }

  updateCamera(dt) {
    const scale = Math.max(this.viewW / C.VIEW_W, this.viewH / C.VIEW_H);
    this.cam.scale = scale;
    const visW = this.viewW / scale;
    const visH = this.viewH / scale;

    const me = this.selfRenderPos();
    let tx = me.x + C.PLAYER_W / 2;
    let ty = me.y + C.PLAYER_H / 2;

    // Look slightly ahead in the direction of travel.
    tx += Math.max(-140, Math.min(140, this.body.vx * 0.22));

    if (this.map.width <= visW) tx = this.map.width / 2;
    else tx = Math.max(visW / 2, Math.min(this.map.width - visW / 2, tx));
    if (this.map.height <= visH) ty = this.map.height / 2;
    else ty = Math.max(visH / 2, Math.min(this.map.height - visH / 2, ty));

    if (!this.cam.ready) {
      this.cam.x = tx;
      this.cam.y = ty;
      this.cam.ready = true;
    } else {
      const k = 1 - Math.pow(0.0009, dt); // frame-rate independent smoothing
      this.cam.x += (tx - this.cam.x) * k;
      this.cam.y += (ty - this.cam.y) * k;
    }
  }

  draw(dt) {
    const ctx = this.ctx;
    this.updateCamera(dt);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.viewW, this.viewH);

    drawBackground(ctx, this.map, this.cam, { w: this.viewW, h: this.viewH }, this.time);

    const shakeX = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    const shakeY = this.shake ? (Math.random() - 0.5) * this.shake : 0;

    ctx.save();
    ctx.translate(this.viewW / 2 + shakeX, this.viewH / 2 + shakeY);
    ctx.scale(this.cam.scale, this.cam.scale);
    ctx.translate(-this.cam.x, -this.cam.y);

    drawMap(ctx, this.map, this.time, this.orbState);

    // Remote players first, local player on top.
    for (const [id, meta] of this.roster) {
      if (id === this.youId) continue;
      const p = this.interpolated(id);
      if (!p) continue;
      this.drawPlayer(ctx, p.x, p.y, p, meta);
    }

    const self = this.latestServerSelf();
    if (self) {
      const pos = this.selfRenderPos();
      this.drawPlayer(ctx, pos.x, pos.y, {
        vx: this.body.vx, vy: this.body.vy, facing: this.body.facing, flags: self.flags,
        power: self.power, powerT: self.powerT,
      }, this.roster.get(this.youId) || { name: profile.name, skin: profile.skin, trail: profile.trail }, true);
    }

    this.drawShotBeams(ctx);
    this.particles.draw(ctx);
    ctx.restore();

    // Radar's compass arrow is a fixed-size screen-space overlay, drawn
    // after the world transform is popped so camera zoom doesn't scale it.
    this.drawRadar(ctx);
  }

  drawRadar(ctx) {
    const target = this.radarTarget();
    if (!target) return;
    const me = this.selfRenderPos();
    const angle = Math.atan2(
      target.y - (me.y + C.PLAYER_H / 2),
      target.x - (me.x + C.PLAYER_W / 2),
    );
    const cx = this.viewW / 2;
    const cy = this.viewH / 2;
    const radius = 70;

    ctx.save();
    ctx.translate(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    ctx.rotate(angle);
    ctx.globalAlpha = 0.6 + Math.sin(this.time * 6) * 0.2;
    ctx.fillStyle = POWER_COLORS.radar;
    ctx.shadowColor = POWER_COLORS.radar;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(11, 0);
    ctx.lineTo(-6, -7);
    ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawShotBeams(ctx) {
    for (const b of this.shotBeams) {
      const k = 1 - b.age / b.life;
      ctx.save();
      ctx.globalAlpha = k;
      ctx.strokeStyle = b.hit ? '#ff4d6d' : '#ff6b35';
      ctx.lineWidth = 3 * k + 1;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawPlayer(ctx, x, y, p, meta, isSelf = false) {
    const it = !!(p.flags & 2);
    const immune = !!(p.flags & 4);
    const respawning = !!(p.flags & 8);
    const onGround = !!(p.flags & 1);
    const invisible = !!(p.flags & 16);
    const candyFrozen = !!(p.flags & 32);
    const power = p.powerT > 0 ? C.ORB_POWERS[p.power - 1] : null;

    // Blackout: the tagger vanishes to everyone else while invisible -- no
    // sprite, no trail, no name, nothing that gives their position away. You
    // still see your own outline (faded) so you always know your own state.
    if (invisible && !isSelf) return;

    // Tagger leaves a faint red warning trail so you can see them coming --
    // always on, unrelated to anyone's equipped cosmetic trail below.
    if (it && !invisible && profile.particles && !respawning && Math.abs(p.vx) > 60 && Math.random() < 0.4) {
      this.particles.spawn(x + C.PLAYER_W / 2, y + C.PLAYER_H - 4, 1, {
        color: 'rgba(255,77,109,0.6)', speed: 20, life: 0.35, size: 3, gravity: -40,
      });
    }

    // Equipped cosmetic trail: a colored particle trickle behind anyone
    // moving fast enough, regardless of "it" status. No-op for the 'none' trail.
    const cosmeticTrail = getTrail(meta?.trail);
    if (cosmeticTrail.colors.length && !invisible && profile.particles && !respawning
      && (Math.abs(p.vx) > 90 || Math.abs(p.vy) > 220) && Math.random() < 0.5) {
      const color = cosmeticTrail.colors[Math.floor(Math.random() * cosmeticTrail.colors.length)];
      this.particles.spawn(x + C.PLAYER_W / 2, y + C.PLAYER_H - 6, 1, {
        color, speed: 30, life: 0.4, size: 3.5, gravity: 60, spread: 1.4,
      });
    }

    // Frozen in place: a light sparkle trickle while stuck (the glow ring
    // and icon are drawn after the character below) -- applies to anyone,
    // tagger included. Candy Land's candy tiles and Surge Ruins' Frost
    // Touch power both set this same flag; only the color/icon differ, so
    // it reads as candy on one map and ice on the other.
    const isCandySource = !!this.map.candies?.length;
    if (candyFrozen && profile.particles && Math.random() < 0.3) {
      this.particles.spawn(x + C.PLAYER_W / 2, y + C.PLAYER_H / 2, 1, {
        color: isCandySource ? '#ffb3d9' : '#b3ecff', speed: 40, life: 0.5, size: 2.5, gravity: -20, spread: Math.PI * 2,
      });
    }

    // Holding a power-orb effect: a colored trickle in that power's color
    // (the ring + icon are drawn after the character below, same as candy).
    if (power && profile.particles && Math.random() < 0.35) {
      this.particles.spawn(x + C.PLAYER_W / 2, y + C.PLAYER_H / 2, 1, {
        color: POWER_COLORS[power], speed: 55, life: 0.4, size: 2.5, gravity: -30, spread: Math.PI * 2,
      });
    }

    if (invisible) ctx.save();
    if (invisible) ctx.globalAlpha *= 0.35;

    drawCharacter(ctx, x, y, {
      skinId: meta?.skin || 'runner',
      facing: p.facing,
      it,
      immune,
      respawning,
      vx: p.vx,
      vy: p.vy,
      onGround,
      time: this.time,
    });

    if (invisible) ctx.restore();

    if (candyFrozen) {
      // A pulsing glow ring reads against any map's colors (a flat pink tint
      // would vanish into Candy Land's own pink background), plus an icon
      // with a dark stroke so it stays legible even without a color-emoji
      // font available. Candy Land gets its candy icon back; anywhere else
      // (Surge Ruins' Frost Touch power) gets a snowflake in ice blue.
      const glowColor = isCandySource ? '#ff4d9e' : '#5fd0ff';
      const icon = isCandySource ? '\u{1F36C}' : '❄️';
      ctx.save();
      const pulse = 0.55 + Math.sin(this.time * 8) * 0.3;
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 10;
      ctx.strokeRect(x - 4, y - 4, C.PLAYER_W + 8, C.PLAYER_H + 8);
      ctx.restore();

      ctx.save();
      const bob = Math.sin(this.time * 5) * 2;
      ctx.font = '18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.strokeText(icon, x + C.PLAYER_W / 2, y - 12 + bob);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(icon, x + C.PLAYER_W / 2, y - 12 + bob);
      ctx.restore();
    }

    if (power) {
      // A colored ring (a bubble for shield, a rectangle otherwise so it
      // doesn't get confused with the shield bubble at a glance) plus an
      // icon above the head naming which of the four powers is active.
      const color = POWER_COLORS[power];
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(this.time * 6) * 0.22;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      if (power === 'shield') {
        ctx.beginPath();
        ctx.arc(x + C.PLAYER_W / 2, y + C.PLAYER_H / 2, C.PLAYER_W * 0.9, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.strokeRect(x - 4, y - 4, C.PLAYER_W + 8, C.PLAYER_H + 8);
      }
      ctx.restore();

      ctx.save();
      const bob = Math.sin(this.time * 5) * 2;
      ctx.font = '16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.strokeText(POWER_ICONS[power], x + C.PLAYER_W / 2, y - 12 + bob);
      ctx.fillStyle = color;
      ctx.fillText(POWER_ICONS[power], x + C.PLAYER_W / 2, y - 12 + bob);
      ctx.restore();
    }

    if (profile.showNames && meta) {
      ctx.save();
      ctx.font = '600 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const label = meta.name + (meta.isBot ? ' [bot]' : '');
      const tx = x + C.PLAYER_W / 2;
      const ty = y - (it ? 18 : 6);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.65)';
      ctx.strokeText(label, tx, ty);
      ctx.fillStyle = isSelf ? '#39f0d8' : (it ? '#ff9db0' : 'rgba(255,255,255,0.92)');
      ctx.fillText(label, tx, ty);
      ctx.restore();
    }
  }

  // ------------------------------------------------------------------ HUD

  hudData() {
    const rows = [];
    for (const [id, meta] of this.roster) {
      rows.push({
        id,
        name: meta.name,
        isBot: meta.isBot,
        it: meta.it,
        itTime: meta.itTime || 0,
        isYou: id === this.youId,
      });
    }
    rows.sort((a, b) => a.itTime - b.itTime);
    const itPlayer = rows.find((r) => r.it);
    let itName = itPlayer ? (itPlayer.isYou ? 'You are IT' : `${itPlayer.name} is IT`) : '';
    if (itPlayer?.isYou && this.seekerFreeze > 0) {
      itName = `Frozen ${Math.ceil(this.seekerFreeze)}s -- let them hide!`;
    }

    const me = this.latestServerSelf();
    const power = me && me.powerT > 0 ? C.ORB_POWERS[me.power - 1] : null;

    return {
      state: this.state,
      timer: this.timer,
      timeLabel: formatTime(this.timer),
      rows,
      itName,
      power,
      powerLabel: power ? POWER_LABELS[power] : '',
      powerIcon: power ? POWER_ICONS[power] : '',
      powerT: me ? me.powerT : 0,
      fps: this.fps,
      ping: net.state.ping,
    };
  }
}
