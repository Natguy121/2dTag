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
