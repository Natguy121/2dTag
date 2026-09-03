// Canvas rendering: world, characters, effects. The character drawing is
// shared with the menu previews so a skin always looks the same everywhere.

import * as C from '/shared/constants.js';
import { PLATFORM_H, SPRING_H } from '/shared/maps.js';
import { getSkin } from '/shared/skins.js';

// ------------------------------------------------------------- characters

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/**
 * Draw one character. (x, y) is the top-left of the collision box so this
 * lines up exactly with the physics body.
 */
export function drawCharacter(ctx, x, y, opts = {}) {
  const {
    skinId = 'runner',
    facing = 1,
    it = false,
    immune = false,
    respawning = false,
    vx = 0,
    vy = 0,
    onGround = true,
    time = 0,
    scale = 1,
  } = opts;

  const skin = getSkin(skinId);
  const w = C.PLAYER_W * scale;
  const h = C.PLAYER_H * scale;

  ctx.save();

  if (respawning) ctx.globalAlpha = 0.28;
  // Blink while briefly untaggable.
  else if (immune && Math.floor(time * 12) % 2 === 0) ctx.globalAlpha = 0.45;

  // Squash and stretch from vertical speed keeps movement readable.
  const stretch = Math.max(-0.16, Math.min(0.16, vy / 2600));
  const bw = w * (1 - stretch);
  const bh = h * (1 + stretch);
  const bx = x + (w - bw) / 2;
  const by = y + (h - bh);

  if (it) {
    // Danger aura around the tagger.
    const pulse = 0.55 + Math.sin(time * 9) * 0.2;
    ctx.save();
    ctx.globalAlpha *= pulse;
    ctx.fillStyle = '#ff4d6d';
    ctx.filter = 'blur(6px)';
    roundRect(ctx, bx - 6, by - 6, bw + 12, bh + 12, 12);
    ctx.fill();
    ctx.restore();
  }

  // Legs: a simple two-frame run cycle, tucked up while airborne.
  const legW = bw * 0.26;
  const runPhase = Math.sin(time * 16 + x * 0.08);
  const moving = Math.abs(vx) > 20;
  const legSwing = onGround && moving ? runPhase * bw * 0.2 : 0;
  const legDrop = onGround ? 0 : -bh * 0.08;
  ctx.fillStyle = skin.dark;
  roundRect(ctx, bx + bw * 0.16 + legSwing, by + bh - bh * 0.16 + legDrop, legW, bh * 0.2, 3);
  ctx.fill();
  roundRect(ctx, bx + bw * 0.58 - legSwing, by + bh - bh * 0.16 + legDrop, legW, bh * 0.2, 3);
  ctx.fill();

  // Body.
  const bodyH = bh * 0.86;
  ctx.fillStyle = skin.body;
  roundRect(ctx, bx, by, bw, bodyH, bw * 0.3);
  ctx.fill();

  // Shading down the back half.
  ctx.save();
  roundRect(ctx, bx, by, bw, bodyH, bw * 0.3);
  ctx.clip();
  ctx.fillStyle = skin.dark;
  ctx.globalAlpha *= 0.35;
  ctx.fillRect(facing > 0 ? bx : bx + bw * 0.62, by, bw * 0.38, bodyH);
  ctx.restore();

  // Pattern.
  ctx.save();
  roundRect(ctx, bx, by, bw, bodyH, bw * 0.3);
  ctx.clip();
  if (skin.pattern === 'stripe') {
    ctx.fillStyle = skin.dark;
    ctx.globalAlpha *= 0.7;
    ctx.fillRect(bx, by + bodyH * 0.42, bw, bodyH * 0.16);
  } else if (skin.pattern === 'spots') {
    ctx.fillStyle = skin.dark;
    ctx.globalAlpha *= 0.6;
    for (const [sx, sy, sr] of [[0.24, 0.3, 0.1], [0.68, 0.5, 0.13], [0.4, 0.72, 0.09]]) {
      ctx.beginPath();
      ctx.arc(bx + bw * sx, by + bodyH * sy, bw * sr, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (skin.pattern === 'robot') {
    ctx.fillStyle = skin.dark;
    ctx.globalAlpha *= 0.5;
    ctx.fillRect(bx, by + bodyH * 0.62, bw, 2);
    ctx.fillRect(bx, by + bodyH * 0.74, bw, 2);
  } else if (skin.pattern === 'ghost') {
    ctx.fillStyle = skin.trim;
    ctx.globalAlpha *= 0.25;
    ctx.beginPath();
    ctx.arc(bx + bw * 0.5, by + bodyH * 0.8, bw * 0.34, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Face.
  const eyeY = by + bodyH * 0.36;
  const lookX = facing > 0 ? bw * 0.1 : -bw * 0.1;
  if (skin.pattern === 'visor') {
    ctx.fillStyle = skin.trim;
    roundRect(ctx, bx + bw * 0.12, eyeY - bodyH * 0.08, bw * 0.76, bodyH * 0.22, 4);
    ctx.fill();
    ctx.fillStyle = skin.eye;
    ctx.globalAlpha *= 0.55;
    roundRect(ctx, bx + bw * 0.18 + lookX * 0.5, eyeY - bodyH * 0.04, bw * 0.3, bodyH * 0.12, 3);
    ctx.fill();
    ctx.globalAlpha = respawning ? 0.28 : 1;
  } else {
    for (const off of [-0.17, 0.17]) {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(bx + bw * (0.5 + off) + lookX * 0.35, eyeY, bw * 0.13, bw * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = skin.eye;
      ctx.beginPath();
      ctx.arc(bx + bw * (0.5 + off) + lookX * 0.6, eyeY + bw * 0.02, bw * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Trim highlight along the top.
  ctx.strokeStyle = skin.trim;
  ctx.globalAlpha *= 0.5;
  ctx.lineWidth = Math.max(1, 1.4 * scale);
  roundRect(ctx, bx + 1, by + 1, bw - 2, bodyH - 2, bw * 0.28);
  ctx.stroke();

  ctx.restore();

  // The "it" marker sits above the head, outside the alpha changes above.
  if (it) {
    ctx.save();
    const bob = Math.sin(time * 6) * 2;
    ctx.fillStyle = '#ff4d6d';
    ctx.beginPath();
    const cx = x + w / 2;
    const ty = y - 12 * scale + bob;
    ctx.moveTo(cx, ty + 9 * scale);
    ctx.lineTo(cx - 6 * scale, ty);
    ctx.lineTo(cx + 6 * scale, ty);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

// ----------------------------------------------------------------- world

function drawSolid(ctx, s, theme) {
  const [x, y, w, h] = s;
  ctx.fillStyle = theme.solid;
  roundRect(ctx, x, y, w, h, 4);
  ctx.fill();

  // Bright lip on top so edges read clearly against the background.
  ctx.fillStyle = theme.solidEdge;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(x, y, w, 3);
  ctx.globalAlpha = 0.16;
  ctx.fillRect(x, y + 3, w, h - 3);
  ctx.globalAlpha = 1;
}

function drawPlatform(ctx, p, theme) {
  const [x, y, w] = p;
  ctx.fillStyle = theme.platform;
  roundRect(ctx, x, y, w, PLATFORM_H, 5);
  ctx.fill();
  ctx.fillStyle = theme.solidEdge;
  ctx.globalAlpha = 0.9;
  ctx.fillRect(x + 2, y, w - 4, 2.5);
  ctx.globalAlpha = 1;
}

function drawSpring(ctx, s, theme, time) {
  const [x, y, w] = s;
  const bounce = Math.abs(Math.sin(time * 3)) * 2;
  ctx.fillStyle = theme.accent;
  roundRect(ctx, x, y - bounce, w, SPRING_H + bounce, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(x + 3, y - bounce + (SPRING_H + bounce) * (i / 3));
    ctx.lineTo(x + w - 3, y - bounce + (SPRING_H + bounce) * (i / 3));
    ctx.stroke();
  }
}

function drawHazard(ctx, h, theme, time) {
  const [x, y, w, hh] = h;
  const grad = ctx.createLinearGradient(0, y - 6, 0, y + hh);
  grad.addColorStop(0, theme.hazard);
  grad.addColorStop(1, 'rgba(120,20,0,0.95)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x, y + hh);
  ctx.lineTo(x, y + 2);
  // Wavy molten surface.
  for (let px = 0; px <= w; px += 8) {
    const wave = Math.sin((px + time * 60) * 0.05) * 2.5 + Math.sin((px - time * 90) * 0.11) * 1.5;
    ctx.lineTo(x + px, y + 2 + wave);
  }
  ctx.lineTo(x + w, y + hh);
  ctx.closePath();
  ctx.fill();

  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.filter = 'blur(6px)';
  ctx.fillStyle = theme.hazard;
  ctx.fillRect(x, y - 10, w, 16);
  ctx.restore();
}

function drawBackground(ctx, map, cam, view, time) {
  const theme = map.theme;
  const grad = ctx.createLinearGradient(0, 0, 0, view.h);
  grad.addColorStop(0, theme.sky[0]);
  grad.addColorStop(0.55, theme.sky[1]);
  grad.addColorStop(1, theme.sky[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, view.w, view.h);

  // Parallax decor, drawn in screen space with a slow camera offset.
  const px = -cam.x * 0.25;
  const py = -cam.y * 0.25;
  ctx.save();
  ctx.globalAlpha = 0.5;

  if (theme.decor === 'stars') {
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 90; i++) {
      const sx = ((i * 137.5 + px * 0.5) % (view.w + 60)) - 30;
      const sy = ((i * 91.7 + py * 0.5) % (view.h + 60)) - 30;
      const tw = 0.4 + Math.abs(Math.sin(time * 1.6 + i)) * 0.6;
      ctx.globalAlpha = 0.25 + tw * 0.5;
      ctx.fillRect(sx, sy, 2, 2);
    }
    // The planet on the horizon.
    ctx.globalAlpha = 0.32;
    ctx.fillStyle = '#5b74d8';
    ctx.beginPath();
    ctx.arc(view.w * 0.78 + px * 0.3, view.h * 0.26 + py * 0.3, 78, 0, Math.PI * 2);
    ctx.fill();
  } else if (theme.decor === 'clouds') {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 10; i++) {
      const sx = ((i * 260 + px + time * 6) % (view.w + 400)) - 200;
      const sy = 60 + ((i * 137) % Math.max(1, view.h * 0.55)) + py * 0.4;
      ctx.beginPath();
      ctx.ellipse(sx, sy, 90, 26, 0, 0, Math.PI * 2);
      ctx.ellipse(sx + 50, sy + 8, 60, 20, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (theme.decor === 'snow') {
    ctx.fillStyle = '#eafaff';
    for (let i = 0; i < 70; i++) {
      const sx = ((i * 173 + px * 0.6 + Math.sin(time + i) * 20) % (view.w + 40)) - 20;
      const sy = ((i * 97 + time * 28 + py * 0.6) % (view.h + 40)) - 20;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(sx, sy, 2.5, 2.5);
    }
  } else if (theme.decor === 'embers') {
    ctx.fillStyle = '#ff9142';
    for (let i = 0; i < 50; i++) {
      const sx = ((i * 211 + px * 0.6 + Math.sin(time * 0.8 + i) * 30) % (view.w + 40)) - 20;
      const sy = view.h - ((i * 143 + time * 42 + py * 0.6) % (view.h + 60));
      ctx.globalAlpha = 0.3;
      ctx.fillRect(sx, sy, 2.5, 3.5);
    }
  } else if (theme.decor === 'leaves') {
    ctx.fillStyle = '#8fe38a';
    for (let i = 0; i < 34; i++) {
      const sx = ((i * 197 + px * 0.7 + Math.sin(time * 0.7 + i * 2) * 40) % (view.w + 40)) - 20;
      const sy = ((i * 121 + time * 16 + py * 0.7) % (view.h + 40)) - 20;
      ctx.globalAlpha = 0.28;
      ctx.beginPath();
      ctx.ellipse(sx, sy, 5, 2.5, time + i, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Neon grid.
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;
    const step = 60;
    const ox = px % step;
    const oy = py % step;
    for (let gx = ox; gx < view.w; gx += step) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, view.h); ctx.stroke();
    }
    for (let gy = oy; gy < view.h; gy += step) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(view.w, gy); ctx.stroke();
    }
  }
  ctx.restore();
}

/** Draw the whole world. Camera transform is applied by the caller. */
export function drawMap(ctx, map, time) {
  const theme = map.theme;

  // Depth wash over the play area. A flat fill reads as a hard-edged block
  // where the world ends, so fade it in from the top instead.
  ctx.save();
  const wash = ctx.createLinearGradient(0, 0, 0, map.height);
  wash.addColorStop(0, 'rgba(0,0,0,0)');
  wash.addColorStop(0.45, theme.fog);
  wash.addColorStop(1, theme.fog);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, map.width, map.height);
  ctx.restore();

  for (const s of map.solids) drawSolid(ctx, s, theme);
  for (const p of map.platforms) drawPlatform(ctx, p, theme);
  for (const s of map.springs || []) drawSpring(ctx, s, theme, time);
  for (const h of map.hazards || []) drawHazard(ctx, h, theme, time);
}

export { drawBackground };

// ------------------------------------------------------------- particles

export class Particles {
  constructor(limit = 400) {
    this.items = [];
    this.limit = limit;
  }

  spawn(x, y, count, opts = {}) {
    const {
      color = '#fff', speed = 120, life = 0.5, size = 3, gravity = 900, spread = Math.PI * 2, angle = 0,
    } = opts;
    for (let i = 0; i < count; i++) {
      if (this.items.length >= this.limit) this.items.shift();
      const a = angle + (Math.random() - 0.5) * spread;
      const sp = speed * (0.4 + Math.random() * 0.8);
      this.items.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: life * (0.6 + Math.random() * 0.7),
        age: 0,
        color,
        size: size * (0.6 + Math.random() * 0.8),
        gravity,
      });
    }
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.age += dt;
      if (p.age >= p.life) { this.items.splice(i, 1); continue; }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  draw(ctx) {
    for (const p of this.items) {
      const k = 1 - p.age / p.life;
      ctx.globalAlpha = Math.max(0, k);
      ctx.fillStyle = p.color;
      const s = p.size * (0.4 + k * 0.6);
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  }

  clear() {
    this.items.length = 0;
  }
}

// --------------------------------------------------------- map previews

/** Draw a scaled-down map into a small canvas for the menus. */
export function drawMapPreview(canvas, map) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cssW = canvas.clientWidth || canvas.width;
  const cssH = canvas.clientHeight || canvas.height;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const theme = map.theme;
  const grad = ctx.createLinearGradient(0, 0, 0, cssH);
  grad.addColorStop(0, theme.sky[0]);
  grad.addColorStop(1, theme.sky[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cssW, cssH);

  const scale = Math.min(cssW / map.width, cssH / map.height);
  ctx.save();
  ctx.translate((cssW - map.width * scale) / 2, (cssH - map.height * scale) / 2);
  ctx.scale(scale, scale);

  ctx.fillStyle = theme.solid;
  for (const s of map.solids) ctx.fillRect(s[0], s[1], s[2], s[3]);
  ctx.fillStyle = theme.solidEdge;
  for (const s of map.solids) ctx.fillRect(s[0], s[1], s[2], 6);
  ctx.fillStyle = theme.platform;
  for (const p of map.platforms) ctx.fillRect(p[0], p[1], p[2], PLATFORM_H);
  ctx.fillStyle = theme.accent;
  for (const s of map.springs || []) ctx.fillRect(s[0], s[1], s[2], SPRING_H);
  ctx.fillStyle = theme.hazard;
  for (const h of map.hazards || []) ctx.fillRect(h[0], h[1], h[2], h[3]);

  ctx.restore();
}

/** Draw a single character centred in a small canvas, for skin previews. */
export function drawSkinPreview(canvas, skinId, opts = {}) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cssW = canvas.clientWidth || canvas.width;
  const cssH = canvas.clientHeight || canvas.height;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const scale = Math.min(cssW / (C.PLAYER_W * 1.7), cssH / (C.PLAYER_H * 1.4));
  const w = C.PLAYER_W * scale;
  const h = C.PLAYER_H * scale;
  drawCharacter(ctx, (cssW - w) / 2, (cssH - h) / 2 + 4, {
    skinId,
    scale,
    facing: 1,
    time: opts.time ?? 0,
    onGround: true,
    it: opts.it || false,
  });
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
