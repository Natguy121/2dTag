// Local profile, settings and unlock progress. All of it lives in
// localStorage, which can throw or be unavailable, so every access is guarded.

const KEY = 'twodtag.profile.v1';

export const DEFAULT_KEYS = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  jump: 'Space',
  down: 'ArrowDown',
  shoot: 'KeyF',
};

const DEFAULTS = {
  name: '',
  namePassword: '', // optional; claims your name so nobody else can play as you
  skin: 'runner',
  trail: 'none',
  volume: 0.7,
  musicVolume: 0.35,
  musicTrack: 'chiptune-rush',
  showNames: true,
  particles: true,
  shake: true,
  showFps: false,
  keys: { ...DEFAULT_KEYS },
  stats: {
    tags: 0, games: 0, wins: 0, moonRounds: 0, timesTagged: 0, shotHits: 0, coinsEarned: 0,
  },
  coins: 0,
  ownedSkins: [],
  ownedTrails: [],
  claimedQuests: [],
  mapsPlayed: [],
  theme: 'classic', // 'classic' (blue & orange), 'blossom' (pink & purple), 'pink' or 'blue'
  onboarded: false, // has seen the one-time "pick your colors" welcome screen
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
  ownedTrails: Array.isArray(stored.ownedTrails) ? stored.ownedTrails : [],
  claimedQuests: Array.isArray(stored.claimedQuests) ? stored.claimedQuests : [],
  mapsPlayed: Array.isArray(stored.mapsPlayed) ? stored.mapsPlayed : [],
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

/** Spend coins on a coin-shop trail. Returns false if you can't afford it. */
export function buyTrail(trailId, price) {
  if (profile.ownedTrails.includes(trailId)) return true;
  if ((profile.coins || 0) < price) return false;
  profile.coins -= price;
  profile.ownedTrails = [...profile.ownedTrails, trailId];
  save();
  return true;
}

/** Mark a completed quest claimed and hand out its coins. Returns false if
 * it was already claimed (so the caller doesn't pay out twice). */
export function claimQuest(id, reward) {
  if (profile.claimedQuests.includes(id)) return false;
  profile.claimedQuests = [...profile.claimedQuests, id];
  addCoins(reward);
  save();
  return true;
}

/** Record a round played on a map, for the "play N different maps" quest. */
export function trackMapPlayed(mapId) {
  if (profile.mapsPlayed.includes(mapId)) return;
  profile.mapsPlayed = [...profile.mapsPlayed, mapId];
  save();
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
