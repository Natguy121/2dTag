// Map definitions. Geometry is plain data so the server, the client renderer
// and the bot navigation all read from exactly the same source.
//
//   solids    [x, y, w, h]  full collision, blocks from every direction
//   platforms [x, y, w]     one-way, 14px thick, drop through by holding down
//   hazards   [x, y, w, h]  touching respawns you at a free spawn point
//   springs   [x, y, w]     14px thick launch pad
//   portals   { a: [x, y], b: [x, y], hue }  fixed-size doorway pair; walking
//             into one instantly exits out the other, keeping your velocity
//   candies   [x, y, w, h]  touching one freezes you in place for a few
//             seconds -- anyone, tagger or not (see CANDY_*_TIME in
//             constants.js). Purely a map decoration otherwise; the freeze
//             logic lives in server/room.js.
//   orbs      [x, y, w, h]  glowing pickup; touching one grants a random
//             mini superpower for ORB_POWER_TIME seconds -- see the full
//             ORB_POWERS list and what each one does in constants.js --
//             then that orb goes dark for ORB_RESPAWN_TIME seconds before
//             it can be grabbed again. Purely a map decoration otherwise;
//             the power/cooldown logic lives in server/room.js.
//   chairs    [x, y, w, h]  a musical-chairs seat (maps with
//             map.musicalChairs: true only). Purely a map decoration; the
//             active/inactive rotation and elimination logic lives in
//             server/room.js (see CHAIRS_* in constants.js).
//   spawns    [centerX, feetY]  8 per map, one per player slot
//
// gravityScale / frictionScale / airScale / speedScale let a map bend the
// shared physics without touching the simulation itself (speedScale multiplies
// C.MOVE_SPEED directly -- geometry on a high-speedScale map needs thick
// interior solids, since a fast enough body can cross a thin one within a
// single physics tick without ever registering an overlap). A NEGATIVE
// gravityScale flips the world instead of just scaling it: "down" (the
// direction gravity pulls and jumping pushes away from) becomes up, so a
// solid meant to be stood on belongs near the top of the map instead of the
// bottom -- see shared/physics.js's stepBody for how every direction check
// (landing, one-way platforms, world edges) mirrors accordingly. A handful
// of other boolean/number flags bend the RULES instead, each read only by
// server/room.js:
//   guns              true  -- only the tagger can fire (see shared/physics
//                     resolveShot); a hit tags exactly like a touch would
//   invisibilityCycle true  -- the tagger flickers visible/invisible on a
//                     repeating cycle (see INVISIBLE_*_TIME in constants.js)
//   seekerFreeze      N     -- the tagger can't move for N seconds after the
//                     round begins, giving everyone else a head start
//   detectionRange    N     -- bots can't perceive a player farther than
//                     this for chase/flee purposes; omitted = unlimited
//   coinBonus         N     -- multiplies everyone's end-of-round coin
//                     payout on this map; omitted = 1 (no change)
//   musicalChairs     true  -- replaces tagging entirely: see map.chairs
//                     above and CHAIRS_* in constants.js. No one is ever
//                     "it" on this map.
//   frankenstein      true  -- whoever is currently "it" renders as a
//                     Frankenstein monster (green skin, neck bolts, a
//                     stitched scar) instead of their own skin, reverting
//                     the moment they tag someone else -- purely cosmetic,
//                     no rule changes. See drawCharacter's `frankenstein`
//                     option in public/js/render.js.

export const PLATFORM_H = 14;
export const SPRING_H = 14;
export const PORTAL_W = 46;
export const PORTAL_H = 74;

export const MAPS = [
  {
    id: 'arena',
    name: 'Neon Arena',
    blurb: 'Symmetric duel pit. Nowhere to hide, everywhere to run.',
    width: 1600,
    height: 900,
    gravityScale: 1,
    frictionScale: 1,
    theme: {
      sky: ['#1b1038', '#2d1b57', '#0d0820'],
      solid: '#3b2a6b',
      solidEdge: '#7d5cf0',
      platform: '#8b6df5',
      accent: '#39f0d8',
      hazard: '#ff4d6d',
      fog: 'rgba(126,92,240,0.14)',
      grid: 'rgba(140,110,255,0.10)',
      decor: 'neon',
    },
    solids: [
      [0, 860, 1600, 40],
      [0, 0, 24, 900],
      [1576, 0, 24, 900],
      [430, 740, 40, 120],
      [1130, 740, 40, 120],
      [720, 690, 160, 40],
    ],
    platforms: [
      [170, 726, 230],
      [1200, 726, 230],
      [545, 586, 200],
      [855, 586, 200],
      [290, 470, 240],
      [1070, 470, 240],
      [660, 352, 280],
      [110, 316, 190],
      [1300, 316, 190],
      [400, 210, 200],
      [1000, 210, 200],
    ],
    hazards: [],
    springs: [[770, 846, 60]],
    spawns: [
      [150, 860], [400, 860], [640, 860], [980, 860],
      [1230, 860], [1450, 860], [700, 352], [900, 352],
    ],
  },

  {
    id: 'towers',
    name: 'Sky Towers',
    blurb: 'Three towers over an open drop. Mind the gaps.',
    width: 1600,
    height: 900,
    gravityScale: 1,
    frictionScale: 1,
    theme: {
      sky: ['#0d2a4a', '#1b4f7a', '#071726'],
      solid: '#20415e',
      solidEdge: '#5fd0ff',
      platform: '#4aa6d8',
      accent: '#ffd166',
      hazard: '#ff4d6d',
      fog: 'rgba(90,190,255,0.12)',
      grid: 'rgba(120,200,255,0.08)',
      decor: 'clouds',
    },
    solids: [
      [0, 0, 24, 900],
      [1576, 0, 24, 900],
      [24, 860, 450, 40],
      [574, 860, 452, 40],
      [1126, 860, 450, 40],
      [180, 636, 110, 224],
      [745, 556, 110, 304],
      [1310, 636, 110, 224],
    ],
    platforms: [
      [60, 716, 200],
      [420, 730, 190],
      [1000, 730, 190],
      [1330, 716, 200],
      [300, 552, 190],
      [1110, 552, 190],
      [630, 424, 340],
      [150, 420, 210],
      [1240, 420, 210],
      [430, 286, 220],
      [950, 286, 220],
      [690, 172, 220],
    ],
    hazards: [],
    springs: [[64, 846, 70], [1462, 846, 70], [770, 542, 60]],
    spawns: [
      [90, 860], [300, 860], [420, 860], [700, 860],
      [900, 860], [1240, 860], [1450, 860], [800, 424],
    ],
  },

  {
    id: 'frost',
    name: 'Frost Cavern',
    blurb: 'Slick ice. Committing to a direction is a decision.',
    width: 1600,
    height: 900,
    gravityScale: 1,
    frictionScale: 0.34,
    airScale: 0.85,
    theme: {
      sky: ['#0a2230', '#16506b', '#04121c'],
      solid: '#1d4a5e',
      solidEdge: '#a8f0ff',
      platform: '#7fd8ee',
      accent: '#e6fbff',
      hazard: '#4dd2ff',
      fog: 'rgba(180,240,255,0.14)',
      grid: 'rgba(170,230,255,0.08)',
      decor: 'snow',
    },
    solids: [
      [0, 860, 1600, 40],
      [0, 0, 24, 900],
      [1576, 0, 24, 900],
      [0, 0, 1600, 24],
      [300, 780, 180, 80],
      [1120, 780, 180, 80],
      [740, 740, 120, 120],
    ],
    platforms: [
      [90, 740, 190],
      [1320, 740, 190],
      [520, 640, 220],
      [860, 640, 220],
      [230, 552, 260],
      [1110, 552, 260],
      [640, 470, 320],
      [70, 400, 230],
      [1300, 400, 230],
      [420, 330, 240],
      [940, 330, 240],
      [660, 200, 280],
    ],
    hazards: [],
    springs: [[770, 726, 60]],
    spawns: [
      [120, 860], [390, 780], [620, 860], [1000, 860],
      [1210, 780], [1480, 860], [740, 470], [860, 470],
    ],
  },

  {
    id: 'foundry',
    name: 'Lava Foundry',
    blurb: 'Molten channels below the walkways. Falling costs you a second.',
    width: 1600,
    height: 900,
    gravityScale: 1,
    frictionScale: 1,
    theme: {
      sky: ['#2a0f0a', '#5c2109', '#170604'],
      solid: '#3a2118',
      solidEdge: '#ff9142',
      platform: '#b9663a',
      accent: '#ffca3a',
      hazard: '#ff5a1f',
      fog: 'rgba(255,120,40,0.14)',
      grid: 'rgba(255,150,80,0.08)',
      decor: 'embers',
    },
    solids: [
      [0, 0, 24, 900],
      [1576, 0, 24, 900],
      [24, 856, 300, 44],
      [444, 856, 326, 44],
      [890, 856, 270, 44],
      [1280, 856, 296, 44],
      [610, 700, 380, 34],
      [140, 620, 220, 30],
      [1240, 620, 220, 30],
    ],
    platforms: [
      [360, 760, 180],
      [1080, 760, 180],
      [430, 560, 220],
      [960, 560, 220],
      [700, 470, 220],
      [110, 440, 220],
      [1280, 440, 220],
      [380, 350, 230],
      [1000, 350, 230],
      [660, 240, 290],
    ],
    hazards: [
      [324, 880, 120, 20],
      [770, 880, 120, 20],
      [1160, 880, 120, 20],
    ],
    springs: [[500, 842, 70], [1000, 842, 70]],
    spawns: [
      [80, 856], [250, 856], [600, 856], [700, 700],
      [1000, 856], [1450, 856], [230, 620], [1350, 620],
    ],
  },

  {
    id: 'grove',
    name: 'Canopy Grove',
    blurb: 'Layered branches. Drop through anything to break a chase.',
    width: 1600,
    height: 900,
    gravityScale: 1,
    frictionScale: 1,
    theme: {
      sky: ['#0d2818', '#1f5c33', '#061410'],
      solid: '#3a2b1c',
      solidEdge: '#8a6b3f',
      platform: '#4f9a48',
      accent: '#ffe066',
      hazard: '#ff4d6d',
      fog: 'rgba(120,220,140,0.12)',
      grid: 'rgba(140,230,160,0.07)',
      decor: 'leaves',
    },
    solids: [
      [0, 860, 1600, 40],
      [0, 0, 24, 900],
      [1576, 0, 24, 900],
      [250, 620, 60, 240],
      [1290, 620, 60, 240],
      [770, 730, 60, 130],
    ],
    platforms: [
      [80, 770, 210],
      [560, 790, 220],
      [830, 790, 220],
      [1320, 770, 210],
      [180, 660, 240],
      [1180, 660, 240],
      [430, 620, 230],
      [940, 620, 230],
      [640, 526, 320],
      [90, 500, 230],
      [1280, 500, 230],
      [330, 396, 260],
      [1010, 396, 260],
      [660, 286, 280],
      [200, 250, 200],
      [1200, 250, 200],
    ],
    hazards: [],
    springs: [[700, 846, 60], [120, 846, 60], [1420, 846, 60]],
    spawns: [
      [130, 860], [420, 860], [640, 860], [960, 860],
      [1180, 860], [1470, 860], [720, 526], [880, 526],
    ],
  },

  {
    id: 'moon',
    name: 'Moon Base',
    blurb: 'One sixth gravity. Every jump is a floaty commitment.',
    moon: true,
    width: 1600,
    height: 1040,
    gravityScale: 0.34,
    frictionScale: 0.85,
    airScale: 0.9,
    theme: {
      sky: ['#05060f', '#131a33', '#02030a'],
      solid: '#2b2f45',
      solidEdge: '#9fb2ff',
      platform: '#6f7dbb',
      accent: '#7ef0ff',
      hazard: '#ff4d6d',
      fog: 'rgba(150,170,255,0.10)',
      grid: 'rgba(160,180,255,0.07)',
      decor: 'stars',
    },
    solids: [
      [0, 0, 24, 1040],
      [1576, 0, 24, 1040],
      [24, 1000, 1552, 40],
      [200, 830, 150, 40],
      [1250, 830, 150, 40],
      [700, 760, 200, 36],
    ],
    platforms: [
      [80, 880, 200],
      [1320, 880, 200],
      [430, 810, 220],
      [950, 810, 220],
      [180, 620, 240],
      [1180, 620, 240],
      [640, 560, 320],
      [380, 430, 240],
      [980, 430, 240],
      [80, 330, 220],
      [1300, 330, 220],
      [660, 280, 280],
      [300, 160, 240],
      [1060, 160, 240],
      [700, 90, 200],
    ],
    hazards: [],
    springs: [[770, 986, 60], [250, 816, 60], [1300, 816, 60]],
    spawns: [
      [120, 1000], [380, 1000], [700, 1000], [900, 1000],
      [1200, 1000], [1460, 1000], [275, 830], [1325, 830],
    ],
  },

  {
    id: 'house',
    name: 'Cozy House',
    blurb: 'Four rooms and two pairs of magic doors. Duck through one to cross the whole house instantly.',
    width: 1600,
    height: 900,
    gravityScale: 1,
    frictionScale: 1,
    theme: {
      sky: ['#2b1f14', '#4a3524', '#1a120b'],
      solid: '#5c3d24',
      solidEdge: '#d4a373',
      platform: '#8a5a35',
      accent: '#ffd166',
      hazard: '#ff4d6d',
      fog: 'rgba(120,80,40,0.14)',
      grid: 'rgba(200,160,100,0.06)',
      decor: 'dust',
    },
    solids: [
      [0, 860, 1600, 40],
      [0, 0, 24, 900],
      [1576, 0, 24, 900],
      // Low room dividers -- counters and bookcases, jumpable like any other
      // waist-high obstacle. They mark out four rooms without walling anyone in.
      [370, 740, 40, 120],
      [770, 740, 40, 120],
      [1170, 740, 40, 120],
    ],
    platforms: [
      [70, 730, 210],
      [470, 730, 220],
      [850, 730, 220],
      [1290, 730, 210],
      [180, 620, 240],
      [980, 620, 240],
      [560, 500, 480],
      [90, 396, 230],
      [1280, 396, 230],
      [660, 286, 280],
      [200, 180, 200],
      [1200, 180, 200],
    ],
    hazards: [],
    springs: [[250, 846, 60], [1350, 846, 60]],
    portals: [
      // Front door <-> back door: a straight shortcut across the whole house.
      { a: [150, 786], b: [1420, 786], hue: '#4cc9f0' },
      // Basement door <-> attic door: floor-to-loft vertical shortcut.
      { a: [560, 786], b: [1260, 106], hue: '#ff6b9d' },
    ],
    spawns: [
      [130, 860], [300, 860],
      [500, 860], [650, 730],
      [900, 860], [1050, 730],
      [1300, 860], [1500, 860],
    ],
  },

  {
    id: 'crossfire',
    name: 'Crossfire Yard',
    blurb: 'The tagger carries a dart gun. Break their sightline, or get shot from clear across the map.',
    guns: true,
    width: 1700,
    height: 900,
    gravityScale: 1,
    frictionScale: 1,
    theme: {
      sky: ['#2a2620', '#4a4436', '#161410'],
      solid: '#5c5648',
      solidEdge: '#d8c98a',
      platform: '#7a7260',
      accent: '#ff6b35',
      hazard: '#ff4d6d',
      fog: 'rgba(200,180,120,0.10)',
      grid: 'rgba(220,200,140,0.06)',
      decor: 'dust',
    },
    solids: [
      [0, 860, 1700, 40],
      [0, 0, 24, 900],
      [1676, 0, 24, 900],
      // Cover -- duck behind these to break the tagger's line of sight.
      [260, 742, 36, 118],
      [560, 742, 36, 118],
      [860, 742, 36, 118],
      [1160, 742, 36, 118],
      [1440, 742, 36, 118],
    ],
    platforms: [
      [70, 730, 280],
      [450, 730, 280],
      [830, 730, 280],
      [1210, 730, 280],
      [130, 600, 280],
      [530, 600, 280],
      [930, 600, 280],
      [70, 470, 280],
      [450, 470, 280],
      [830, 470, 280],
      [1210, 470, 280],
      [260, 340, 360],
      [740, 340, 360],
      [1180, 340, 300],
    ],
    hazards: [],
    springs: [[380, 846, 60], [1300, 846, 60]],
    spawns: [
      [150, 860], [420, 860], [950, 860], [1550, 860],
      [200, 730], [1080, 730],
      [550, 470], [1350, 470],
    ],
  },

  {
    id: 'blackout',
    name: 'Blackout',
    blurb: 'The tagger flickers invisible for a few seconds at a time. Watch for movement, not just shapes.',
    invisibilityCycle: true,
    detectionRange: 620,
    width: 1600,
    height: 900,
    gravityScale: 1,
    frictionScale: 1,
    theme: {
      sky: ['#050507', '#0d0d16', '#020203'],
      solid: '#26232f',
      solidEdge: '#8b7dff',
      platform: '#3d3850',
      accent: '#ff4d6d',
      hazard: '#ff4d6d',
      fog: 'rgba(106,99,255,0.12)',
      grid: 'rgba(120,110,255,0.06)',
      decor: 'stars',
    },
    solids: [
      [0, 860, 1600, 40],
      [0, 0, 24, 900],
      [1576, 0, 24, 900],
      [420, 720, 40, 140],
      [1140, 720, 40, 140],
    ],
    platforms: [
      [80, 730, 220],
      [460, 730, 220],
      [820, 730, 220],
      [1180, 730, 220],
      [180, 600, 240],
      [1180, 600, 240],
      [640, 560, 320],
      [80, 460, 220],
      [460, 460, 220],
      [820, 460, 220],
      [1180, 460, 220],
      [300, 320, 260],
      [1000, 320, 260],
      [660, 220, 280],
    ],
    hazards: [],
    springs: [[770, 846, 60], [140, 846, 60], [1400, 846, 60]],
    spawns: [
      [140, 860], [420, 860], [700, 860], [1000, 860],
      [1300, 860], [1470, 860], [720, 560], [880, 560],
    ],
  },

  {
    id: 'hideseek',
    name: 'Hush House',
    blurb: 'The seeker is frozen for a few seconds at the start. Everyone else scatters into the nooks.',
    seekerFreeze: 4,
    detectionRange: 480,
    width: 1600,
    height: 900,
    gravityScale: 1,
    frictionScale: 1,
    theme: {
      sky: ['#1c1408', '#3a2a10', '#0e0a04'],
      solid: '#4a3520',
      solidEdge: '#c9a45c',
      platform: '#6b4f2e',
      accent: '#ffcf5c',
      hazard: '#ff4d6d',
      fog: 'rgba(180,140,60,0.14)',
      grid: 'rgba(200,160,90,0.06)',
      decor: 'dust',
    },
    solids: [
      [0, 860, 1600, 40],
      [0, 0, 24, 900],
      [1576, 0, 24, 900],
      // Low dividers to duck behind -- same jumpable height already proven
      // safe on Neon Arena and Cozy House, just placed in the floor gaps
      // between platform tiers so they read as cover, not clutter.
      [330, 740, 36, 120],
      [670, 740, 36, 120],
      [1010, 740, 36, 120],
    ],
    platforms: [
      [70, 730, 220], [410, 730, 220], [750, 730, 220], [1090, 730, 220],
      [170, 600, 220], [510, 600, 220], [850, 600, 220], [1190, 600, 220],
      [70, 470, 220], [410, 470, 220], [750, 470, 220], [1090, 470, 220],
      [300, 340, 260], [820, 340, 260],
    ],
    hazards: [],
    springs: [[1100, 846, 60]],
    spawns: [
      [100, 860], [500, 860], [900, 860], [1300, 860],
      [150, 730], [850, 730], [500, 470], [1150, 470],
    ],
  },

  {
    id: 'turbo',
    name: 'Turbo Circuit',
    blurb: 'Everyone moves at 5x speed. The whole map is over in seconds.',
    speedScale: 5,
    width: 3600,
    height: 900,
    gravityScale: 1,
    frictionScale: 1,
    theme: {
      sky: ['#1a0a2e', '#4a1361', '#0f0518'],
      solid: '#4a2472',
      solidEdge: '#39f0d8',
      platform: '#6b3aa0',
      accent: '#39f0d8',
      hazard: '#ff4d6d',
      fog: 'rgba(150,80,255,0.10)',
      grid: 'rgba(200,150,255,0.10)',
    },
    // No interior solids at all -- at 5x speed a body can cross a lot of
    // ground in a single physics tick, so anything thinner than roughly the
    // hardCap-speed-per-tick distance risks a clean tunnel-through. Only the
    // floor and the two boundary walls (thickened well past that margin)
    // are collidable; every platform is one-way and safe at any speed since
    // those never block horizontal movement.
    solids: [
      [0, 860, 3600, 40],
      [0, 0, 80, 900],
      [3520, 0, 80, 900],
    ],
    platforms: [
      [200, 730, 400], [750, 730, 400], [1300, 730, 400], [1850, 730, 400],
      [2400, 730, 400], [2950, 730, 400],
      [420, 560, 350], [1020, 560, 350], [1620, 560, 350], [2220, 560, 350], [2820, 560, 350],
      [650, 390, 300], [1450, 390, 300], [2250, 390, 300], [3050, 390, 300],
    ],
    hazards: [],
    springs: [[500, 846, 60], [1700, 846, 60], [2900, 846, 60]],
    spawns: [
      [150, 860], [600, 860], [1050, 860], [1500, 860],
      [1950, 860], [2400, 860], [2850, 860], [3300, 860],
    ],
  },

  {
    id: 'candyland',
    name: 'Candy Land',
    blurb: 'Candy everywhere -- step on a piece and you freeze in place for 3 seconds.',
    width: 1700,
    height: 900,
    gravityScale: 1,
    frictionScale: 1,
    theme: {
      sky: ['#ffd6ec', '#ffb3d9', '#fff0f8'],
      solid: '#ff6b9d',
      solidEdge: '#ffffff',
      platform: '#ffd1e8',
      accent: '#39f0d8',
      hazard: '#ff4d6d',
      fog: 'rgba(255,150,200,0.14)',
      grid: 'rgba(255,255,255,0.08)',
      decor: 'sprinkles',
    },
    solids: [
      [0, 860, 1700, 40],
      [0, 0, 24, 900],
      [1676, 0, 24, 900],
      [400, 742, 36, 120],
      [860, 742, 36, 120],
      [1320, 742, 36, 120],
    ],
    platforms: [
      [80, 730, 260], [480, 730, 260], [880, 730, 260], [1280, 730, 260],
      [230, 600, 260], [630, 600, 260], [1030, 600, 260], [1400, 600, 220],
      [100, 470, 300], [520, 470, 300], [940, 470, 300], [1340, 470, 260],
    ],
    hazards: [],
    springs: [[300, 846, 60], [1200, 846, 60]],
    // Small (26x26) pickups sitting right on top of a surface -- never solid,
    // so they can never block a path or trap anyone, just tempt them.
    candies: [
      [180, 834, 26, 26], [660, 834, 26, 26], [1080, 834, 26, 26], [1560, 834, 26, 26],
      [130, 704, 26, 26], [560, 704, 26, 26], [960, 704, 26, 26], [1350, 704, 26, 26],
      [300, 574, 26, 26], [780, 574, 26, 26], [1200, 574, 26, 26],
      [220, 444, 26, 26], [680, 444, 26, 26], [1100, 444, 26, 26],
    ],
    spawns: [
      [60, 860], [1640, 860], [720, 860],
      [280, 730], [1220, 730],
      [700, 600], [1400, 600],
      [900, 470],
    ],
  },

  {
    id: 'upside',
    name: 'Upside Down',
    blurb: 'Gravity flipped -- the floor is at the top. Pays double coins.',
    width: 1600,
    height: 900,
    gravityScale: -1,
    frictionScale: 1,
    coinBonus: 2,
    theme: {
      sky: ['#2a0a4a', '#4a1a6b', '#1a0530'],
      solid: '#8b3aff',
      solidEdge: '#ffd166',
      platform: '#b980ff',
      accent: '#39f0d8',
      hazard: '#ff4d6d',
      fog: 'rgba(139,58,255,0.14)',
      grid: 'rgba(200,150,255,0.10)',
      decor: 'clouds',
    },
    // Neon Arena's exact geometry, mirrored vertically (y' = height - y - h,
    // and spawns adjusted the same way) -- since that map is already proven
    // fully reachable, the mirror image is too, just approached from a
    // flipped gravity instead of a re-derived layout.
    solids: [
      [0, 0, 1600, 40],
      [0, 0, 24, 900],
      [1576, 0, 24, 900],
      [430, 40, 40, 120],
      [1130, 40, 40, 120],
      [720, 170, 160, 40],
    ],
    platforms: [
      [170, 160, 230],
      [1200, 160, 230],
      [545, 300, 200],
      [855, 300, 200],
      [290, 416, 240],
      [1070, 416, 240],
      [660, 534, 280],
      [110, 570, 190],
      [1300, 570, 190],
      [400, 676, 200],
      [1000, 676, 200],
    ],
    hazards: [],
    springs: [],
    spawns: [
      [150, 78], [400, 78], [640, 78], [980, 78],
      [1230, 78], [1450, 78], [700, 586], [900, 586],
    ],
  },

  {
    id: 'surge',
    name: 'Surge Ruins',
    blurb: 'Glowing orbs grant one of 9 random mini superpowers, from speed and shields to gravity flips and radar.',
    width: 1600,
    height: 900,
    gravityScale: 1,
    frictionScale: 1,
    theme: {
      sky: ['#0a2230', '#123f4f', '#04121a'],
      solid: '#1f4a52',
      solidEdge: '#ffd166',
      platform: '#2f6b6f',
      accent: '#7dffea',
      hazard: '#ff4d6d',
      fog: 'rgba(60,200,190,0.14)',
      grid: 'rgba(120,255,230,0.08)',
      decor: 'ruins',
    },
    // Neon Arena's exact geometry -- already proven fully reachable by
    // reach.mjs, so reusing it here guarantees the same for these ruins
    // without re-deriving a layout from scratch. Only the theme and the
    // added orbs are new.
    solids: [
      [0, 860, 1600, 40],
      [0, 0, 24, 900],
      [1576, 0, 24, 900],
      [430, 740, 40, 120],
      [1130, 740, 40, 120],
      [720, 690, 160, 40],
    ],
    platforms: [
      [170, 726, 230],
      [1200, 726, 230],
      [545, 586, 200],
      [855, 586, 200],
      [290, 470, 240],
      [1070, 470, 240],
      [660, 352, 280],
      [110, 316, 190],
      [1300, 316, 190],
      [400, 210, 200],
      [1000, 210, 200],
    ],
    hazards: [],
    springs: [[770, 846, 60]],
    // One orb centered on top of every platform -- 28x28, resting right on
    // the surface exactly like a candy pickup does on Candy Land.
    orbs: [
      [271, 698, 28, 28], [1301, 698, 28, 28],
      [631, 558, 28, 28], [941, 558, 28, 28],
      [396, 442, 28, 28], [1176, 442, 28, 28],
      [786, 324, 28, 28],
      [191, 288, 28, 28], [1381, 288, 28, 28],
      [486, 182, 28, 28], [1086, 182, 28, 28],
    ],
    spawns: [
      [150, 860], [400, 860], [640, 860], [980, 860],
      [1230, 860], [1450, 860], [700, 352], [900, 352],
    ],
  },

  {
    id: 'chairs',
    name: 'Chair Chaos',
    blurb: "Musical chairs -- when the music stops, find a chair or you're out. Last one standing wins 300 coins.",
    width: 1600,
    height: 900,
    gravityScale: 1,
    frictionScale: 1,
    musicalChairs: true,
    theme: {
      sky: ['#3a0ca3', '#7209b7', '#240046'],
      solid: '#5a189a',
      solidEdge: '#ffd60a',
      platform: '#9d4edd',
      accent: '#ffd60a',
      hazard: '#ff4d6d',
      fog: 'rgba(157,78,221,0.14)',
      grid: 'rgba(255,214,10,0.08)',
      decor: 'embers',
    },
    // A single open floor plus three low platforms -- no walls or pillars
    // to block a fair scramble, since the whole point is reacting to the
    // music, not fighting the geometry to reach a chair in time.
    solids: [
      [0, 860, 1600, 40],
      [0, 0, 24, 900],
      [1576, 0, 24, 900],
    ],
    platforms: [
      [200, 760, 220],
      [700, 760, 220],
      [1180, 760, 220],
    ],
    hazards: [],
    springs: [],
    // 10 seats, one per max player slot -- room.js keeps exactly
    // (players remaining - 1) of these active at a time, deactivating one
    // more after every round of eliminations.
    chairs: [
      [83, 826, 34, 34], [543, 826, 34, 34], [1033, 826, 34, 34], [1483, 826, 34, 34],
      [225, 726, 34, 34], [345, 726, 34, 34],
      [725, 726, 34, 34], [845, 726, 34, 34],
      [1205, 726, 34, 34], [1325, 726, 34, 34],
    ],
    spawns: [
      [150, 860], [500, 860], [850, 860], [1200, 860],
      [1450, 860], [310, 760], [810, 760], [1290, 760],
    ],
  },

  {
    id: 'franken',
    name: "Frankenstein's Lab",
    blurb: "Get tagged and you become the monster -- green skin, neck bolts and all -- until you pass it on.",
    width: 1600,
    height: 900,
    gravityScale: 1,
    frictionScale: 1,
    frankenstein: true,
    theme: {
      sky: ['#0a1f14', '#173d24', '#040a06'],
      solid: '#1f4a2c',
      solidEdge: '#7dffb0',
      platform: '#2f6b45',
      accent: '#c58bff',
      hazard: '#ff4d6d',
      fog: 'rgba(90,255,150,0.12)',
      grid: 'rgba(150,255,180,0.08)',
      decor: 'sparks',
    },
    // Neon Arena's exact geometry, already proven fully reachable by
    // reach.mjs -- reused here the same way Surge Ruins and Upside Down
    // reused it, so the lab needs no fresh reachability pass; only the
    // theme and the frankenstein flag are new.
    solids: [
      [0, 860, 1600, 40],
      [0, 0, 24, 900],
      [1576, 0, 24, 900],
      [430, 740, 40, 120],
      [1130, 740, 40, 120],
      [720, 690, 160, 40],
    ],
    platforms: [
      [170, 726, 230],
      [1200, 726, 230],
      [545, 586, 200],
      [855, 586, 200],
      [290, 470, 240],
      [1070, 470, 240],
      [660, 352, 280],
      [110, 316, 190],
      [1300, 316, 190],
      [400, 210, 200],
      [1000, 210, 200],
    ],
    hazards: [],
    springs: [[770, 846, 60]],
    spawns: [
      [150, 860], [400, 860], [640, 860], [980, 860],
      [1230, 860], [1450, 860], [700, 352], [900, 352],
    ],
  },
];

export const MAP_BY_ID = Object.fromEntries(MAPS.map((m) => [m.id, m]));

export function getMap(id) {
  return MAP_BY_ID[id] || MAPS[0];
}

export function randomMapId() {
  return MAPS[Math.floor(Math.random() * MAPS.length)].id;
}
