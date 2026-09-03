# 2D Tag

A 2D multiplayer tag game. One player is **it**; touch somebody else to pass it
on. When the clock runs out, whoever spent the least time as "it" wins.

Ten maps, 1 to 10 players per game, hosted lobbies with share codes, coins
and unlockable skins, and bots that keep every server busy even when nobody
else is around.

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
launches full-screen with its own icon, no browser bar, like a real app.

The game is a side-scroller and genuinely needs landscape to see enough of
the map -- if you're in portrait, it shows a "rotate your device" screen
instead of a broken, half-visible view. On-screen touch controls (movement +
jump, bottom corners) appear automatically once you're playing; keyboard
controls still work if a keyboard's attached.

## The game

**Home** has three doors: **Play**, **Skins** and **Settings**.

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

### Guns, invisibility & hide-and-seek

Three maps bend the base rules further, each in a different direction:

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

## Bots

Bots fill any game up to 4 players by default (the host can change or disable
this), and leave again as humans arrive. They chase the nearest reachable
target when "it", flee and drop through platforms when they are not, jump gaps,
walk around pillars too tall to jump, and steer toward safe ground when they
are falling over lava.

Three **official servers** run permanently and are always populated with bots,
so the server browser is never empty and a lone player always lands in a game
that is already in progress.

## Skins & coins

23 characters, 8 unlocked from the start, purely cosmetic -- no skin is faster
or bigger than another. The rest unlock two ways:

- **Play stats** (4 skins): 25 tags, 10 rounds, 3 rounds on Moon Base, 5 wins.
- **Coin shop** (11 skins, 120-600 coins): earned by playing rounds. Every
  player gets a payout at the end of a round -- a base amount, more for each
  tag made, more for time spent evading, and a placement bonus for finishing
  top 3 -- so even a rough round earns something. The flagship is **Prism** at
  600 coins, a shimmering rainbow finish.

Progress (stats, coins, owned skins) lives in `localStorage`, matching
everything else client-side in this app -- nobody's coin balance is a real
account, just like nobody's win count was before this.

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

- Wear any skin for the session, as a preview -- it doesn't purchase or
  permanently unlock anything, so it goes away if you lose admin.
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
shared/     constants, maps, physics, skins   (server + browser)
server/     websocket server, rooms, bot AI, name-claim + admin passwords
public/     the client: menus, renderer, prediction, input, audio
```

Sound is synthesised with WebAudio, so there are no asset files to load.

## Notes

- Room codes avoid `I`, `O`, `0` and `1` so they are unambiguous read aloud.
- Empty player-hosted rooms are cleaned up after 5 minutes.
- `GET /api/rooms` returns the public server list as JSON; `GET /api/health` is
  a health check.
