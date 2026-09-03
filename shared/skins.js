// Skin catalogue. The server only ever stores/echoes a skin id; all of the
// drawing happens on the client from this table.

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
    unlock: { stat: 'tags', value: 25, label: 'Tag 25 players' } },
  { id: 'bot',     name: 'Unit-07',    body: '#c0c8d4', dark: '#7d8798', trim: '#39f0d8', eye: '#39f0d8', pattern: 'robot',
    unlock: { stat: 'games', value: 10, label: 'Finish 10 rounds' } },
  { id: 'astro',   name: 'Astronaut',  body: '#f4f6fb', dark: '#b3bccd', trim: '#4cc9f0', eye: '#0b1626', pattern: 'visor',
    unlock: { stat: 'moonRounds', value: 3, label: 'Play 3 rounds on Moon Base' } },
  { id: 'phantom', name: 'Phantom',    body: '#7b2cbf', dark: '#3c096c', trim: '#ffd60a', eye: '#ffd60a', pattern: 'ghost',
    unlock: { stat: 'wins', value: 5, label: 'Win 5 rounds' } },
];

export const SKIN_BY_ID = Object.fromEntries(SKINS.map((s) => [s.id, s]));
export const DEFAULT_SKIN = 'runner';

export function getSkin(id) {
  return SKIN_BY_ID[id] || SKIN_BY_ID[DEFAULT_SKIN];
}

export function isUnlocked(skin, stats) {
  if (!skin.unlock) return true;
  return (stats?.[skin.unlock.stat] || 0) >= skin.unlock.value;
}

// Bots pick from the always-available skins so they never look like a locked one.
export const BOT_SKINS = SKINS.filter((s) => !s.unlock).map((s) => s.id);

export const BOT_NAMES = [
  'Pip', 'Dash', 'Nox', 'Wren', 'Bolt', 'Juno', 'Fizz', 'Kip',
  'Mox', 'Rue', 'Sable', 'Tilt', 'Vex', 'Zed', 'Ash', 'Clio',
];
