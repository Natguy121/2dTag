// Local profile, settings and unlock progress. All of it lives in
// localStorage, which can throw or be unavailable, so every access is guarded.

import { generateQuest } from '/shared/quests.js';
import { MAPS } from '/shared/maps.js';

const KEY = 'twodtag.profile.v1';
const ACTIVE_QUEST_COUNT = 8;

export const DEFAULT_KEYS = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  jump: 'Space',
  down: 'ArrowDown',
  shoot: 'KeyF',
  swing: 'KeyE',
  build: 'KeyQ',
  push: 'KeyQ',
  transform: 'KeyQ',
  shrink: 'KeyQ',
  box: 'KeyQ',
  throwItem: 'KeyR',
  slam: 'KeyQ',
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
  quests: [], // filled up to ACTIVE_QUEST_COUNT below, right after load
  luckyBlocks: {
    uncommon: 0, rare: 0, epic: 0, legendary: 0,
  },
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
  quests: Array.isArray(stored.quests) ? stored.quests : [],
  luckyBlocks: { ...DEFAULTS.luckyBlocks, ...(stored.luckyBlocks || {}) },
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

/** A quest's own live progress -- see shared/quests.js's generateQuest(). */
export function currentStatValue(stat) {
  if (stat === 'mapsPlayed') return (profile.mapsPlayed || []).length;
  return profile.stats[stat] || 0;
}

/** Top a rotating quest list back up to ACTIVE_QUEST_COUNT, never asking
 * two live quests for the same stat at once. */
function fillQuests() {
  while (profile.quests.length < ACTIVE_QUEST_COUNT) {
    const used = profile.quests.map((q) => q.templateIndex);
    profile.quests.push(generateQuest(currentStatValue, used, MAPS.length));
  }
}

if (profile.quests.length < ACTIVE_QUEST_COUNT) {
  fillQuests();
  save();
}

export function bumpStat(key, by = 1) {
  profile.stats[key] = (profile.stats[key] || 0) + by;
  save();
}

export function resetStats() {
  profile.stats = { ...DEFAULTS.stats };
  // Every live quest's baseline was captured against the stats just wiped,
  // so it no longer means what it says -- start a completely fresh set
  // rather than leave one asking for an already-impossible delta.
  profile.quests = [];
  fillQuests();
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

/** Claim a completed quest: pay out its coins and lucky block, drop it from
 * the active list, and immediately generate a fresh one to fill the slot --
 * see shared/quests.js's generateQuest(). Returns the reward paid out, or
 * null if that quest isn't active or isn't actually done yet (so the caller
 * never pays out twice, or early). */
export function claimQuest(id) {
  const quest = profile.quests.find((q) => q.id === id);
  if (!quest) return null;
  if (currentStatValue(quest.stat) - quest.baseline < quest.goal) return null;

  profile.quests = profile.quests.filter((q) => q.id !== id);
  fillQuests();
  profile.coins = Math.max(0, (profile.coins || 0) + quest.reward.coins);
  profile.luckyBlocks[quest.reward.blockTier] = (profile.luckyBlocks[quest.reward.blockTier] || 0) + 1;
  save();
  return quest.reward;
}

/** Spend one lucky block of a tier. Returns false if you don't have one. */
export function spendLuckyBlock(tier) {
  if ((profile.luckyBlocks[tier] || 0) <= 0) return false;
  profile.luckyBlocks[tier] -= 1;
  save();
  return true;
}

/** Hand over a skin outright -- a lucky block payout, or the completionist
 * surprise -- the same effect buySkin() has after paying, just free.
 * Returns false if it's already owned (so the caller doesn't re-grant/
 * re-celebrate one you already have). */
export function grantSkin(skinId) {
  if (profile.ownedSkins.includes(skinId)) return false;
  profile.ownedSkins = [...profile.ownedSkins, skinId];
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
