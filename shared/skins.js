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
  { id: 'shadow',   name: 'Shadow',     body: '#5a2ea6', dark: '#341a66', trim: '#c9b3ff', eye: '#2e1a5c', pattern: 'ghost',
    unlock: { type: 'coins', price: 260, label: 'Coin shop' } },
  { id: 'venom',    name: 'Venom',      body: '#7a1fb0', dark: '#4a1270', trim: '#a6ff2e', eye: '#a6ff2e', pattern: 'visor',
    unlock: { type: 'coins', price: 260, label: 'Coin shop' } },
  { id: 'gilded',   name: 'Gilded',     body: '#f2c14e', dark: '#a9791a', trim: '#fff6da', eye: '#2a1c04', pattern: 'stripe',
    unlock: { type: 'coins', price: 320, label: 'Coin shop' } },
  { id: 'void',     name: 'Void',       body: '#c724ff', dark: '#7a0fb0', trim: '#ffb3ff', eye: '#3a0a5c', pattern: 'ghost',
    unlock: { type: 'coins', price: 400, label: 'Coin shop' } },
  { id: 'prism',    name: 'Prism',      body: '#ffffff', dark: '#c9c9c9', trim: '#ffffff', eye: '#101018', pattern: 'rainbow',
    unlock: { type: 'coins', price: 600, label: 'Coin shop' } },

  // --- play-stat unlocks (batch 2) ------------------------------------------
  { id: 'cyan',     name: 'Cyan',       body: '#00d9ff', dark: '#0089a8', trim: '#d6faff', eye: '#031a20', pattern: 'solid',  unlock: null },
  { id: 'crimson',  name: 'Crimson',    body: '#c81d3f', dark: '#7a0f26', trim: '#ffd6de', eye: '#1a0308', pattern: 'stripe',
    unlock: { type: 'stat', stat: 'tags', value: 40, label: 'Tag 40 players' } },
  { id: 'emerald',  name: 'Emerald',    body: '#0fae66', dark: '#086b3f', trim: '#c8ffe3', eye: '#031a10', pattern: 'spots',
    unlock: { type: 'stat', stat: 'wins', value: 10, label: 'Win 10 rounds' } },
  { id: 'navy',     name: 'Navy',       body: '#1b2a6b', dark: '#0d1638', trim: '#c7d4ff', eye: '#39f0d8', pattern: 'robot',
    unlock: { type: 'stat', stat: 'games', value: 30, label: 'Finish 30 rounds' } },
  { id: 'deadeye',  name: 'Deadeye',    body: '#ff9f1c', dark: '#b8690a', trim: '#ffe4b8', eye: '#1a0d00', pattern: 'visor',
    unlock: { type: 'stat', stat: 'shotHits', value: 15, label: 'Land 15 shots on Crossfire Yard' } },
  { id: 'survivor', name: 'Survivor',   body: '#6c757d', dark: '#3d4247', trim: '#e8ecef', eye: '#101214', pattern: 'stripe',
    unlock: { type: 'stat', stat: 'timesTagged', value: 25, label: 'Get tagged 25 times' } },

  // --- coin shop (batch 2) ---------------------------------------------------
  { id: 'magenta',  name: 'Magenta',    body: '#e619b0', dark: '#93106f', trim: '#ffd6f2', eye: '#1a0314', pattern: 'spots',
    unlock: { type: 'coins', price: 180, label: 'Coin shop' } },
  { id: 'copper',   name: 'Copper',     body: '#b5652f', dark: '#7a3f18', trim: '#ffd9b3', eye: '#1a0d02', pattern: 'robot',
    unlock: { type: 'coins', price: 200, label: 'Coin shop' } },
  { id: 'sunset',   name: 'Sunset',     body: '#ff5f6d', dark: '#a83341', trim: '#ffe0c2', eye: '#1a0509', pattern: 'stripe',
    unlock: { type: 'coins', price: 260, label: 'Coin shop' } },
  { id: 'indigo',   name: 'Indigo',     body: '#4338ca', dark: '#241d75', trim: '#d4d0ff', eye: '#39f0d8', pattern: 'visor',
    unlock: { type: 'coins', price: 300, label: 'Coin shop' } },
  { id: 'chrome',   name: 'Chrome',     body: '#d9dde3', dark: '#8b939e', trim: '#ffffff', eye: '#101018', pattern: 'ghost',
    unlock: { type: 'coins', price: 380, label: 'Coin shop' } },

  // --- batch 3: much more color, deliberately nothing dark or black --------
  { id: 'citrus',     name: 'Citrus',      body: '#d4f74e', dark: '#8fa816', trim: '#f5ffd6', eye: '#3a4508', pattern: 'solid',  unlock: null },
  { id: 'turquoise',  name: 'Turquoise',   body: '#1fd8c9', dark: '#0f8a80', trim: '#d0fffa', eye: '#0a4038', pattern: 'spots',  unlock: null },
  { id: 'lavender',   name: 'Lavender',    body: '#c9a8ff', dark: '#8f6bd6', trim: '#f3ecff', eye: '#3d2a63', pattern: 'solid',  unlock: null },
  { id: 'sky',        name: 'Sky',         body: '#7ec8ff', dark: '#3d8fd6', trim: '#eaf7ff', eye: '#164060', pattern: 'visor',  unlock: null },

  { id: 'ruby',       name: 'Ruby',        body: '#ff1f54', dark: '#b30f39', trim: '#ffd6e0', eye: '#5c0e1e', pattern: 'stripe',
    unlock: { type: 'stat', stat: 'tags', value: 60, label: 'Tag 60 players' } },
  { id: 'amber',      name: 'Amber',       body: '#ffab1f', dark: '#b3730a', trim: '#ffe6b8', eye: '#5c3b08', pattern: 'stripe',
    unlock: { type: 'stat', stat: 'games', value: 40, label: 'Finish 40 rounds' } },
  { id: 'maroon',      name: 'Maroon',     body: '#c4415f', dark: '#7a2438', trim: '#ffd6de', eye: '#4a1622', pattern: 'visor',
    unlock: { type: 'stat', stat: 'wins', value: 15, label: 'Win 15 rounds' } },

  { id: 'hotpink',     name: 'Hot Pink',   body: '#ff2fb0', dark: '#b30f7a', trim: '#ffd6f0', eye: '#5c1246', pattern: 'spots',
    unlock: { type: 'coins', price: 220, label: 'Coin shop' } },
  { id: 'jade',        name: 'Jade',       body: '#2ed9a3', dark: '#178a67', trim: '#d0fff0', eye: '#0d4a37', pattern: 'robot',
    unlock: { type: 'coins', price: 240, label: 'Coin shop' } },
  { id: 'peach',       name: 'Peach',      body: '#ffb38a', dark: '#d67a4a', trim: '#ffe8d6', eye: '#5c3520', pattern: 'solid',
    unlock: { type: 'coins', price: 160, label: 'Coin shop' } },
  { id: 'olive',       name: 'Olive',      body: '#b0bf3a', dark: '#727c1c', trim: '#eaf5c2', eye: '#3a4110', pattern: 'spots',
    unlock: { type: 'coins', price: 200, label: 'Coin shop' } },
  { id: 'periwinkle',  name: 'Periwinkle', body: '#8a9cff', dark: '#4f5fd6', trim: '#e6eaff', eye: '#232e70', pattern: 'ghost',
    unlock: { type: 'coins', price: 280, label: 'Coin shop' } },

  // --- batch 4: much more skins ---------------------------------------------
  { id: 'coral',      name: 'Coral',       body: '#ff7b6b', dark: '#c94a3a', trim: '#ffe0d6', eye: '#3a0e06', pattern: 'solid',  unlock: null },
  { id: 'aqua',       name: 'Aqua',        body: '#22e0e6', dark: '#0f8a90', trim: '#d6fffd', eye: '#052a2c', pattern: 'spots',  unlock: null },
  { id: 'lilac',      name: 'Lilac',       body: '#e0b3ff', dark: '#a374d6', trim: '#f8ecff', eye: '#3d1c5c', pattern: 'solid',  unlock: null },
  { id: 'tangerine',  name: 'Tangerine',   body: '#ff9425', dark: '#c96a0a', trim: '#ffe4c2', eye: '#3a1c02', pattern: 'stripe', unlock: null },
  { id: 'seafoam',    name: 'Seafoam',     body: '#6ff2c0', dark: '#2f9d78', trim: '#e0fff2', eye: '#0a3325', pattern: 'spots',  unlock: null },
  { id: 'flamingo',   name: 'Flamingo',    body: '#ff6f9c', dark: '#c93f6b', trim: '#ffe0ea', eye: '#3a0d1c', pattern: 'visor',  unlock: null },
  { id: 'cerulean',   name: 'Cerulean',    body: '#2f9bff', dark: '#1a5fb0', trim: '#d6ecff', eye: '#0a2440', pattern: 'robot',  unlock: null },
  { id: 'chartreuse', name: 'Chartreuse',  body: '#c7ff3d', dark: '#87b016', trim: '#eeffc2', eye: '#2c3a06', pattern: 'solid',  unlock: null },

  { id: 'mulberry',   name: 'Mulberry',    body: '#c9407e', dark: '#8a2455', trim: '#ffd6ea', eye: '#3a0c1e', pattern: 'stripe',
    unlock: { type: 'stat', stat: 'tags', value: 80, label: 'Tag 80 players' } },
  { id: 'platinum',   name: 'Platinum',    body: '#e6e9f0', dark: '#a8afc2', trim: '#ffffff', eye: '#141824', pattern: 'robot',
    unlock: { type: 'stat', stat: 'games', value: 60, label: 'Finish 60 rounds' } },
  { id: 'champion',   name: 'Champion',    body: '#ffcf40', dark: '#c99a0a', trim: '#fff6d0', eye: '#3a2a04', pattern: 'stripe',
    unlock: { type: 'stat', stat: 'wins', value: 20, label: 'Win 20 rounds' } },
  { id: 'lunar',      name: 'Lunar',       body: '#c2d4ff', dark: '#8296d6', trim: '#eef2ff', eye: '#1c2650', pattern: 'visor',
    unlock: { type: 'stat', stat: 'moonRounds', value: 8, label: 'Play 8 rounds on Moon Base' } },
  { id: 'marksman',   name: 'Marksman',    body: '#ff7a1f', dark: '#b3520a', trim: '#ffdcb8', eye: '#3a1c02', pattern: 'visor',
    unlock: { type: 'stat', stat: 'shotHits', value: 30, label: 'Land 30 shots on Crossfire Yard' } },
  { id: 'tycoon',     name: 'Tycoon',      body: '#ffd700', dark: '#b8960a', trim: '#fff6c2', eye: '#3a2c02', pattern: 'robot',
    unlock: { type: 'stat', stat: 'coinsEarned', value: 1000, label: 'Earn 1000 coins total' } },

  { id: 'saffron',    name: 'Saffron',     body: '#ffb100', dark: '#b37800', trim: '#fff0c2', eye: '#3a2600', pattern: 'stripe',
    unlock: { type: 'coins', price: 160, label: 'Coin shop' } },
  { id: 'lime',       name: 'Lime',        body: '#9dff3d', dark: '#5fa30e', trim: '#e6ffc2', eye: '#1c3006', pattern: 'solid',
    unlock: { type: 'coins', price: 160, label: 'Coin shop' } },
  { id: 'orchid',     name: 'Orchid',      body: '#c85fd6', dark: '#8a2f96', trim: '#f5d6ff', eye: '#3a0a40', pattern: 'spots',
    unlock: { type: 'coins', price: 200, label: 'Coin shop' } },
  { id: 'tigerlily',  name: 'Tiger Lily',  body: '#ff4d1f', dark: '#b32e0a', trim: '#ffd0b8', eye: '#3a1204', pattern: 'stripe',
    unlock: { type: 'coins', price: 220, label: 'Coin shop' } },
  { id: 'glacier',    name: 'Glacier',     body: '#a8e6ff', dark: '#5aa8cf', trim: '#e6faff', eye: '#0d2c3a', pattern: 'visor',
    unlock: { type: 'coins', price: 220, label: 'Coin shop' } },
  { id: 'wildberry',  name: 'Wildberry',   body: '#a6296b', dark: '#6b1443', trim: '#ffd0e6', eye: '#2c0616', pattern: 'ghost',
    unlock: { type: 'coins', price: 240, label: 'Coin shop' } },
  { id: 'sapphire',   name: 'Sapphire',    body: '#1f5fd6', dark: '#123a8a', trim: '#c2d6ff', eye: '#39f0d8', pattern: 'robot',
    unlock: { type: 'coins', price: 280, label: 'Coin shop' } },
  { id: 'moonstone',  name: 'Moonstone',   body: '#d4e0ff', dark: '#96a6d6', trim: '#f5f8ff', eye: '#1c2440', pattern: 'ghost',
    unlock: { type: 'coins', price: 300, label: 'Coin shop' } },
  { id: 'neonpink',   name: 'Neon Pink',   body: '#ff17c9', dark: '#b30f96', trim: '#ffd0f5', eye: '#3a0a30', pattern: 'visor',
    unlock: { type: 'coins', price: 340, label: 'Coin shop' } },
  { id: 'aurora',     name: 'Aurora',      body: '#4ff0a8', dark: '#1f9d6b', trim: '#d0ffea', eye: '#0a3320', pattern: 'spots',
    unlock: { type: 'coins', price: 360, label: 'Coin shop' } },
  { id: 'eclipse',    name: 'Eclipse',     body: '#8a3ffd', dark: '#5420a8', trim: '#e0d0ff', eye: '#ffd60a', pattern: 'ghost',
    unlock: { type: 'coins', price: 480, label: 'Coin shop' } },

  // --- ultra-premium: a genuinely different silhouette, not just a
  // recolored blob -- see drawCharacter's 'chameleon' pattern branch in
  // public/js/render.js for the custom body/tail/eye shape. The priciest
  // item in the shop, above even Prism.
  { id: 'chameleon',  name: 'Chameleon',   body: '#4a9e3f', dark: '#2c5e26', trim: '#eaffd0', eye: '#12210a', pattern: 'chameleon',
    unlock: { type: 'coins', price: 1500, label: 'Coin shop' } },
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
