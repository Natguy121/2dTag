// Skin catalogue. The server only ever stores/echoes a skin id; all of the
// drawing happens on the client from this table. Skins are purely cosmetic --
// nothing here changes movement, speed, or hitbox, so owning more of them is
// never a gameplay advantage, just a look.
//
// unlock is either:
//   null                                       -- available from the start
//   { type: 'stat', stat, value, label }        -- unlocked by a play stat
//   { type: 'coins', price, label }             -- bought with earned coins

export const SKINS = [
  { id: 'runner',  name: 'Runner',     body: '#4cc9f0', dark: '#2a86a8', trim: '#e8faff', eye: '#08131a', pattern: 'solid',  unlock: null },
  { id: 'ember',   name: 'Ember',      body: '#ff6b35', dark: '#c2410c', trim: '#ffd6a5', eye: '#1a0b04', pattern: 'solid',  unlock: null },
  { id: 'moss',    name: 'Moss',       body: '#61c46b', dark: '#2f7a3c', trim: '#dcffdf', eye: '#0a1a0c', pattern: 'spots',  unlock: null },
  { id: 'violet',  name: 'Violet',     body: '#a06bff', dark: '#5f36b0', trim: '#efe2ff', eye: '#150a24', pattern: 'solid',  unlock: null },
  { id: 'sunny',   name: 'Sunny',      body: '#ffd166', dark: '#c99a1e', trim: '#fff6d8', eye: '#241a04', pattern: 'stripe', unlock: null },
  { id: 'blush',   name: 'Blush',      body: '#ff8fab', dark: '#c95378', trim: '#ffe3ec', eye: '#2a0a15', pattern: 'solid',  unlock: null },
  { id: 'slate',   name: 'Slate',      body: '#8d99ae', dark: '#5a6478', trim: '#edf2f7', eye: '#11151d', pattern: 'stripe', unlock: null },
  { id: 'mint',    name: 'Mint',       body: '#4ff0c1', dark: '#1f9d7d', trim: '#e2fff6', eye: '#04231b', pattern: 'spots',  unlock: null },

  { id: 'ninja',   name: 'Night Ops',  body: '#2b2d42', dark: '#16172a', trim: '#ff4d6d', eye: '#ff4d6d', pattern: 'visor',
    unlock: { type: 'stat', stat: 'tags', value: 25, label: 'Tag 25 players' } },
  { id: 'bot',     name: 'Unit-07',    body: '#c0c8d4', dark: '#7d8798', trim: '#39f0d8', eye: '#39f0d8', pattern: 'robot',
    unlock: { type: 'stat', stat: 'games', value: 10, label: 'Finish 10 rounds' } },
  { id: 'astro',   name: 'Astronaut',  body: '#f4f6fb', dark: '#b3bccd', trim: '#4cc9f0', eye: '#0b1626', pattern: 'visor',
    unlock: { type: 'stat', stat: 'moonRounds', value: 3, label: 'Play 3 rounds on Moon Base' } },
  { id: 'phantom', name: 'Phantom',    body: '#7b2cbf', dark: '#3c096c', trim: '#ffd60a', eye: '#ffd60a', pattern: 'ghost',
    unlock: { type: 'stat', stat: 'wins', value: 5, label: 'Win 5 rounds' } },

  // --- coin shop -----------------------------------------------------------
  { id: 'cherry',   name: 'Cherry',     body: '#e8385f', dark: '#9c1f3d', trim: '#ffd6e0', eye: '#1a0308', pattern: 'spots',
    unlock: { type: 'coins', price: 120, label: 'Coin shop' } },
  { id: 'cobalt',   name: 'Cobalt',     body: '#2a5adf', dark: '#173a99', trim: '#bcd2ff', eye: '#39f0d8', pattern: 'robot',
    unlock: { type: 'coins', price: 150, label: 'Coin shop' } },
  { id: 'toxic',    name: 'Toxic',      body: '#a6ff2e', dark: '#5e9a10', trim: '#e8ffc2', eye: '#0d1a02', pattern: 'spots',
    unlock: { type: 'coins', price: 180, label: 'Coin shop' } },
  { id: 'inferno',  name: 'Inferno',    body: '#ff5a1f', dark: '#a52c05', trim: '#ffd28a', eye: '#1a0500', pattern: 'stripe',
    unlock: { type: 'coins', price: 180, label: 'Coin shop' } },
  { id: 'rosegold', name: 'Rose Gold',  body: '#e8b4bc', dark: '#b3717d', trim: '#fff3ee', eye: '#3a1418', pattern: 'solid',
    unlock: { type: 'coins', price: 200, label: 'Coin shop' } },
  { id: 'arctic',   name: 'Arctic',     body: '#eafcff', dark: '#a9d8e0', trim: '#4cc9f0', eye: '#0b2630', pattern: 'visor',
    unlock: { type: 'coins', price: 220, label: 'Coin shop' } },
  { id: 'shadow',   name: 'Shadow',     body: '#241b2f', dark: '#120c19', trim: '#7b2cbf', eye: '#a06bff', pattern: 'ghost',
    unlock: { type: 'coins', price: 260, label: 'Coin shop' } },
  { id: 'venom',    name: 'Venom',      body: '#3a1a4a', dark: '#1e0d27', trim: '#a6ff2e', eye: '#a6ff2e', pattern: 'visor',
    unlock: { type: 'coins', price: 260, label: 'Coin shop' } },
  { id: 'gilded',   name: 'Gilded',     body: '#f2c14e', dark: '#a9791a', trim: '#fff6da', eye: '#2a1c04', pattern: 'stripe',
    unlock: { type: 'coins', price: 320, label: 'Coin shop' } },
  { id: 'void',     name: 'Void',       body: '#0c0812', dark: '#000000', trim: '#7b2cbf', eye: '#a06bff', pattern: 'ghost',
    unlock: { type: 'coins', price: 400, label: 'Coin shop' } },
  { id: 'prism',    name: 'Prism',      body: '#ffffff', dark: '#c9c9c9', trim: '#ffffff', eye: '#101018', pattern: 'rainbow',
    unlock: { type: 'coins', price: 600, label: 'Coin shop' } },
];

export const SKIN_BY_ID = Object.fromEntries(SKINS.map((s) => [s.id, s]));
export const DEFAULT_SKIN = 'runner';

export function getSkin(id) {
  return SKIN_BY_ID[id] || SKIN_BY_ID[DEFAULT_SKIN];
}

/**
 * @param skin      an entry from SKINS
 * @param stats     profile.stats (for stat-gated skins)
 * @param owned     profile.ownedSkins, an array/Set of purchased coin-shop skin ids
 */
export function isUnlocked(skin, stats, owned) {
  if (!skin.unlock) return true;
  if (skin.unlock.type === 'coins') {
    return owned instanceof Set ? owned.has(skin.id) : !!owned?.includes?.(skin.id);
  }
  return (stats?.[skin.unlock.stat] || 0) >= skin.unlock.value;
}

// Bots pick from the always-available skins so they never look like a locked one.
export const BOT_SKINS = SKINS.filter((s) => !s.unlock).map((s) => s.id);

export const BOT_NAMES = [
  'Pip', 'Dash', 'Nox', 'Wren', 'Bolt', 'Juno', 'Fizz', 'Kip',
  'Mox', 'Rue', 'Sable', 'Tilt', 'Vex', 'Zed', 'Ash', 'Clio',
];
