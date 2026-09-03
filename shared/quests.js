// Quest catalogue. Each quest tracks one lifetime play stat against a goal
// and pays out a one-time coin bounty once claimed. Unlike skin/trail
// unlocks (which apply automatically the moment a stat clears its bar),
// a quest has to be claimed explicitly so completing one is its own small
// moment instead of a number quietly ticking over in the background.
//
// stat is a key into profile.stats, except 'mapsPlayed' which reads
// profile.mapsPlayed.length instead (see questProgress in app.js).

export const QUESTS = [
  { id: 'first-game',   name: 'First Round',   stat: 'games',       goal: 1,   reward: 30,  label: 'Finish 1 round' },
  { id: 'first-win',    name: 'Winner',        stat: 'wins',        goal: 1,   reward: 50,  label: 'Win 1 round' },
  { id: 'ten-tags',     name: 'Tag Machine',   stat: 'tags',        goal: 10,  reward: 60,  label: 'Tag 10 players' },
  { id: 'five-games',   name: 'Regular',       stat: 'games',       goal: 5,   reward: 60,  label: 'Finish 5 rounds' },
  { id: 'explorer',     name: 'Explorer',      stat: 'mapsPlayed',  goal: 5,   reward: 90,  label: 'Play on 5 different maps' },
  { id: 'moon-walker',  name: 'Moon Walker',   stat: 'moonRounds',  goal: 3,   reward: 80,  label: 'Play 3 rounds on Moon Base' },
  { id: 'sharpshooter', name: 'Sharpshooter',  stat: 'shotHits',    goal: 10,  reward: 100, label: 'Land 10 shots on Crossfire Yard' },
  { id: 'five-wins',    name: 'Champion',      stat: 'wins',        goal: 5,   reward: 150, label: 'Win 5 rounds' },
  { id: 'twenty-games', name: 'Veteran',       stat: 'games',       goal: 20,  reward: 150, label: 'Finish 20 rounds' },
  { id: 'fifty-tags',   name: 'Menace',        stat: 'tags',        goal: 50,  reward: 200, label: 'Tag 50 players' },
  { id: 'escape-artist',name: 'Escape Artist', stat: 'timesTagged', goal: 20,  reward: 70,  label: 'Get tagged 20 times' },
  { id: 'high-roller',  name: 'High Roller',   stat: 'coinsEarned', goal: 500, reward: 100, label: 'Earn 500 coins from playing' },
];
