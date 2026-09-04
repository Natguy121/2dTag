# 2D Tag

A 2D multiplayer tag game. One player is **it**; touch somebody else to pass it
on. When the clock runs out, whoever spent the least time as "it" wins.

Fourteen maps, 1 to 10 players per game, hosted lobbies with share codes,
coins earned by playing or from quests, unlockable skins and trails, 20
background music tracks, and bots that keep every server busy even when
nobody else is around.

## Running it

```bash
npm install
npm start
```

Then open <http://localhost:3000>. Set `PORT` to use a different port.

To play with friends on your network, they open `http://<your-ip>:3000` and use
**Play &rarr; Join Code** with the code shown in your lobby.

### On a phone

Open the site in your phone's browser, then add it to your home screen --
**Safari:** Share &rarr; Add to Home Screen. **Chrome on Android:** &vellip;
menu &rarr; Add to Home screen (or it may offer to install automatically). It
launches full-screen with its own icon, no browser bar, like a real app. The
icon itself is drawn with the same in-game character renderer as everything
else -- two characters mid-tag, not a generic logo.

The game is a side-scroller and genuinely needs landscape to see enough of
the map -- if you're in portrait, it shows a "rotate your device" screen
instead of a broken, half-visible view. On-screen touch controls (movement +
jump, bottom corners) appear automatically once you're playing; keyboard
controls still work if a keyboard's attached.

## The game

**Home** has three doors: **Play**, **Skins** and **Settings** -- plus a
small looping animation in the top corner, two characters tagging each
other back and forth, that swipes in each time you land back on the screen.
Purely decorative (it reuses the same character renderer as actual
gameplay), but it beats a static logo.

**Play** offers:

| | |
|---|---|
| **Join Server** | Browse live public games, with player counts and current map. **Quick Play** drops you straight into the busiest one. |
| **Host Game** | Pick the map, round length, player cap, bot fill and bot skill, and whether the game is listed publicly or code-only. |
| **Join Code** | Type a friend's 4 character room code. |

### Rules

- One player is "it". Touching anyone else passes it on, instantly, no lockout.
- Whoever was just tagged out gets a 0.9s grace period, so the new tagger can't
  immediately tag them right back -- but can freely tag anyone else at once.
- The tagger moves ~11% faster, so chases actually resolve.
- Time as "it" accumulates. Lowest total wins; ties break on tags made.
- Falling out of the world or touching lava respawns you after ~1 second.

### Controls

Arrow keys or WASD to move, **Space**/**W**/**Up** to jump, **Down**/**S** to
drop through a platform, **F** to fire on gun maps. Every binding is
remappable in Settings, and touchscreens get on-screen buttons.

## Maps

| Map | Character |
|---|---|
| **Neon Arena** | Symmetric duel pit, nowhere to hide. |
| **Sky Towers** | Three towers over an open drop. Mind the gaps. |
| **Frost Cavern** | Slick ice, so committing to a direction is a decision. |
| **Lava Foundry** | Molten channels below the walkways. |
| **Canopy Grove** | Layered branches; drop through anything to break a chase. |
| **Moon Base** | **34% gravity.** Jumps go three times higher and hang in the air nearly three times as long. |
| **Cozy House** | Four rooms, two pairs of magic doors. Step through one to cross the whole house instantly. |
| **Crossfire Yard** | The tagger carries a gun. Break their sightline, or get shot from clear across the map. |
| **Blackout** | The tagger flickers invisible for a few seconds at a time. |
| **Hush House** | Hide-and-seek: the seeker is frozen for a few seconds at the start. |
| **Turbo Circuit** | **5x speed.** A 3600px straightaway that's over in seconds. |
| **Candy Land** | Candy everywhere. Step on a piece and freeze in place for 3 seconds. |
| **Upside Down** | Gravity flipped -- the floor is at the top. Pays double coins. |
| **Surge Ruins** | Glowing orbs grant a random mini superpower: speed, a big jump, a shield or brief invisibility. |

Every map has 8 dedicated spawn points spread so nobody spawns on top of
anybody else. The host can cap a game anywhere from 1 (solo) to 10 players; a
9th or 10th player reuses one of those 8 spots.

### Portals

Cozy House introduces portals: walk into either door of a linked pair and you
instantly come out the other side, keeping your speed and direction. Each pair
has its own color so you can tell them apart -- a blue front-door/back-door
pair for crossing the house, and a pink basement/attic pair for a vertical
shortcut. A brief cooldown after arriving stops you from immediately
bouncing straight back through.

### Rule-bending maps

Seven maps bend the base rules further, each in a different direction:

- **Crossfire Yard** gives the tagger a gun. Fire with **F** (or the
  on-screen target button on touch) to send a straight horizontal shot --
  it tags on hit exactly like a touch would, same immunity window and all,
  but it reaches clear across the map and stops dead at the first wall or
  platform in its path. One second of cooldown between shots. Only the
  current tagger can fire; everyone else just has to stay out of the lane.
- **Blackout** makes the tagger flicker: visible for 3 seconds, invisible
  for 2, on a repeating loop for as long as they're it. An invisible tagger
  renders for nobody but themselves (as a faint outline, so you always know
  your own state) -- and bots lose track of an invisible tagger exactly like
  a human would, so it's not an unfair advantage over the AI.
- **Hush House** is hide-and-seek: whoever's it is frozen in place for the
  first 4 seconds of every round, giving everyone else a genuine head start
  to scatter into the nooks and side rooms before the chase begins.
- **Turbo Circuit** moves everyone at 5x normal speed. The map itself is
  scaled up to match (3600px, four and a half times the width of most maps)
  so there's still room to actually run -- with no interior walls at all,
  since a body moving that fast can cross a thin one within a single physics
  tick without ever registering the collision. Only the floor and the two
  boundary walls (thickened well past that margin) are solid; every platform
  is one-way and safe at any speed.
- **Candy Land** scatters wrapped candy pieces across the map. Touch one --
  tagger or not, no exceptions -- and you freeze in place for 3 seconds
  (a pulsing glow ring and a candy icon over your character while it lasts),
  with a crinkling wrapper sound that runs exactly as long as the freeze
  does. A short grace period after thawing stops the same piece from
  instantly re-catching you before you can step off it. Candy is never
  solid, so it can't block a path or trap anyone -- only tempt them.
- **Upside Down** flips gravity: the floor is a solid strip along the top of
  the map instead of the bottom, jumping pushes you down instead of up, and
  one-way platforms hang from below rather than resting on top -- every
  direction-sensitive part of the physics mirrors accordingly. Everyone's
  end-of-round coin payout is doubled here, so it's worth the disorientation.
- **Surge Ruins** scatters 11 glowing orbs across the ruins, one on top of
  every platform. Touch one -- anyone, tagger or not -- and it grants a
  random mini superpower for 6 seconds: a burst of **speed**, a much bigger
  **jump**, a **shield** that can't be tagged or shot, or brief
  **invisibility** (hidden from everyone but yourself, same as Blackout's
  tagger). That orb then goes dark and can't be grabbed again for 9 seconds,
  so the map keeps redistributing power instead of one player camping every
  pickup. A small on-screen ring and an icon over your head show which power
  you're holding and how long it has left; a matching badge in the HUD
  spells it out.

## Bots

Bots fill any game up to 4 players by default (the host can change or disable
this), and leave again as humans arrive. They chase the nearest reachable
target when "it", flee and drop through platforms when they are not, jump gaps,
walk around pillars too tall to jump, and steer toward safe ground when they
are falling over lava.

Three **official servers** run permanently and are always populated with bots,
so the server browser is never empty and a lone player always lands in a game
that is already in progress.

## Skins, trails & coins

46 characters, 13 unlocked from the start, purely cosmetic -- no skin is
faster or bigger than another, and the palette is deliberately wide and
vivid (no black or near-black skin exists). The rest unlock two ways:

- **Play stats** (12 skins): from a quick one like 10 rounds played up to a
  grind like 60 tags.
- **Coin shop** (21 skins, 120-600 coins): earned by playing rounds. Every
  player gets a payout at the end of a round -- a base amount, more for each
  tag made, more for time spent evading, and a placement bonus for finishing
  top 3 -- so even a rough round earns something. Upside Down doubles that
  entire payout for everyone in the round. The flagship is **Prism** at
  600 coins, a shimmering rainbow finish.

**Trails** work the same way as a second, independent cosmetic slot: a
colored particle trickle behind you while moving fast, equipped separately
from your skin so the two mix and match. 17 options (including "None"), same
wide, no-black palette as the skins: some free, some unlocked by stats, the
rest bought with coins (120-400).

Progress (stats, coins, owned skins/trails) lives in `localStorage`, matching
everything else client-side in this app -- nobody's coin balance is a real
account, just like nobody's win count was before this.

## Quests

The **Quests** tab (next to Skins and Trails on the Skins screen) is a
second way to earn coins beyond just playing rounds: 12 one-time milestones
-- win your first round, tag 50 players, land 10 shots on Crossfire Yard,
play on 5 different maps, and so on -- each paying a coin bounty once you
hit its goal. Progress ticks up automatically from the same stats that gate
skin and trail unlocks; claiming is a separate tap so finishing one is its
own moment instead of a number quietly changing in the background.

## Music

20 background tracks, all synthesised live with WebAudio -- same as every
sound effect, so there are no audio files to ship. Each one is really the
same small bass/lead/light-drum generator fed a different parameter set
(tempo, scale, chord progression, oscillator waveforms per voice), which is
what makes 20 distinct-sounding loops practical without hand-authoring 20
scores: `Chiptune Rush`, `Lo-Fi Chill`, `Retro Arcade`, `Epic Chase`,
`Candy Pop`, `Space Drift`, `Neon Nights`, `Jungle Groove`, `Frost Waltz`,
`Volcano Heat`, `Moonlight Float`, `Turbo Blitz`, `Spy Stealth`,
`Carnival Fun`, `Dungeon Crawl`, `Sunny Meadow`, `Robot Factory`,
`Pixel Dreams`, `Disco Dash` and `Victory March`.

Pick a track and its volume independently of sound effects in **Settings**
-- music starts on the first click or key press anywhere (browsers won't
allow audio before that), keeps looping across every screen, and switches
instantly if you change track mid-game.

## Passwords & admin

Optionally set a password in **Settings** to claim your display name on shared
servers, so nobody else can play as "you". It's lightweight by design: claims
live in the server's memory only and reset if the server restarts (same as
every room and bot in the game right now) -- this is not a real account
system, just enough to stop casual name-squatting between friends. Leave it
blank and your name works exactly as it always has, first-come first-served
each time.

Admin access is separate from name passwords and is **not** built into the
code -- there is no password baked into the repository that grants it, because
this repo is public and anyone could read it. Instead, admin is gated behind
an `ADMIN_PASSWORD` environment variable that only the person running the
server sets:

```bash
ADMIN_PASSWORD=your-own-secret npm start
```

On Render: **Dashboard &rarr; your service &rarr; Environment &rarr; Add
Environment Variable**, key `ADMIN_PASSWORD`. If it's unset, admin login is
disabled entirely -- nobody can log in as admin at all, including you.

Log in from **Settings &rarr; Admin** with that password. It's a per-session
grant (like everything else, not persisted) -- you re-enter it each time you
open the game. Admin lets you:

- Wear any skin or trail for the session, as a preview -- it doesn't purchase
  or permanently unlock anything, so it goes away if you lose admin.
- Grant yourself coins on demand, applied the same way any coin payout is.
- Kick a player from a room you're in, and start or force-start a round even
  if you're not the host.

Skins have no gameplay effect, so none of this is a competitive advantage --
it's convenience for the person running the server, not a cheat.

## How it works

The server is authoritative: clients only ever send an input bitmask, and the
server runs the simulation at 60Hz and broadcasts snapshots at 20Hz.

`shared/` holds the physics, maps, constants and skins, and is loaded **by both
sides from the same files**, which is what makes client prediction exact:

- **Local player** &mdash; predicted immediately. Each snapshot carries the last
  input sequence the server consumed, so the client snaps to the authoritative
  position and replays anything still in flight. Leftover error is smoothed over
  120ms instead of teleporting.
- **Everyone else** &mdash; rendered 100ms in the past and interpolated between
  snapshots, which hides jitter and packet timing.

```
shared/     constants, maps, physics, skins, trails, quests   (server + browser)
server/     websocket server, rooms, bot AI, name-claim + admin passwords
public/     the client: menus, renderer, prediction, input, audio, music
```

Every sound effect and all 20 music tracks are synthesised with WebAudio, so
there are no audio asset files to load.

## Notes

- Room codes avoid `I`, `O`, `0` and `1` so they are unambiguous read aloud.
- Empty player-hosted rooms are cleaned up after 5 minutes.
- `GET /api/rooms` returns the public server list as JSON; `GET /api/health` is
  a health check.
