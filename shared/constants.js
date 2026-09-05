// Constants shared by the authoritative server simulation and the client
// prediction code. Both sides import this exact file so the physics match.

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
export const SNAPSHOT_RATE = 20;

export const MAX_PLAYERS = 10;
export const MIN_ACTIVE_PLAYERS = 4; // bots top the room up to this many

// Character body (axis aligned box, x/y is the top-left corner).
export const PLAYER_W = 28;
export const PLAYER_H = 38;

// Movement.
export const MOVE_SPEED = 290;
export const ACCEL_GROUND = 2600;
export const ACCEL_AIR = 1600;
export const FRICTION_GROUND = 2800;
export const FRICTION_AIR = 260;
export const GRAVITY = 2100;
export const JUMP_VELOCITY = 800; // ~152px of height at standard gravity
export const MAX_FALL = 1400;
export const JUMP_CUT = 0.45; // velocity kept when the jump key is released early
export const COYOTE_TIME = 0.1;
export const JUMP_BUFFER = 0.12;
export const DROP_TIME = 0.22; // how long "down" disables one-way platforms
export const SPRING_VELOCITY = 1180;

// Tag rules.
export const TAGGER_SPEED_MULT = 1.11;
export const TAG_IMMUNITY = 0.9; // the player who was just "it" cannot be tagged
export const TAG_REACH = 6; // extra pixels of grab range around the tagger

// Guns (maps with map.guns: true). Only the current tagger can fire -- a shot
// is a straight horizontal ray, blocked by solid geometry, and tags on hit
// exactly like a touch would (same immunity, same events).
export const SHOT_COOLDOWN = 1.0;
export const SHOT_RANGE = 900;

// Invisibility (maps with map.invisibilityCycle: true). The tagger alternates
// visible/invisible on a repeating cycle -- a fresh tagger always starts
// visible, giving everyone a fair moment to see who they're running from.
export const INVISIBLE_VISIBLE_TIME = 3;
export const INVISIBLE_HIDDEN_TIME = 2;

// Hide and seek (maps with map.seekerFreeze: N). The tagger can't move for N
// seconds after the round begins, giving everyone else a head start to hide.

// Candy (maps with map.candies: [...]). Touching a candy piece freezes
// whoever touched it in place -- anyone, tagger or not, no exceptions -- for
// CANDY_FREEZE_TIME seconds. CANDY_IMMUNITY is a short grace period right
// after thawing so standing on the same piece doesn't immediately re-freeze.
export const CANDY_FREEZE_TIME = 3;
export const CANDY_IMMUNITY = 1.5;

// Power orbs (maps with map.orbs: [...]). Touching a glowing orb grants
// whoever touched it -- anyone, tagger or not -- one of nine random mini
// superpowers for ORB_POWER_TIME seconds. That orb then goes dark for
// ORB_RESPAWN_TIME seconds before it can be grabbed again.
//   speed       extra move speed (ORB_SPEED_MULT)
//   jump        a much bigger single jump (ORB_JUMP_MULT)
//   shield      can't be tagged or shot
//   invis       hidden from everyone but yourself (same rendering as
//               INVISIBLE_* above)
//   gravity     your own personal Upside Down -- gravity flips just for
//               you, independent of the map (stepBody's opts.gravityFlip)
//   doublejump  one extra mid-air jump (stepBody's opts.canDoubleJump)
//   freeze      touching another player freezes them in place, reusing
//               the exact CANDY_FREEZE_TIME/CANDY_IMMUNITY mechanic candy
//               pieces use
//   radar       always shows which way the tagger is (or, if you're the
//               tagger, the nearest other player) -- a client-only compass,
//               no gameplay change
//   reach       extended tag range (ORB_REACH_BONUS extra pixels)
export const ORB_POWER_TIME = 6;
export const ORB_RESPAWN_TIME = 9;
export const ORB_SPEED_MULT = 1.6;
export const ORB_JUMP_MULT = 1.55;
export const ORB_REACH_BONUS = 42;
// Snapshot player entries carry a power as 1-based index into this list (0 =
// no power) -- both server and client read the same array so the wire code
// and the display name/icon can never drift apart. Append only -- the index
// is what's actually sent over the wire.
export const ORB_POWERS = [
  'speed', 'jump', 'shield', 'invis', 'gravity', 'doublejump', 'freeze', 'radar', 'reach',
];

// Musical Chairs (maps with map.musicalChairs: true). No tagging at all on
// this map -- instead, music plays for a random MOVING window, then everyone
// must be touching an active chair before CHAIRS_GRACE_TIME runs out or
// they're eliminated. Chairs are always (players remaining - 1), the classic
// rule, so exactly one round's worth of players are guaranteed to miss out
// each cycle; the last player left standing wins on the spot and earns
// CHAIRS_WINNER_BONUS coins on top of the normal per-round payout.
export const CHAIRS_MOVING_MIN = 4;
export const CHAIRS_MOVING_MAX = 8;
export const CHAIRS_GRACE_TIME = 2.8;
export const CHAIRS_WINNER_BONUS = 300;

// Round flow.
export const COUNTDOWN_TIME = 3;
export const ROUND_TIME_DEFAULT = 150;
export const ROUND_TIME_OPTIONS = [60, 90, 120, 150, 210, 300];
export const POST_ROUND_TIME = 12;
export const RESPAWN_TIME = 1.1;

// Networking.
export const PROTOCOL_VERSION = 3;
export const CODE_LENGTH = 4;
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1
export const MAX_NAME_LENGTH = 14;
export const IDLE_ROOM_TIMEOUT = 5 * 60 * 1000;

// Camera / view. The camera covers at least this much of the world, so a wider
// window sees more rather than zooming in. Tuned so characters stay readable
// while you can still see a tagger coming from across the map.
export const VIEW_W = 1100;
export const VIEW_H = 620;
