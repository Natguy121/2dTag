// Trail catalogue. A trail is a purely cosmetic particle trickle that follows
// a moving player -- like skins, it never changes movement, speed or hitbox,
// so owning a flashier one is never a gameplay advantage.
//
// unlock is either:
//   null                                       -- available from the start
//   { type: 'stat', stat, value, label }        -- unlocked by a play stat
//   { type: 'coins', price, label }             -- bought with earned coins

export const TRAILS = [
  { id: 'none',    name: 'None',       colors: [], unlock: null },
  { id: 'spark',   name: 'Spark',      colors: ['#ffd166'], unlock: null },
  { id: 'frost',   name: 'Frost',      colors: ['#4cc9f0', '#eafcff'], unlock: null },
  { id: 'ember',   name: 'Ember',      colors: ['#ff6b35', '#ffb38a'], unlock: null },

  { id: 'toxic',   name: 'Toxic',      colors: ['#a6ff2e'],
    unlock: { type: 'stat', stat: 'tags', value: 15, label: 'Tag 15 players' } },
  { id: 'comet',   name: 'Comet',      colors: ['#39f0d8', '#4cc9f0'],
    unlock: { type: 'stat', stat: 'wins', value: 3, label: 'Win 3 rounds' } },
  { id: 'bolt',    name: 'Bolt',       colors: ['#ffe066', '#fff6d8'],
    unlock: { type: 'stat', stat: 'shotHits', value: 5, label: 'Land 5 shots on Crossfire Yard' } },

  { id: 'blaze',   name: 'Blaze',      colors: ['#ff4d6d', '#ffd166'],
    unlock: { type: 'coins', price: 120, label: 'Coin shop' } },
  { id: 'royal',   name: 'Royal',      colors: ['#a06bff', '#efe2ff'],
    unlock: { type: 'coins', price: 150, label: 'Coin shop' } },
  { id: 'gold',    name: 'Gold Dust',  colors: ['#f2c14e', '#fff6da'],
    unlock: { type: 'coins', price: 220, label: 'Coin shop' } },
  { id: 'shadow',  name: 'Shadow',     colors: ['#7b2cbf', '#c9b3ff'],
    unlock: { type: 'coins', price: 260, label: 'Coin shop' } },
  { id: 'rainbow', name: 'Prism Dust', colors: ['#ff4d6d', '#ffd166', '#4ff0c1', '#4cc9f0', '#a06bff'],
    unlock: { type: 'coins', price: 400, label: 'Coin shop' } },

  // --- much more color, deliberately nothing dark or black -----------------
  { id: 'turquoise',  name: 'Turquoise Wake',   colors: ['#1fd8c9', '#d0fffa'], unlock: null },
  { id: 'ruby',       name: 'Ruby Sparks',      colors: ['#ff1f54'],
    unlock: { type: 'stat', stat: 'tags', value: 25, label: 'Tag 25 players' } },
  { id: 'amber',      name: 'Amber Trail',      colors: ['#ffab1f', '#ffe6b8'],
    unlock: { type: 'coins', price: 140, label: 'Coin shop' } },
  { id: 'periwinkle', name: 'Periwinkle Drift', colors: ['#8a9cff', '#c9a8ff'],
    unlock: { type: 'coins', price: 180, label: 'Coin shop' } },
  { id: 'sunburst',   name: 'Sunburst',         colors: ['#ff2fb0', '#ffab1f', '#1fd8c9'],
    unlock: { type: 'coins', price: 320, label: 'Coin shop' } },

  // --- batch 2: much more trails --------------------------------------------
  { id: 'seafoam',    name: 'Seafoam Trail',    colors: ['#6ff2c0', '#e0fff2'], unlock: null },
  { id: 'coral',      name: 'Coral Trail',      colors: ['#ff7b6b', '#ffe0d6'], unlock: null },
  { id: 'cerulean',   name: 'Cerulean Trail',   colors: ['#2f9bff', '#d6ecff'], unlock: null },

  { id: 'inferno',    name: 'Inferno',          colors: ['#ff2d1f', '#ff8a3d'],
    unlock: { type: 'stat', stat: 'tags', value: 35, label: 'Tag 35 players' } },
  { id: 'champion',   name: 'Champion Trail',   colors: ['#ffd700', '#fff6c2'],
    unlock: { type: 'stat', stat: 'wins', value: 8, label: 'Win 8 rounds' } },
  { id: 'frostbite',  name: 'Frostbite',        colors: ['#8ab4ff', '#e6f0ff'],
    unlock: { type: 'stat', stat: 'games', value: 50, label: 'Finish 50 rounds' } },

  { id: 'wildfire',   name: 'Wildfire',         colors: ['#ff4d1f', '#ffd166', '#ff8a3d'],
    unlock: { type: 'coins', price: 180, label: 'Coin shop' } },
  { id: 'orchid',     name: 'Orchid Trail',     colors: ['#c85fd6', '#f5d6ff'],
    unlock: { type: 'coins', price: 160, label: 'Coin shop' } },
  { id: 'aurora',     name: 'Aurora Trail',     colors: ['#4ff0a8', '#39f0d8', '#d0ffea'],
    unlock: { type: 'coins', price: 260, label: 'Coin shop' } },
  { id: 'galaxy',     name: 'Galaxy',           colors: ['#8a3ffd', '#ff17c9', '#4ff0a8'],
    unlock: { type: 'coins', price: 380, label: 'Coin shop' } },
];

export const TRAIL_BY_ID = Object.fromEntries(TRAILS.map((t) => [t.id, t]));
export const DEFAULT_TRAIL = 'none';

export function getTrail(id) {
  return TRAIL_BY_ID[id] || TRAIL_BY_ID[DEFAULT_TRAIL];
}

/**
 * @param trail     an entry from TRAILS
 * @param stats     profile.stats (for stat-gated trails)
 * @param owned     profile.ownedTrails, an array/Set of purchased trail ids
 */
export function isTrailUnlocked(trail, stats, owned) {
  if (!trail.unlock) return true;
  if (trail.unlock.type === 'coins') {
    return owned instanceof Set ? owned.has(trail.id) : !!owned?.includes?.(trail.id);
  }
  return (stats?.[trail.unlock.stat] || 0) >= trail.unlock.value;
}

// Bots pick from the always-available trails so they never look like a locked one.
export const BOT_TRAILS = TRAILS.filter((t) => !t.unlock).map((t) => t.id);
