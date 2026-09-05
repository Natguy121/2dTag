// Canvas rendering: world, characters, effects. The character drawing is
// shared with the menu previews so a skin always looks the same everywhere.

import * as C from '/shared/constants.js';
import { PLATFORM_H, SPRING_H, PORTAL_W, PORTAL_H } from '/shared/maps.js';
import { getSkin } from '/shared/skins.js';

// ------------------------------------------------------------- characters

// Frankenstein's Lab: the fixed look everyone takes on while "it" there,
// replacing their equipped skin entirely -- see drawCharacter's
// `frankenstein` option.
const FRANKENSTEIN_SKIN = {
  body: '#5fae4a', dark: '#2f6b24', trim: '#d8ffc2', eye: '#1a2b0a', pattern: 'solid',
};

/**
 * The Chameleon skin: a genuinely different silhouette instead of the usual
 * rounded-rect blob -- an egg-shaped body, a curled tail, a serrated dorsal
 * crest and turret eyes on stalks, with skin color that slowly drifts
 * through greens the way a real chameleon shifts color. Draws in place of
 * the normal legs/body/pattern/face block in drawCharacter.
 */
function drawChameleonBody(ctx, bx, by, bw, bodyH, facing, vx, onGround, time, scale) {
  const dir = facing >= 0 ? 1 : -1;
  const hue = 96 + Math.sin(time * 0.4) * 22;
  const body = `hsl(${hue}, 46%, 42%)`;
  const dark = `hsl(${hue}, 46%, 25%)`;
  const light = `hsl(${hue + 10}, 55%, 68%)`;
  const belly = `hsl(${hue - 12}, 38%, 74%)`;
  const cx = bx + bw * 0.5;
  const bodyRx = bw * 0.32;
  const bodyRy = bodyH * 0.35;
  const bodyCy = by + bodyH * 0.5;

  // Curled tail poking out past the body's edge -- the single most
  // identifying chameleon feature, and the one thing a rounded-rect blob
  // could never show. Drawn first so the body's fill cleanly covers its
  // attachment point, leaving only the curl visible outside the silhouette.
  const tailBaseX = cx - dir * bodyRx * 1.05;
  const tailBaseY = by + bodyH * 0.6;
  ctx.strokeStyle = body;
  ctx.lineCap = 'round';
  ctx.lineWidth = bw * 0.11;
  ctx.beginPath();
  ctx.moveTo(tailBaseX, tailBaseY);
  const turns = 1.5;
  const steps = 20;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const ang = -dir * t * turns * Math.PI * 2;
    const r = bw * 0.26 * (1 - t * 0.78);
    ctx.lineTo(
      tailBaseX - dir * bw * 0.14 + Math.cos(ang) * r,
      tailBaseY + bodyH * 0.14 + Math.sin(ang) * r * 0.85,
    );
  }
  ctx.stroke();

  // Main body: a tall egg shape, not a rounded rectangle.
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(cx, bodyCy, bodyRx, bodyRy, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pale belly patch underneath.
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, bodyCy, bodyRx, bodyRy, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = belly;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.ellipse(cx, by + bodyH * 0.72, bodyRx * 0.8, bodyRy * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Gripping feet -- small rounded pads, drawn after the body so they show
  // beneath it instead of being painted over.
  const legSwing = onGround && Math.abs(vx) > 20 ? Math.sin(time * 16 + bx * 0.08) * bw * 0.16 : 0;
  const legDrop = onGround ? 0 : -bodyH * 0.06;
  ctx.fillStyle = dark;
  for (const side of [-1, 1]) {
    const fx = cx + side * bw * 0.2 + (side < 0 ? legSwing : -legSwing);
    const fy = by + bodyH * 0.94 + legDrop;
    ctx.beginPath();
    ctx.ellipse(fx, fy, bw * 0.11, bw * 0.075, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Head: a rounded bump toward the front-top of the body.
  const headCx = cx + dir * bw * 0.04;
  const headCy = by + bodyH * 0.22;
  const headRx = bw * 0.23;
  const headRy = bodyH * 0.19;
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(headCx, headCy, headRx, headRy, 0, 0, Math.PI * 2);
  ctx.fill();

  // Serrated dorsal crest running down the midline from crown to tail base,
  // drawn last so it's never hidden under the head or body fills.
  ctx.fillStyle = dark;
  const crestStops = [0.03, 0.14, 0.27, 0.42, 0.58];
  for (let i = 0; i < crestStops.length; i++) {
    const sy = by + bodyH * crestStops[i];
    const size = bw * (0.05 - i * 0.006);
    ctx.beginPath();
    ctx.moveTo(cx - size, sy + size * 1.5);
    ctx.lineTo(cx, sy);
    ctx.lineTo(cx + size, sy + size * 1.5);
    ctx.closePath();
    ctx.fill();
  }

  // Turret eyes on stalks, each capped with a round eyeball -- the other
  // unmistakably-chameleon feature. The stalk uses the dark shade so it
  // reads clearly against the head instead of blending into it.
  for (const off of [-0.24, 0.24]) {
    const ex = headCx + bw * off;
    const ey = headCy - headRy * 0.5;
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(ex - bw * 0.075, ey + bw * 0.05);
    ctx.lineTo(ex + bw * 0.075, ey + bw * 0.05);
    ctx.lineTo(ex, ey - bw * 0.16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex, ey - bw * 0.17, bw * 0.075, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#12210a';
    ctx.beginPath();
    ctx.arc(ex + dir * bw * 0.025, ey - bw * 0.17, bw * 0.04, 0, Math.PI * 2);
    ctx.fill();
  }

  // Trim highlight along the back, matching the rest of the roster's finish.
  ctx.strokeStyle = light;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = Math.max(1, 1.2 * scale);
  ctx.beginPath();
  ctx.ellipse(cx, bodyCy, bodyRx - 1, bodyRy - 1, 0, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/**
 * The Web Weaver skin: an original masked web-slinging hero (not a licensed
 * character), and like Chameleon a genuinely different silhouette rather
 * than a recolored blob -- two arms raised in a web-shooting pose, angular
 * mask lenses instead of round eyes, a web pattern across the chest, and an
 * animated strand of webbing pulsing out of each fist. Purely cosmetic --
 * the "shooting webs" is a visual flourish, not a gameplay ability.
 */
function drawWebWeaverBody(ctx, bx, by, bw, bodyH, facing, vx, onGround, time, scale) {
  const dir = facing >= 0 ? 1 : -1;
  const suit = '#8a1220';
  const suitDark = '#420a10';
  const web = '#f0f0f0';
  const trim = '#141414';
  const cx = bx + bw * 0.5;

  // Legs: the same run cycle every other skin uses, drawn first and
  // extending past the torso's own height so they still show below it once
  // the torso paints over their top sliver (matching the standard renderer).
  const legW = bw * 0.26;
  const runPhase = Math.sin(time * 16 + bx * 0.08);
  const moving = onGround && Math.abs(vx) > 20;
  const legSwing = moving ? runPhase * bw * 0.2 : 0;
  const legDrop = onGround ? 0 : -bodyH * 0.08;
  ctx.fillStyle = suitDark;
  roundRect(ctx, bx + bw * 0.16 + legSwing, by + bodyH * 0.97 + legDrop, legW, bodyH * 0.22, 3);
  ctx.fill();
  roundRect(ctx, bx + bw * 0.58 - legSwing, by + bodyH * 0.97 + legDrop, legW, bodyH * 0.22, 3);
  ctx.fill();

  // Torso.
  ctx.fillStyle = suit;
  roundRect(ctx, bx, by, bw, bodyH, bw * 0.3);
  ctx.fill();
  ctx.save();
  roundRect(ctx, bx, by, bw, bodyH, bw * 0.3);
  ctx.clip();
  ctx.fillStyle = suitDark;
  ctx.globalAlpha = 0.35;
  ctx.fillRect(facing > 0 ? bx : bx + bw * 0.62, by, bw * 0.38, bodyH);
  ctx.restore();

  // Web pattern radiating across the chest -- spokes plus concentric rings.
  ctx.save();
  roundRect(ctx, bx, by, bw, bodyH, bw * 0.3);
  ctx.clip();
  const webCx = cx;
  const webCy = by + bodyH * 0.6;
  ctx.strokeStyle = trim;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = Math.max(1, scale);
  for (let a = 0; a < 6; a++) {
    const ang = (a / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(webCx, webCy);
    ctx.lineTo(webCx + Math.cos(ang) * bw * 0.6, webCy + Math.sin(ang) * bw * 0.6);
    ctx.stroke();
  }
  for (const r of [0.13, 0.25, 0.38]) {
    ctx.beginPath();
    ctx.arc(webCx, webCy, bw * r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // Mask: angular white lens shapes instead of the usual round eyes, tilted
  // outward, plus a center seam -- the single most identifying feature.
  const eyeY = by + bodyH * 0.34;
  for (const off of [-0.2, 0.2]) {
    const ex = cx + bw * off;
    const rot = off < 0 ? 0.4 : -0.4;
    ctx.fillStyle = trim;
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, bw * 0.15, bw * 0.1, rot, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = web;
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, bw * 0.11, bw * 0.068, rot, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = trim;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = Math.max(1, 1.2 * scale);
  ctx.beginPath();
  ctx.moveTo(cx, by + bodyH * 0.08);
  ctx.lineTo(cx, by + bodyH * 0.5);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Arms raised in a web-shooting pose, each firing an animated strand --
  // the "shoot webs" flourish, and the reason this skin has a silhouette no
  // rounded-rect blob could match: it's the only one with arms at all.
  const shoulderY = by + bodyH * 0.5;
  for (const side of [-1, 1]) {
    const shoulderX = cx + side * bw * 0.47;
    const elbowX = shoulderX + side * bw * 0.13;
    const elbowY = shoulderY - bodyH * 0.07;
    const fistX = elbowX + side * bw * 0.12;
    const fistY = elbowY - bodyH * 0.13;

    ctx.strokeStyle = suit;
    ctx.lineCap = 'round';
    ctx.lineWidth = bw * 0.15;
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(elbowX, elbowY);
    ctx.lineTo(fistX, fistY);
    ctx.stroke();

    ctx.fillStyle = suit;
    ctx.beginPath();
    ctx.arc(fistX, fistY, bw * 0.09, 0, Math.PI * 2);
    ctx.fill();

    // Web-shooter cuff at the wrist.
    ctx.strokeStyle = web;
    ctx.lineWidth = Math.max(1, 1.4 * scale);
    ctx.beginPath();
    ctx.arc(elbowX + side * bw * 0.05, elbowY - bodyH * 0.04, bw * 0.07, 0, Math.PI * 2);
    ctx.stroke();

    // Animated strand of webbing pulsing outward from the fist.
    const pulse = (Math.sin(time * 3 + side * 1.7) + 1) / 2;
    const strandLen = bw * (0.55 + pulse * 0.35);
    const strandAng = side * -0.55;
    const endX = fistX + Math.cos(strandAng) * strandLen;
    const endY = fistY + Math.sin(strandAng) * strandLen;
    const midX = fistX + Math.cos(strandAng) * strandLen * 0.5 + side * bw * 0.05 * Math.sin(time * 6 + side);
    const midY = fistY + Math.sin(strandAng) * strandLen * 0.5;
    ctx.strokeStyle = web;
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = Math.max(1, 1.4 * scale);
    ctx.beginPath();
    ctx.moveTo(fistX, fistY);
    ctx.quadraticCurveTo(midX, midY, endX, endY);
    ctx.stroke();
    ctx.fillStyle = web;
    ctx.beginPath();
    ctx.arc(endX, endY, bw * 0.035, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Trim highlight along the top, matching the rest of the roster's finish.
  ctx.strokeStyle = web;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = Math.max(1, 1.4 * scale);
  roundRect(ctx, bx + 1, by + 1, bw - 2, bodyH - 2, bw * 0.28);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

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
    frankenstein = false,
  } = opts;

  // Frankenstein's Lab: whoever is "it" fully transforms into the monster,
  // overriding their equipped skin entirely -- a flat solid pattern keeps
  // every other pattern branch below a no-op instead of needing special-casing.
  const skin = frankenstein ? FRANKENSTEIN_SKIN : getSkin(skinId);
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

  const bodyH = bh * 0.86;

  if (skin.pattern === 'chameleon') {
    drawChameleonBody(ctx, bx, by, bw, bodyH, facing, vx, onGround, time, scale);
  } else if (skin.pattern === 'webweaver') {
    drawWebWeaverBody(ctx, bx, by, bw, bodyH, facing, vx, onGround, time, scale);
  } else {
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
    if (skin.pattern === 'rainbow') {
      const grad = ctx.createLinearGradient(bx, by, bx, by + bodyH);
      const hueBase = (time * 90) % 360;
      for (let i = 0; i <= 5; i++) grad.addColorStop(i / 5, `hsl(${(hueBase + i * 55) % 360}, 90%, 62%)`);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = skin.body;
    }
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
    } else if (skin.pattern === 'rainbow') {
      ctx.fillStyle = '#ffffff';
      for (const [sx, sy, ph] of [[0.28, 0.32, 0], [0.66, 0.5, 2.1], [0.42, 0.7, 4.2]]) {
        const tw = 0.35 + Math.max(0, Math.sin(time * 4 + ph)) * 0.5;
        ctx.globalAlpha = tw;
        ctx.beginPath();
        ctx.arc(bx + bw * sx, by + bodyH * sy, bw * 0.045, 0, Math.PI * 2);
        ctx.fill();
      }
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

    if (frankenstein) {
      // Neck bolts jutting from either side of the head.
      ctx.globalAlpha = 1;
      for (const side of [-1, 1]) {
        const boltX = side < 0 ? bx - bw * 0.05 : bx + bw * 1.05;
        const boltY = eyeY + bodyH * 0.24;
        ctx.fillStyle = '#c7cdd6';
        ctx.beginPath();
        ctx.ellipse(boltX, boltY, bw * 0.09, bw * 0.06, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#5a6270';
        ctx.lineWidth = Math.max(1, 1.2 * scale);
        ctx.stroke();
      }
      // A stitched scar across the forehead.
      ctx.strokeStyle = '#16290d';
      ctx.lineWidth = Math.max(1.4, 1.8 * scale);
      ctx.beginPath();
      ctx.moveTo(bx + bw * 0.22, eyeY - bodyH * 0.17);
      ctx.lineTo(bx + bw * 0.78, eyeY - bodyH * 0.17);
      ctx.stroke();
      ctx.lineWidth = Math.max(1, 1.2 * scale);
      for (let sx = 0.28; sx <= 0.74; sx += 0.115) {
        ctx.beginPath();
        ctx.moveTo(bx + bw * sx, eyeY - bodyH * 0.22);
        ctx.lineTo(bx + bw * sx, eyeY - bodyH * 0.12);
        ctx.stroke();
      }
    }
  }

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

const CANDY_COLORS = ['#ff4d6d', '#ffd166', '#4ff0c1', '#4cc9f0', '#a06bff', '#ff8fc4'];

/** A small wrapped candy pickup. Purely a map decoration -- server/room.js
 * owns the actual freeze-on-touch logic. */
function drawCandy(ctx, c, time, seed) {
  const [x, y, w, h] = c;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const bob = Math.sin(time * 2.4 + seed) * 2;
  const color = CANDY_COLORS[seed % CANDY_COLORS.length];

  ctx.save();
  ctx.translate(cx, cy + bob);

  // Wrapper twists on either side of the round body.
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-w * 0.5, 0);
  ctx.lineTo(-w * 0.3, -h * 0.22);
  ctx.lineTo(-w * 0.3, h * 0.22);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.5, 0);
  ctx.lineTo(w * 0.3, -h * 0.22);
  ctx.lineTo(w * 0.3, h * 0.22);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, 0, w * 0.34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.arc(-w * 0.1, -h * 0.1, w * 0.12, 0, Math.PI * 2);
  ctx.fill();

  const tw = 0.4 + Math.max(0, Math.sin(time * 3 + seed * 1.7)) * 0.6;
  ctx.globalAlpha = tw;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(w * 0.22, h * 0.18, 1.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

const ORB_COLORS = ['#ffd166', '#4ff08a', '#4cc9f0', '#c58bff'];

/** A glowing power-orb pickup. cooldown > 0 means it was just grabbed and
 * hasn't respawned yet, so it's drawn dim and inert instead of glowing. */
function drawOrb(ctx, o, time, seed, cooldown) {
  const [x, y, w, h] = o;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const color = ORB_COLORS[seed % ORB_COLORS.length];

  if (cooldown > 0) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  const bob = Math.sin(time * 2.2 + seed) * 3;
  const pulse = 0.7 + Math.sin(time * 4 + seed * 1.6) * 0.3;

  ctx.save();
  ctx.translate(cx, cy + bob);

  // Soft outer bloom.
  ctx.globalAlpha = 0.35 * pulse;
  ctx.filter = 'blur(6px)';
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, w * 0.62, 0, Math.PI * 2);
  ctx.fill();
  ctx.filter = 'none';

  // Solid core with a bright highlight so it reads as a sphere, not a disc.
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, w * 0.36, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.arc(-w * 0.1, -h * 0.1, w * 0.13, 0, Math.PI * 2);
  ctx.fill();

  // A thin rotating ring hints at "unstable power" better than a static circle.
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(0, 0, w * 0.52, w * 0.2, time * 1.6 + seed, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

/** A musical-chairs seat. `active` chairs (currently sittable) glow in the
 * map's own colors and bob gently; inactive ones (already removed from
 * play this round) sit dim and gray so it's obvious not to bother. */
function drawChair(ctx, c, active, theme, time, seed) {
  const [x, y, w, h] = c;
  const bob = active ? Math.sin(time * 2 + seed) * 1.5 : 0;
  ctx.save();
  ctx.translate(0, bob);

  if (active) {
    ctx.globalAlpha = 0.35;
    ctx.filter = 'blur(4px)';
    ctx.fillStyle = theme.accent;
    ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
    ctx.filter = 'none';
  }

  ctx.globalAlpha = active ? 1 : 0.3;
  // Backrest.
  ctx.fillStyle = active ? theme.accent : '#5a5a66';
  ctx.fillRect(x, y, w * 0.22, h);
  // Seat.
  ctx.fillStyle = active ? theme.platform : '#4a4a54';
  ctx.fillRect(x, y + h * 0.6, w, h * 0.4);
  // Legs.
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(x + 2, y + h - 2, 3, 5);
  ctx.fillRect(x + w - 5, y + h - 2, 3, 5);

  if (active) {
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
  }

  ctx.restore();
}

function drawPortalDoor(ctx, x, y, hue, time, phase) {
  const cx = x + PORTAL_W / 2;
  const cy = y + PORTAL_H / 2;

  // Frame.
  ctx.save();
  ctx.strokeStyle = hue;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 3;
  roundRect(ctx, x, y, PORTAL_W, PORTAL_H, 10);
  ctx.stroke();
  ctx.restore();

  // Swirling glow inside the frame -- a few rotating rings, clipped to the door.
  ctx.save();
  roundRect(ctx, x + 3, y + 3, PORTAL_W - 6, PORTAL_H - 6, 8);
  ctx.clip();

  const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, PORTAL_W * 0.7);
  grad.addColorStop(0, 'rgba(10,6,16,0.92)');
  grad.addColorStop(1, hue);
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, PORTAL_W, PORTAL_H);

  ctx.strokeStyle = hue;
  for (let i = 0; i < 3; i++) {
    const t = time * (1.4 + i * 0.3) + phase + i * 2.1;
    const rw = PORTAL_W * (0.22 + i * 0.16);
    const rh = PORTAL_H * (0.14 + i * 0.11);
    ctx.globalAlpha = 0.5 - i * 0.12;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.abs(rw), Math.abs(rh), t, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // Soft outer bloom so it reads from a distance.
  ctx.save();
  ctx.globalAlpha = 0.35 + Math.sin(time * 2.5 + phase) * 0.08;
  ctx.filter = 'blur(8px)';
  ctx.fillStyle = hue;
  roundRect(ctx, x - 4, y - 4, PORTAL_W + 8, PORTAL_H + 8, 12);
  ctx.fill();
  ctx.restore();
}

function drawPortal(ctx, portal, time) {
  drawPortalDoor(ctx, portal.a[0], portal.a[1], portal.hue, time, 0);
  drawPortalDoor(ctx, portal.b[0], portal.b[1], portal.hue, time, Math.PI);
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
  } else if (theme.decor === 'dust') {
    // Warm motes drifting slowly through lamplight, plus a couple of soft
    // window-glow patches so the room doesn't feel flat.
    ctx.fillStyle = '#ffe9b8';
    for (let i = 0; i < 40; i++) {
      const sx = ((i * 163 + px * 0.5 + Math.sin(time * 0.4 + i) * 26) % (view.w + 40)) - 20;
      const sy = ((i * 131 + time * 8 + py * 0.5 + Math.sin(time * 0.6 + i * 1.7) * 18) % (view.h + 40)) - 20;
      ctx.globalAlpha = 0.22 + Math.sin(time * 1.3 + i) * 0.1;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffd166';
    for (const [gx, gy] of [[0.18, 0.3], [0.62, 0.18], [0.85, 0.5]]) {
      ctx.globalAlpha = 0.1;
      ctx.beginPath();
      ctx.ellipse(view.w * gx + px * 0.2, view.h * gy + py * 0.2, 140, 90, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (theme.decor === 'ruins') {
    // Faint sky glimpsed through a broken ceiling, plus cool motes and a
    // couple of soft teal glow patches -- 'dust' recolored for a moonlit
    // stone theme instead of warm lamplight, so it reads as ambient magic
    // rather than a mismatched amber haze against a cyan/purple palette.
    ctx.fillStyle = '#dffcff';
    for (let i = 0; i < 36; i++) {
      const sx = ((i * 151 + px * 0.4) % (view.w + 60)) - 30;
      const sy = ((i * 83 + py * 0.4) % (view.h * 0.6 + 60)) - 30;
      const tw = 0.3 + Math.abs(Math.sin(time * 1.4 + i)) * 0.4;
      ctx.globalAlpha = 0.15 + tw * 0.25;
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.fillStyle = '#9ff5e6';
    for (let i = 0; i < 34; i++) {
      const sx = ((i * 163 + px * 0.5 + Math.sin(time * 0.4 + i) * 26) % (view.w + 40)) - 20;
      const sy = ((i * 131 + time * 7 + py * 0.5 + Math.sin(time * 0.6 + i * 1.7) * 18) % (view.h + 40)) - 20;
      ctx.globalAlpha = 0.16 + Math.sin(time * 1.3 + i) * 0.08;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#7dffea';
    for (const [gx, gy] of [[0.18, 0.28], [0.65, 0.16], [0.85, 0.48]]) {
      ctx.globalAlpha = 0.06;
      ctx.beginPath();
      ctx.ellipse(view.w * gx + px * 0.2, view.h * gy + py * 0.2, 150, 100, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (theme.decor === 'sparks') {
    // A mad scientist's lab: stray arcs of electricity crackling on and off
    // in the rafters, plus a couple of softly bubbling green chemical-jar
    // glows low in the background.
    for (let i = 0; i < 16; i++) {
      const seed = i * 97.3;
      const flick = Math.sin(time * (2.4 + (i % 5) * 0.7) + seed) > 0.75;
      if (!flick) continue;
      const sx = ((i * 173 + px * 0.4) % (view.w + 60)) - 30;
      const sy = ((i * 61 + py * 0.4) % (view.h * 0.5 + 40)) - 20;
      ctx.strokeStyle = i % 2 === 0 ? '#9dffb0' : '#c58bff';
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + 7, sy + 9);
      ctx.lineTo(sx + 2, sy + 13);
      ctx.lineTo(sx + 11, sy + 24);
      ctx.stroke();
    }
    ctx.fillStyle = '#5dffa0';
    for (const [gx, gy] of [[0.16, 0.62], [0.5, 0.72], [0.84, 0.6]]) {
      ctx.globalAlpha = 0.08 + Math.sin(time * 1.1 + gx * 6) * 0.03;
      ctx.beginPath();
      ctx.ellipse(view.w * gx + px * 0.2, view.h * gy + py * 0.2, 90, 130, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (theme.decor === 'sprinkles') {
    // Colorful confetti-like sprinkles drifting down for the candy map.
    for (let i = 0; i < 60; i++) {
      const sx = ((i * 149 + px * 0.6 + Math.sin(time * 0.5 + i) * 22) % (view.w + 40)) - 20;
      const sy = ((i * 107 + time * 30 + py * 0.6) % (view.h + 40)) - 20;
      ctx.fillStyle = CANDY_COLORS[i % CANDY_COLORS.length];
      ctx.globalAlpha = 0.4;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(time * 0.8 + i);
      ctx.fillRect(-2, -1, 4, 2);
      ctx.restore();
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

const RAINBOW_BANDS = ['#ff3b3b', '#ff9f1c', '#ffe066', '#4dd67d', '#3ba7ff', '#5b6bff', '#c25bff'];

/**
 * A big rainbow arcing across the sky as a round begins -- sweeps in from
 * the left over `reveal` (0 -> 1 across the countdown) and is faded out by
 * `alpha` once play starts. Screen-space, drawn before the world transform
 * so it sits behind the map and players like distant sky, not a HUD element.
 */
export function drawRoundStartRainbow(ctx, view, reveal, alpha) {
  const sweep = Math.PI * Math.max(0, Math.min(1, reveal));
  if (sweep <= 0 || alpha <= 0) return;

  const cx = view.w / 2;
  const cy = view.h + view.h * 0.15;
  const outerR = view.h * 1.05;
  const thickness = view.h * 0.032;

  ctx.save();
  ctx.globalAlpha = alpha * 0.8;
  ctx.lineCap = 'butt';
  for (let i = 0; i < RAINBOW_BANDS.length; i++) {
    ctx.beginPath();
    ctx.strokeStyle = RAINBOW_BANDS[i];
    ctx.lineWidth = thickness * 0.9;
    ctx.arc(cx, cy, outerR - i * thickness, Math.PI, Math.PI + sweep);
    ctx.stroke();
  }
  ctx.restore();
}

/** Draw the whole world. Camera transform is applied by the caller. */
export function drawMap(ctx, map, time, orbState, activeChairs) {
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
  for (const pr of map.portals || []) drawPortal(ctx, pr, time);
  const candies = map.candies || [];
  for (let i = 0; i < candies.length; i++) drawCandy(ctx, candies[i], time, i);
  const orbs = map.orbs || [];
  for (let i = 0; i < orbs.length; i++) drawOrb(ctx, orbs[i], time, i, orbState?.[i] || 0);
  const chairs = map.chairs || [];
  const activeSet = new Set(activeChairs || []);
  for (let i = 0; i < chairs.length; i++) drawChair(ctx, chairs[i], activeSet.has(i), theme, time, i);
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
  for (const pr of map.portals || []) {
    ctx.fillStyle = pr.hue;
    ctx.fillRect(pr.a[0], pr.a[1], PORTAL_W, PORTAL_H);
    ctx.fillRect(pr.b[0], pr.b[1], PORTAL_W, PORTAL_H);
  }
  const candies = map.candies || [];
  for (let i = 0; i < candies.length; i++) {
    ctx.fillStyle = CANDY_COLORS[i % CANDY_COLORS.length];
    const c = candies[i];
    ctx.beginPath();
    ctx.arc(c[0] + c[2] / 2, c[1] + c[3] / 2, c[2] * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  const orbs = map.orbs || [];
  for (let i = 0; i < orbs.length; i++) {
    ctx.fillStyle = ORB_COLORS[i % ORB_COLORS.length];
    const o = orbs[i];
    ctx.beginPath();
    ctx.arc(o[0] + o[2] / 2, o[1] + o[3] / 2, o[2] * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = theme.accent;
  for (const c of map.chairs || []) ctx.fillRect(c[0], c[1], c[2], c[3]);

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
