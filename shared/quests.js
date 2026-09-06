// Quest generator. Rather than a fixed list of lifetime-threshold
// milestones (which a veteran player runs out of, and a fresh one can
// never "not already have" met), a quest here always targets a delta from
// wherever your stats are RIGHT NOW: claim one and storage.js immediately
// generates a fresh one to take its slot, so the pool never runs dry.
//
// stat is a key into profile.stats, except 'mapsPlayed' which reads
// profile.mapsPlayed.length instead (see currentStatValue() in storage.js).

export const QUEST_TEMPLATES = [
  { stat: 'games', name: 'Round Runner', verb: 'Finish', unit: 'round', scale: 1 },
  { stat: 'wins', name: 'Winning Streak', verb: 'Win', unit: 'round', scale: 0.5 },
  { stat: 'tags', name: 'Tag Hunter', verb: 'Tag', unit: 'player', scale: 1 },
  { stat: 'timesTagged', name: 'Runaway', verb: 'Get tagged', unit: 'time', scale: 0.8 },
  {
    stat: 'shotHits', name: 'Sharpshooter', verb: 'Land', unit: 'shot', scale: 0.6, suffix: ' on Crossfire Yard',
  },
  {
    stat: 'moonRounds', name: 'Moon Walker', verb: 'Play', unit: 'round', scale: 0.3, suffix: ' on Moon Base',
  },
  { stat: 'coinsEarned', name: 'High Roller', verb: 'Earn', unit: 'coin', scale: 8 },
  { stat: 'mapsPlayed', name: 'Explorer', verb: 'Play on', unit: 'map', scale: 0.4 },
];

// Harder difficulties ask for more (via `base`, scaled per-template above)
// and pay out more -- both more coins and a rarer lucky block. Common is
// deliberately never a reward here: every free-from-the-start skin is
// already owned by everyone, so a Common block would never have anything
// left to give -- see shared/skins.js's getRarity().
export const DIFFICULTIES = {
  easy: {
    label: 'Easy', color: '#61c46b', base: [2, 4], coins: [20, 35], blockTier: 'uncommon',
  },
  medium: {
    label: 'Medium', color: '#4cc9f0', base: [5, 10], coins: [45, 75], blockTier: 'rare',
  },
  hard: {
    label: 'Hard', color: '#a06bff', base: [12, 22], coins: [90, 140], blockTier: 'epic',
  },
  extreme: {
    label: 'Extreme', color: '#ff6b35', base: [25, 45], coins: [160, 250], blockTier: 'legendary',
  },
};

const DIFFICULTY_KEYS = Object.keys(DIFFICULTIES);

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function questLabel(template, amount) {
  const plural = amount === 1 ? '' : 's';
  return `${template.verb} ${amount} more ${template.unit}${plural}${template.suffix || ''}`;
}

function buildQuest(template, templateIndex, difficulty, amount, baseline) {
  const d = DIFFICULTIES[difficulty];
  return {
    id: `q-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    templateIndex,
    stat: template.stat,
    name: template.name,
    label: questLabel(template, amount),
    baseline,
    goal: amount,
    difficulty,
    reward: { coins: randInt(d.coins[0], d.coins[1]), blockTier: d.blockTier },
  };
}

/**
 * @param getCurrentValue  (stat) => number, the player's live progress for
 *                         a stat right now (see currentStatValue() in
 *                         storage.js)
 * @param usedTemplateIndexes  template indexes already active in other
 *                         live quests, so two slots never ask for the same
 *                         stat at once
 * @param mapCount         total maps that exist, so an Explorer quest never
 *                         asks for more new maps than are left to play
 */
export function generateQuest(getCurrentValue, usedTemplateIndexes = [], mapCount = 18) {
  let pool = QUEST_TEMPLATES.map((_, i) => i).filter((i) => !usedTemplateIndexes.includes(i));
  if (!pool.length) pool = QUEST_TEMPLATES.map((_, i) => i);

  for (let attempt = 0; attempt < 8; attempt++) {
    const templateIndex = pool[Math.floor(Math.random() * pool.length)];
    const template = QUEST_TEMPLATES[templateIndex];
    const difficulty = DIFFICULTY_KEYS[Math.floor(Math.random() * DIFFICULTY_KEYS.length)];
    const base = DIFFICULTIES[difficulty].base;
    let amount = Math.max(1, Math.round(randInt(base[0], base[1]) * template.scale));
    const baseline = getCurrentValue(template.stat);

    if (template.stat === 'mapsPlayed') {
      const headroom = Math.max(0, mapCount - baseline);
      if (headroom <= 0) continue; // every map already played -- try something else
      amount = Math.min(amount, headroom);
    }

    return buildQuest(template, templateIndex, difficulty, amount, baseline);
  }
  // Unreachable in practice (only 'mapsPlayed' can ever fail the loop, and
  // seven other templates are always available), but never leave a slot
  // ungenerated.
  return buildQuest(QUEST_TEMPLATES[0], 0, 'easy', 2, getCurrentValue('games'));
}
