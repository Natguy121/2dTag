# 2D Tag

A 2D multiplayer tag game. One player is **it**; touch somebody else to pass it
on. When the clock runs out, whoever spent the least time as "it" wins.

Six maps, up to 8 players per game, hosted lobbies with share codes, unlockable
skins, and bots that keep every server busy even when nobody else is around.

## Running it

```bash
npm install
npm start
```

Then open <http://localhost:3000>. Set `PORT` to use a different port.

To play with friends on your network, they open `http://<your-ip>:3000` and use
**Play &rarr; Join Code** with the code shown in your lobby.

## The game

**Home** has three doors: **Play**, **Skins** and **Settings**.

**Play** offers:

| | |
|---|---|
| **Join Server** | Browse live public games, with player counts and current map. **Quick Play** drops you straight into the busiest one. |
| **Host Game** | Pick the map, round length, player cap, bot fill and bot skill, and whether the game is listed publicly or code-only. |
| **Join Code** | Type a friend's 4 character room code. |

### Rules

- One player is "it". Touching anyone else passes it on.
- The new tagger cannot tag for 1.2s, and whoever was just tagged out gets a
  short grace period, so tag-backs are not instant.
- The tagger moves ~11% faster, so chases actually resolve.
- Time as "it" accumulates. Lowest total wins; ties break on tags made.
- Falling out of the world or touching lava respawns you after ~1 second.

### Controls

Arrow keys or WASD to move, **Space**/**W**/**Up** to jump, **Down**/**S** to
drop through a platform. Every binding is remappable in Settings, and
touchscreens get on-screen buttons.

## Maps

| Map | Character |
|---|---|
| **Neon Arena** | Symmetric duel pit, nowhere to hide. |
| **Sky Towers** | Three towers over an open drop. Mind the gaps. |
| **Frost Cavern** | Slick ice, so committing to a direction is a decision. |
| **Lava Foundry** | Molten channels below the walkways. |
| **Canopy Grove** | Layered branches; drop through anything to break a chase. |
| **Moon Base** | **34% gravity.** Jumps go three times higher and hang in the air nearly three times as long. |

Every map fits 8 players, with 8 spawn points spread so nobody spawns on top of
anybody else.

## Bots

Bots fill any game up to 4 players by default (the host can change or disable
this), and leave again as humans arrive. They chase the nearest reachable
target when "it", flee and drop through platforms when they are not, jump gaps,
walk around pillars too tall to jump, and steer toward safe ground when they
are falling over lava.

Three **official servers** run permanently and are always populated with bots,
so the server browser is never empty and a lone player always lands in a game
that is already in progress.

## Skins

Twelve characters, eight unlocked from the start. The rest unlock through play:
25 tags, 10 rounds, 3 rounds on Moon Base, and 5 round wins. Progress lives in
`localStorage`.

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
server/     websocket server, rooms, bot AI
public/     the client: menus, renderer, prediction, input, audio
```

Sound is synthesised with WebAudio, so there are no asset files to load.

## Notes

- Room codes avoid `I`, `O`, `0` and `1` so they are unambiguous read aloud.
- Empty player-hosted rooms are cleaned up after 5 minutes.
- `GET /api/rooms` returns the public server list as JSON; `GET /api/health` is
  a health check.
