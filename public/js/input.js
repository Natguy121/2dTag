// Keyboard + touch input, collapsed into the same 4-button bitmask the
// simulation understands.

import { profile } from './storage.js';
import { encodeInput } from '/shared/physics.js';

const held = new Set();
const touch = { left: false, right: false, jump: false, down: false };
let capturing = false;

// Extra keys that always work regardless of the configured bindings, so the
// usual WASD player never has to open the settings screen first.
const ALIASES = {
  left: ['KeyA'],
  right: ['KeyD'],
  jump: ['KeyW', 'ArrowUp'],
  down: ['KeyS'],
};

function isDown(action) {
  if (touch[action]) return true;
  const bound = profile.keys[action];
  if (bound && held.has(bound)) return true;
  return ALIASES[action].some((code) => held.has(code));
}

export function currentBits() {
  if (capturing) return 0;
  return encodeInput({
    left: isDown('left'),
    right: isDown('right'),
    jump: isDown('jump'),
    down: isDown('down'),
  });
}

/** While a key is being rebound, swallow gameplay input. */
export function setCapturing(on) {
  capturing = on;
  if (on) held.clear();
}

export function clear() {
  held.clear();
  touch.left = touch.right = touch.jump = touch.down = false;
}

export function init({ onEscape } = {}) {
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
      onEscape?.();
      return;
    }
    if (capturing) return;
    held.add(e.code);
    // Stop the page from scrolling while playing.
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      if (e.target === document.body) e.preventDefault();
    }
  });

  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', clear);

  // On-screen buttons for touch devices.
  for (const btn of document.querySelectorAll('[data-touch-key]')) {
    const action = btn.dataset.touchKey;
    const set = (on) => (e) => {
      e.preventDefault();
      touch[action] = on;
      btn.classList.toggle('is-down', on);
      // A light tick on press only, not release -- Android supports this,
      // iOS Safari silently ignores it (no Vibration API), which is fine.
      if (on) navigator.vibrate?.(10);
    };
    btn.addEventListener('pointerdown', set(true));
    btn.addEventListener('pointerup', set(false));
    btn.addEventListener('pointercancel', set(false));
    btn.addEventListener('pointerleave', set(false));
  }
}

export function isTouchDevice() {
  return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
}
