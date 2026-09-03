// Local profile, settings and unlock progress. All of it lives in
// localStorage, which can throw or be unavailable, so every access is guarded.

const KEY = 'twodtag.profile.v1';

export const DEFAULT_KEYS = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  jump: 'Space',
  down: 'ArrowDown',
};

const DEFAULTS = {
  name: '',
  namePassword: '', // optional; claims your name so nobody else can play as you
  skin: 'runner',
  volume: 0.7,
  showNames: true,
  particles: true,
  shake: true,
  showFps: false,
  keys: { ...DEFAULT_KEYS },
  stats: { tags: 0, games: 0, wins: 0, moonRounds: 0, timesTagged: 0 },
  coins: 0,
  ownedSkins: [],
};

function randomName() {
  const words = ['Swift', 'Bouncy', 'Sneaky', 'Turbo', 'Wild', 'Lucky', 'Rapid', 'Sly'];
  const n = words[Math.floor(Math.random() * words.length)];
  return `${n}${Math.floor(Math.random() * 90 + 10)}`;
}

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const stored = read() || {};

export const profile = {
  ...DEFAULTS,
  ...stored,
  keys: { ...DEFAULT_KEYS, ...(stored.keys || {}) },
  stats: { ...DEFAULTS.stats, ...(stored.stats || {}) },
  ownedSkins: Array.isArray(stored.ownedSkins) ? stored.ownedSkins : [],
};

if (!profile.name) profile.name = randomName();

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    /* private browsing or a full quota: settings just will not persist */
  }
}

export function bumpStat(key, by = 1) {
  profile.stats[key] = (profile.stats[key] || 0) + by;
  save();
}

export function resetStats() {
  profile.stats = { ...DEFAULTS.stats };
  save();
}

export function addCoins(amount) {
  profile.coins = Math.max(0, (profile.coins || 0) + amount);
  save();
}

/** Spend coins on a coin-shop skin. Returns false if you can't afford it. */
export function buySkin(skinId, price) {
  if (profile.ownedSkins.includes(skinId)) return true;
  if ((profile.coins || 0) < price) return false;
  profile.coins -= price;
  profile.ownedSkins = [...profile.ownedSkins, skinId];
  save();
  return true;
}

export function resetKeys() {
  profile.keys = { ...DEFAULT_KEYS };
  save();
}

/** Human readable label for a KeyboardEvent.code. */
export function keyLabel(code) {
  if (!code) return '--';
  return code
    .replace(/^Key/, '')
    .replace(/^Digit/, '')
    .replace(/^Arrow/, '')
    .replace(/^Numpad/, 'Num')
    .replace('Space', 'SPACE')
    .replace('ControlLeft', 'L-CTRL')
    .replace('ControlRight', 'R-CTRL')
    .replace('ShiftLeft', 'L-SHIFT')
    .replace('ShiftRight', 'R-SHIFT')
    .toUpperCase();
}
