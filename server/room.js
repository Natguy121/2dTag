// A Room is one game instance: a lobby, a round timer, up to 10 players (human
// or bot) and the authoritative simulation that drives them.

import * as C from '../shared/constants.js';
import { getMap, MAPS } from '../shared/maps.js';
import { BOT_NAMES, BOT_SKINS, DEFAULT_SKIN, SKIN_BY_ID } from '../shared/skins.js';
import { BOT_TRAILS, DEFAULT_TRAIL, TRAIL_BY_ID } from '../shared/trails.js';
import {
  createBody, placeAtSpawn, stepBody, bodiesTouch, decodeInput, resolveShot, overlaps,
} from '../shared/physics.js';
import { createBrain, think } from './bots.js';

let nextPlayerId = 1;

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** n distinct random indices in [0, total), ascending. */
function pickIndices(total, n) {
  const idxs = Array.from({ length: total }, (_, i) => i);
  for (let i = idxs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
  }
  return idxs.slice(0, n).sort((a, b) => a - b);
}

// Power orb pickups (map.orbs) roll one of C.ORB_POWERS at random. 'speed'
// and 'jump' are read by stepBody's speedMult/jumpMult opts; 'shield' is
// checked in resolveTags()/resolveShots(); 'invis' feeds updateInvisibility()
// the same p.invisible flag Blackout's tagger-cycle already uses.

export function sanitizeName(raw, fallback = 'Player') {
  // Strip control characters, collapse whitespace runs, then clamp length.
  let name = String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  name = name.slice(0, C.MAX_NAME_LENGTH).trim();
  return name.length ? name : fallback;
}

export function sanitizeSkin(raw) {
  return SKIN_BY_ID[raw] ? raw : DEFAULT_SKIN;
}

export function sanitizeTrail(raw) {
  return TRAIL_BY_ID[raw] ? raw : DEFAULT_TRAIL;
}

export class Room {
  constructor(opts = {}) {
    this.code = opts.code;
    this.name = opts.name || 'Tag Game';
    this.mapId = opts.mapId || 'arena';
    this.isPublic = opts.isPublic !== false;
    this.persistent = !!opts.persistent;
    this.maxPlayers = Math.min(C.MAX_PLAYERS, Math.max(1, opts.maxPlayers || C.MAX_PLAYERS));
    this.roundTime = opts.roundTime || C.ROUND_TIME_DEFAULT;
    this.botFill = opts.botFill !== false;
    this.minPlayers = Math.min(this.maxPlayers, Math.max(1, opts.minPlayers || C.MIN_ACTIVE_PLAYERS));
    this.botDifficulty = opts.botDifficulty || 'normal';
    this.rotateMaps = !!opts.rotateMaps;

    this.players = new Map();
    this.hostId = null;
    this.state = 'lobby'; // lobby | countdown | playing | results
    this.timer = 0;
    this.tick = 0;
    this.events = [];
    this.standings = null;
    this.emptySince = Date.now();
    this.rosterDirty = true;
    this.lobbyCheck = 0;
    this.seekerFreezeTimer = 0;
    this.orbCooldowns = []; // one entry per map.orbs, seconds until it can be grabbed again
    // Musical Chairs (map.musicalChairs). chairStage is null off that map;
    // otherwise 'moving' (music playing) or 'freeze' (find a chair now).
    this.chairStage = null;
    this.chairTimer = 0;
    this.activeChairs = []; // indices into map.chairs currently sittable
    this.chairEliminated = new Set();
    this.chairEliminationOrder = []; // array of id-arrays, earliest elimination first
    this.chairWinnerId = null;
    this.chairAssignment = new Map(); // id -> chair index, a bot-steering hint only
    this.onEmpty = null;
  }

  get map() {
    return getMap(this.mapId);
  }

  humanCount() {
    let n = 0;
    for (const p of this.players.values()) if (!p.isBot) n++;
    return n;
  }

  botCount() {
    let n = 0;
    for (const p of this.players.values()) if (p.isBot) n++;
    return n;
  }

  isFull() {
    return this.humanCount() >= this.maxPlayers;
  }

  // ---------------------------------------------------------------- players

  makePlayer({ name, skin, trail, isBot, conn }) {
    const id = String(nextPlayerId++);
    const player = {
      id,
      name,
      skin,
      trail: trail || DEFAULT_TRAIL,
      isBot: !!isBot,
      isAdmin: false,
      conn: conn || null,
      body: createBody(),
      inputBits: 0,
      lastSeq: 0,
      it: false,
      itTime: 0,
      tags: 0,
      timesTagged: 0,
      immunity: 0,
      respawn: 0,
      ping: 0,
      shotCooldown: 0,
      prevShoot: false,
      invisCycle: 0,
      invisible: false,
      candyFreeze: 0,
      candyImmune: 0,
      powerType: null,
      powerTimer: 0,
      ai: isBot ? createBrain(this.botDifficulty) : null,
      joinedAt: Date.now(),
    };
    placeAtSpawn(player.body, this.freeSpawn());
    return player;
  }

  addHuman(conn, name, skin, trail) {
    if (this.isFull()) return null;
    const player = this.makePlayer({
      name: sanitizeName(name),
      skin: sanitizeSkin(skin),
      trail: sanitizeTrail(trail),
      isBot: false,
      conn,
    });
    // Mid-round arrivals get a moment of grace so they are not instantly tagged.
    if (this.state === 'playing') player.immunity = 1.5;
    this.players.set(player.id, player);
    if (!this.hostId || !this.players.has(this.hostId)) this.hostId = player.id;
    this.rosterDirty = true;
    this.syncBots();
    return player;
  }

  addBot() {
    const used = new Set([...this.players.values()].map((p) => p.name));
    const available = BOT_NAMES.filter((n) => !used.has(n));
    const name = available.length ? pick(available) : `Bot ${this.players.size + 1}`;
    const bot = this.makePlayer({ name, skin: pick(BOT_SKINS), trail: pick(BOT_TRAILS), isBot: true });
    if (this.state === 'playing') bot.immunity = 1.2;
    this.players.set(bot.id, bot);
    this.rosterDirty = true;
    return bot;
  }

  removePlayer(id) {
    const player = this.players.get(id);
    if (!player) return;
    this.players.delete(id);
    this.rosterDirty = true;

    if (this.hostId === id) {
      const nextHost = [...this.players.values()].find((p) => !p.isBot);
      this.hostId = nextHost ? nextHost.id : null;
    }
    // If the tagger left mid-round, hand "it" to somebody else.
    if (player.it && this.state === 'playing') {
      const candidates = [...this.players.values()].filter((p) => p.respawn <= 0);
      if (candidates.length) {
        const next = pick(candidates);
        next.it = true;
        this.pushEvent({ type: 'newIt', to: next.id, reason: 'left' });
      }
    }
    this.syncBots();
    if (this.humanCount() === 0) {
      this.emptySince = Date.now();
      if (!this.persistent && this.onEmpty) this.onEmpty(this);
    }
  }

  /** Keep the bot population topped up to minPlayers (never above maxPlayers). */
  syncBots() {
    if (!this.botFill) {
      for (const p of [...this.players.values()]) if (p.isBot) this.players.delete(p.id);
      this.rosterDirty = true;
      return;
    }
    const humans = this.humanCount();
    // Persistent public rooms keep playing with a full bot roster so anybody
    // browsing the server list always drops into a live game.
    const desired = Math.min(this.maxPlayers, Math.max(this.minPlayers, humans));
    let total = this.players.size;

    while (total < desired) { this.addBot(); total++; }

    while (total > desired) {
      const bots = [...this.players.values()].filter((p) => p.isBot);
      if (!bots.length) break;
      // Drop a bot that is not currently "it" when possible.
      const victim = bots.find((b) => !b.it) || bots[0];
      if (victim.it && this.state === 'playing') {
        const others = [...this.players.values()].filter((p) => p.id !== victim.id);
        if (others.length) {
          const next = pick(others);
          next.it = true;
          this.pushEvent({ type: 'newIt', to: next.id, reason: 'left' });
        }
      }
      this.players.delete(victim.id);
      total--;
      this.rosterDirty = true;
    }
  }

  freeSpawn() {
    const spawns = this.map.spawns;
    let best = spawns[0];
    let bestDist = -1;
    for (const s of spawns) {
      let nearest = Infinity;
      for (const p of this.players.values()) {
        const d = Math.hypot(p.body.x + C.PLAYER_W / 2 - s[0], p.body.y + C.PLAYER_H - s[1]);
        nearest = Math.min(nearest, d);
      }
      if (nearest > bestDist) { bestDist = nearest; best = s; }
    }
    return best;
  }

  // ------------------------------------------------------------ round flow

  setSettings(patch = {}) {
    if (patch.mapId && MAPS.some((m) => m.id === patch.mapId)) this.mapId = patch.mapId;
    if (patch.roundTime && C.ROUND_TIME_OPTIONS.includes(Number(patch.roundTime))) {
      this.roundTime = Number(patch.roundTime);
    }
    if (typeof patch.isPublic === 'boolean') this.isPublic = patch.isPublic;
    if (typeof patch.botFill === 'boolean') this.botFill = patch.botFill;
    if (patch.maxPlayers) {
      this.maxPlayers = Math.min(C.MAX_PLAYERS, Math.max(1, Number(patch.maxPlayers) || C.MAX_PLAYERS));
      this.minPlayers = Math.min(this.minPlayers, this.maxPlayers);
    }
    if (patch.minPlayers) {
      this.minPlayers = Math.min(this.maxPlayers, Math.max(1, Number(patch.minPlayers)));
    }
    if (patch.botDifficulty && ['easy', 'normal', 'hard'].includes(patch.botDifficulty)) {
      this.botDifficulty = patch.botDifficulty;
      for (const p of this.players.values()) if (p.isBot) p.ai = createBrain(this.botDifficulty);
    }
    if (typeof patch.name === 'string') this.name = sanitizeName(patch.name, this.name);
    this.rosterDirty = true;
    if (this.state === 'lobby') this.resetPositions();
    this.syncBots();
  }

  resetPositions() {
    const spawns = this.map.spawns;
    let i = 0;
    for (const p of this.players.values()) {
      placeAtSpawn(p.body, spawns[i % spawns.length]);
      i++;
    }
  }

  startCountdown() {
    if (this.state === 'countdown' || this.state === 'playing') return;
    this.syncBots();
    if (this.players.size < 1) return;
    this.state = 'countdown';
    this.timer = C.COUNTDOWN_TIME;
    this.standings = null;
    this.resetPositions();
    for (const p of this.players.values()) {
      p.it = false;
      p.itTime = 0;
      p.tags = 0;
      p.timesTagged = 0;
      p.immunity = 0;
      p.respawn = 0;
      p.inputBits = 0;
      p.shotCooldown = 0;
      p.prevShoot = false;
      p.invisCycle = 0;
      p.invisible = false;
      p.candyFreeze = 0;
      p.candyImmune = 0;
      p.powerType = null;
      p.powerTimer = 0;
    }
    this.orbCooldowns = new Array((this.map.orbs || []).length).fill(0);
    this.chairStage = null;
    this.chairTimer = 0;
    this.activeChairs = [];
    this.chairEliminated = new Set();
    this.chairEliminationOrder = [];
    this.chairWinnerId = null;
    this.chairAssignment = new Map();
    // Musical Chairs has no tagger at all -- nobody gets the speed bonus or
    // the "X is IT" spotlight, since the whole rules set doesn't apply here.
    if (!this.map.musicalChairs) {
      const starter = pick([...this.players.values()]);
      starter.it = true;
      this.pushEvent({ type: 'newIt', to: starter.id, reason: 'start' });
    }
    this.rosterDirty = true;
  }

  beginRound() {
    this.state = 'playing';
    this.timer = this.roundTime;
    // Hide-and-seek maps freeze the tagger for a head start; everyone else is
    // free to move and scatter the instant the round begins.
    this.seekerFreezeTimer = this.map.seekerFreeze || 0;
    if (this.map.musicalChairs) this.startMusicalChairs();
    this.rosterDirty = true;
    this.pushEvent({ type: 'go' });
  }

  /** Kick off a Musical Chairs round: chairs = players - 1 (the classic
   * rule), a random subset of the map's chair slots picked to be active. A
   * solo game (or nobody at all) has nothing to play, so it resolves
   * immediately instead of sitting in a 'moving' phase with no one to
   * eliminate. */
  startMusicalChairs() {
    const map = this.map;
    const alive = [...this.players.values()].filter((p) => p.respawn <= 0);
    const chairCount = Math.max(0, Math.min(map.chairs.length, alive.length - 1));
    this.activeChairs = pickIndices(map.chairs.length, chairCount);
    if (alive.length <= 1) {
      this.chairWinnerId = alive[0]?.id ?? null;
      this.chairStage = null;
      this.endRound();
      return;
    }
    this.chairStage = 'moving';
    this.chairTimer = C.CHAIRS_MOVING_MIN + Math.random() * (C.CHAIRS_MOVING_MAX - C.CHAIRS_MOVING_MIN);
    this.pushEvent({ type: 'chairsMoving', chairs: this.activeChairs });
  }

  endRound() {
    this.state = 'results';
    this.timer = C.POST_ROUND_TIME;
    // Usually already null by the time a Musical Chairs game concludes
    // itself (see resolveChairElimination()), but the round timer can also
    // cut a game short mid-phase -- always land on a clean null so the
    // client never renders a stale "find a chair!" over the results screen.
    this.chairStage = null;
    const list = [...this.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      skin: p.skin,
      isBot: p.isBot,
      itTime: Math.round(p.itTime * 10) / 10,
      tags: p.tags,
      timesTagged: p.timesTagged,
      finishedIt: p.it,
    }));

    if (this.map.musicalChairs) {
      // Rank by how long each player lasted. Whoever's still in when the
      // game concludes (normally just the winner; everyone tied if the
      // round timer cuts it short first) ranks best, then work backwards
      // through elimination order -- most recently eliminated ranks next,
      // and so on. A simultaneous final-two elimination (nobody grabs the
      // last chair) means no one is "still in", so that last eliminated
      // pair ties for 1st instead -- co-winners, not no winner.
      const rank = new Map();
      let place = 1;
      const stillIn = [...this.players.values()].filter((p) => !this.chairEliminated.has(p.id));
      for (const p of stillIn) rank.set(p.id, place);
      place += stillIn.length;
      for (let i = this.chairEliminationOrder.length - 1; i >= 0; i--) {
        const group = this.chairEliminationOrder[i];
        for (const id of group) rank.set(id, place);
        place += group.length;
      }
      list.sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity)
        || a.name.localeCompare(b.name));
      list.forEach((entry) => {
        // Assign place from the computed rank, not the sorted array index --
        // a simultaneous elimination (or a round timer cutting the game
        // short with several players still in) means real ties, and the
        // array index alone would silently break them apart.
        entry.place = rank.get(entry.id) ?? list.length;
        const placeBonus = entry.place === 1 ? 20 : entry.place === 2 ? 10 : entry.place === 3 ? 5 : 0;
        entry.coinsEarned = 8 + placeBonus + (entry.place === 1 ? C.CHAIRS_WINNER_BONUS : 0);
      });
    } else {
      // Least time spent as "it" wins; more tags made breaks a tie.
      list.sort((a, b) => (a.itTime - b.itTime) || (b.tags - a.tags) || a.name.localeCompare(b.name));
      const coinMult = this.map.coinBonus || 1;
      list.forEach((entry, i) => {
        entry.place = i + 1;
        // Coins: a flat payout for finishing the round, more for tags made
        // and for time spent NOT it, with a bonus for placing well. Skins
        // are purely cosmetic, so this only ever buys a look, never an
        // advantage. Some maps (map.coinBonus) multiply the whole payout
        // further.
        const evadeBonus = Math.round(Math.max(0, this.roundTime - entry.itTime) / 12);
        const placeBonus = entry.place === 1 ? 20 : entry.place === 2 ? 10 : entry.place === 3 ? 5 : 0;
        entry.coinsEarned = Math.round((8 + entry.tags * 4 + evadeBonus + placeBonus) * coinMult);
      });
    }

    this.standings = list;
    this.rosterDirty = true;
    this.pushEvent({ type: 'roundEnd' });
  }

  returnToLobby() {
    this.state = 'lobby';
    this.timer = 0;
    if (this.rotateMaps) {
      const i = MAPS.findIndex((m) => m.id === this.mapId);
      this.mapId = MAPS[(i + 1) % MAPS.length].id;
    }
    this.resetPositions();
    for (const p of this.players.values()) {
      p.it = false;
      p.immunity = 0;
      p.respawn = 0;
    }
    this.chairStage = null;
    this.chairEliminated = new Set();
    this.syncBots();
    this.rosterDirty = true;
  }

  // ------------------------------------------------------------ simulation

  pushEvent(ev) {
    this.events.push(ev);
    if (this.events.length > 40) this.events.shift();
  }

  step(dt) {
    this.tick++;
    const map = this.map;
    const frozen = this.state === 'countdown' || this.state === 'results';
    if (this.state === 'playing') this.seekerFreezeTimer = Math.max(0, this.seekerFreezeTimer - dt);
    const seekerFrozen = this.seekerFreezeTimer > 0;
    for (let i = 0; i < this.orbCooldowns.length; i++) {
      if (this.orbCooldowns[i] > 0) this.orbCooldowns[i] = Math.max(0, this.orbCooldowns[i] - dt);
    }

    // Bots decide first so they move on the same tick as the humans.
    if (this.players.size) {
      const all = [...this.players.values()];
      for (const p of this.players.values()) {
        if (!p.isBot) continue;
        p.inputBits = frozen ? 0 : think(p, all, map, dt, this.state, {
          stage: this.chairStage,
          activeChairs: this.activeChairs,
          eliminated: this.chairEliminated,
          assignment: this.chairAssignment,
        });
      }
    }

    for (const p of this.players.values()) {
      if (p.respawn > 0) {
        p.respawn -= dt;
        if (p.respawn <= 0) {
          placeAtSpawn(p.body, this.freeSpawn());
          p.immunity = Math.max(p.immunity, 0.6);
          this.pushEvent({ type: 'spawn', id: p.id, x: p.body.x, y: p.body.y });
        }
        continue;
      }

      // Candy: touching a piece freezes movement for a few seconds, then a
      // short immunity window so standing on the same piece doesn't
      // instantly re-freeze the moment it wears off.
      const wasCandyFrozen = p.candyFreeze > 0;
      p.candyFreeze = Math.max(0, p.candyFreeze - dt);
      if (wasCandyFrozen && p.candyFreeze <= 0) p.candyImmune = C.CANDY_IMMUNITY;
      else p.candyImmune = Math.max(0, p.candyImmune - dt);

      // Power orbs: whichever mini superpower was rolled on pickup wears off
      // after ORB_POWER_TIME seconds.
      p.powerTimer = Math.max(0, p.powerTimer - dt);
      if (p.powerTimer <= 0) p.powerType = null;

      // Hide-and-seek: the tagger can't move for the first few seconds, so
      // everyone else gets a genuine head start to find a hiding spot.
      // Musical Chairs: an eliminated player is a spectator from here on --
      // still simulated (gravity still applies) but can't steer anymore.
      const chairedOut = map.musicalChairs && this.chairEliminated.has(p.id);
      const bits = frozen || (seekerFrozen && p.it) || p.candyFreeze > 0 || chairedOut ? 0 : p.inputBits;
      let speedMult = p.it && this.state === 'playing' ? C.TAGGER_SPEED_MULT : 1;
      let jumpMult = 1;
      if (p.powerTimer > 0 && p.powerType === 'speed') speedMult *= C.ORB_SPEED_MULT;
      if (p.powerTimer > 0 && p.powerType === 'jump') jumpMult *= C.ORB_JUMP_MULT;
      const gravityFlip = p.powerTimer > 0 && p.powerType === 'gravity';
      const canDoubleJump = p.powerTimer > 0 && p.powerType === 'doublejump';
      const ev = stepBody(p.body, bits, map, dt, {
        speedMult, jumpMult, gravityFlip, canDoubleJump,
      });

      if (ev.candy && p.candyFreeze <= 0 && p.candyImmune <= 0 && this.state === 'playing') {
        p.candyFreeze = C.CANDY_FREEZE_TIME;
        this.pushEvent({ type: 'candy', id: p.id, x: p.body.x, y: p.body.y });
      }

      if (ev.orb >= 0 && this.state === 'playing' && this.orbCooldowns[ev.orb] <= 0) {
        const power = pick(C.ORB_POWERS);
        p.powerType = power;
        p.powerTimer = C.ORB_POWER_TIME;
        this.orbCooldowns[ev.orb] = C.ORB_RESPAWN_TIME;
        this.pushEvent({
          type: 'orb', id: p.id, orb: ev.orb, power, x: p.body.x, y: p.body.y,
        });
      }

      if (ev.jumped) this.pushEvent({ type: 'jump', id: p.id, x: p.body.x, y: p.body.y });
      if (ev.spring) this.pushEvent({ type: 'spring', id: p.id, x: p.body.x, y: p.body.y });
      if (ev.portal) {
        this.pushEvent({
          type: 'portal', id: p.id,
          fromX: ev.portal.from.x, fromY: ev.portal.from.y,
          x: ev.portal.to.x, y: ev.portal.to.y,
        });
      }
      if (ev.hazard || ev.outOfBounds) {
        p.respawn = C.RESPAWN_TIME;
        p.body.vx = 0;
        p.body.vy = 0;
        this.pushEvent({
          type: ev.hazard ? 'hazard' : 'fell',
          id: p.id,
          x: p.body.x,
          y: p.body.y,
        });
      }

      p.immunity = Math.max(0, p.immunity - dt);
      if (p.it && this.state === 'playing') p.itTime += dt;
    }

    if (this.state === 'playing') {
      if (map.musicalChairs) {
        this.updateMusicalChairs(map, dt);
      } else {
        this.resolveTags();
        this.resolveShots(map, dt);
        this.resolveFreezeTouch();
        this.updateInvisibility(map, dt);
      }
    }

    // Timers.
    if (this.state === 'countdown') {
      this.timer -= dt;
      if (this.timer <= 0) this.beginRound();
    } else if (this.state === 'playing') {
      this.timer -= dt;
      if (this.timer <= 0 || this.players.size < 1) this.endRound();
    } else if (this.state === 'results') {
      this.timer -= dt;
      if (this.timer <= 0) this.returnToLobby();
    } else if (this.state === 'lobby') {
      // Public/idle rooms keep themselves going without anyone pressing start.
      // Topping the bots up has to happen here too, otherwise a persistent room
      // that boots empty has nobody to trigger its first syncBots().
      this.lobbyCheck -= dt;
      if (this.lobbyCheck <= 0) {
        this.lobbyCheck = 0.5;
        if (this.persistent || this.humanCount() === 0) {
          this.syncBots();
          if (this.players.size >= 1) this.startCountdown();
        }
      }
    }
  }

  resolveTags() {
    // Touch-tagging stays active on every map, guns included -- a gun just
    // adds a ranged option (see resolveShots()), it doesn't remove this one.
    const tagger = [...this.players.values()].find((p) => p.it);
    if (!tagger || tagger.respawn > 0) return;

    // The Reach power extends the tagger's grab range; irrelevant to anyone
    // who isn't currently "it" (the power still counts down while they hold
    // it, it just does nothing until they actually become the tagger).
    const reach = tagger.powerTimer > 0 && tagger.powerType === 'reach'
      ? C.TAG_REACH + C.ORB_REACH_BONUS : C.TAG_REACH;

    for (const p of this.players.values()) {
      if (p.id === tagger.id || p.respawn > 0 || p.immunity > 0) continue;
      if (p.powerTimer > 0 && p.powerType === 'shield') continue;
      if (!bodiesTouch(tagger.body, p.body, reach)) continue;
      this.applyTag(tagger, p, 'tag');
      return; // only one tag per tick
    }
  }

  /** Transfer "it" from tagger to target and announce it. Shared by the
   * touch-based resolveTags() and the gun maps' resolveShots(). */
  applyTag(tagger, target, eventType) {
    tagger.it = false;
    tagger.tags += 1;
    // Immunity protects the freed player from an instant tag-back. The new
    // tagger has no lockout of their own -- they can tag anyone else right
    // away, they just can't touch the player who's still immune.
    tagger.immunity = C.TAG_IMMUNITY;

    target.it = true;
    target.timesTagged += 1;
    target.invisCycle = 0;
    target.invisible = false;

    this.pushEvent({
      type: eventType,
      by: tagger.id,
      to: target.id,
      x: target.body.x + C.PLAYER_W / 2,
      y: target.body.y + C.PLAYER_H / 2,
    });
    this.rosterDirty = true;
  }

  /** The Frost Touch power: while held, touching any other player -- tagger
   * or not, no exceptions, same philosophy as candy pieces -- freezes them
   * in place. Reuses candyFreeze/candyImmune wholesale (same timers, same
   * frozen-movement handling above, same snapshot flag) since freezing
   * someone in place is exactly what that mechanic already does; only the
   * trigger (a player touch instead of a map candy tile) and the event type
   * differ, so the client can show ice instead of candy. */
  resolveFreezeTouch() {
    for (const holder of this.players.values()) {
      if (holder.respawn > 0 || holder.powerTimer <= 0 || holder.powerType !== 'freeze') continue;
      for (const p of this.players.values()) {
        if (p.id === holder.id || p.respawn > 0) continue;
        if (p.candyFreeze > 0 || p.candyImmune > 0) continue;
        if (!bodiesTouch(holder.body, p.body, C.TAG_REACH)) continue;
        p.candyFreeze = C.CANDY_FREEZE_TIME;
        this.pushEvent({
          type: 'freeze', id: p.id, by: holder.id, x: p.body.x, y: p.body.y,
        });
      }
    }
  }

  /** Gun maps: only the tagger can fire, on a cooldown, tapping (not holding)
   * the shoot input. A hit tags exactly like a touch would. */
  resolveShots(map, dt) {
    for (const p of this.players.values()) {
      p.shotCooldown = Math.max(0, p.shotCooldown - dt);
    }
    if (!map.guns) return;

    const tagger = [...this.players.values()].find((p) => p.it);
    if (!tagger || tagger.respawn > 0) return;

    const input = decodeInput(tagger.inputBits);
    const pressed = input.shoot && !tagger.prevShoot;
    tagger.prevShoot = input.shoot;
    if (!pressed || tagger.shotCooldown > 0) return;
    tagger.shotCooldown = C.SHOT_COOLDOWN;

    const targets = [...this.players.values()]
      .filter((p) => p.id !== tagger.id && p.respawn <= 0 && p.immunity <= 0
        && !(p.powerTimer > 0 && p.powerType === 'shield'))
      .map((p) => ({ id: p.id, body: p.body }));
    const shot = resolveShot(tagger.body, map, targets);

    this.pushEvent({
      type: 'shot', by: tagger.id, hitId: shot.hitId,
      fromX: shot.fromX, fromY: shot.fromY, toX: shot.toX,
    });

    if (shot.hitId) {
      const target = this.players.get(shot.hitId);
      if (target) this.applyTag(tagger, target, 'shotTag');
    }
  }

  /** Invisibility maps: the tagger cycles visible/invisible on a repeating
   * timer, always starting visible right when they become "it". Also
   * applies the 'invis' power-orb roll, which works the same way (hidden
   * from everyone but yourself) for whoever is holding it, tagger or not. */
  updateInvisibility(map, dt) {
    for (const p of this.players.values()) {
      let invisible = false;
      if (p.it && map.invisibilityCycle) {
        p.invisCycle += dt;
        const cycle = C.INVISIBLE_VISIBLE_TIME + C.INVISIBLE_HIDDEN_TIME;
        if (p.invisCycle >= cycle) p.invisCycle -= cycle;
        invisible = p.invisCycle >= C.INVISIBLE_VISIBLE_TIME;
      } else {
        p.invisCycle = 0;
      }
      if (p.powerTimer > 0 && p.powerType === 'invis') invisible = true;
      p.invisible = invisible;
    }
  }

  /** Musical Chairs' per-tick clock: count down the current phase and
   * transition once it runs out. The actual elimination check only happens
   * at the end of the 'freeze' (grace) phase, in resolveChairElimination(). */
  updateMusicalChairs(map, dt) {
    if (this.chairStage === 'moving') {
      this.chairTimer -= dt;
      if (this.chairTimer <= 0) {
        this.chairStage = 'freeze';
        this.chairTimer = C.CHAIRS_GRACE_TIME;
        // A projection of who'd grab which chair from right here, using
        // positions at the exact moment the music stops -- purely a bot
        // steering hint (see bots.js) so bots spread across the available
        // chairs instead of every bot independently beelining for whichever
        // one is nearest and pig-piling onto it. The real check below still
        // goes entirely off where everyone actually ends up standing.
        const alive = [...this.players.values()].filter((p) => !this.chairEliminated.has(p.id) && p.respawn <= 0);
        this.chairAssignment = this.assignChairs(map, alive, false);
        this.pushEvent({ type: 'chairsStop' });
      }
    } else if (this.chairStage === 'freeze') {
      this.chairTimer -= dt;
      if (this.chairTimer <= 0) this.resolveChairElimination(map);
    }
  }

  /** Greedy nearest-first chair matching: each active chair goes to the one
   * eligible player closest to it, one player per chair. With
   * requireOverlap true (the real elimination check) a player has to
   * actually be standing on the chair to be a candidate at all; false (the
   * pre-freeze bot-steering projection above) just ranks everyone by raw
   * distance since nobody's there yet. Returns a Map of id -> chair index. */
  assignChairs(map, players, requireOverlap) {
    const W = C.PLAYER_W;
    const H = C.PLAYER_H;
    const claims = [];
    for (const p of players) {
      for (const idx of this.activeChairs) {
        const c = map.chairs[idx];
        if (requireOverlap && !overlaps(p.body.x, p.body.y, W, H, c[0], c[1], c[2], c[3])) continue;
        const dx = (p.body.x + W / 2) - (c[0] + c[2] / 2);
        const dy = (p.body.y + H / 2) - (c[1] + c[3] / 2);
        claims.push({ id: p.id, chair: idx, dist: Math.hypot(dx, dy) });
      }
    }
    claims.sort((a, b) => a.dist - b.dist);
    const taken = new Set();
    const assigned = new Map();
    for (const c of claims) {
      if (taken.has(c.chair) || assigned.has(c.id)) continue;
      taken.add(c.chair);
      assigned.set(c.id, c.chair);
    }
    return assigned;
  }

  /** The music has stopped and the grace period is over: whoever isn't
   * touching one of the active chairs is out. When two or more players
   * overlap the same chair, only the closest one actually claims it --
   * standing on the same seat as someone else doesn't save you. */
  resolveChairElimination(map) {
    const alive = [...this.players.values()].filter(
      (p) => !this.chairEliminated.has(p.id) && p.respawn <= 0,
    );
    const safe = this.assignChairs(map, alive, true);
    const out = alive.filter((p) => !safe.has(p.id));
    if (out.length) {
      this.chairEliminationOrder.push(out.map((p) => p.id));
      for (const p of out) {
        this.chairEliminated.add(p.id);
        this.pushEvent({ type: 'chairsOut', id: p.id, x: p.body.x, y: p.body.y });
      }
      this.rosterDirty = true;
    }

    const remaining = alive.filter((p) => safe.has(p.id));
    if (remaining.length <= 1) {
      this.chairWinnerId = remaining[0]?.id ?? null;
      this.chairStage = null;
      this.endRound();
      return;
    }

    // One fewer chair every round -- deactivate a random currently-active
    // seat so it's never predictable which one disappears next.
    const drop = this.activeChairs[Math.floor(Math.random() * this.activeChairs.length)];
    this.activeChairs = this.activeChairs.filter((i) => i !== drop);
    this.chairAssignment = new Map(); // stale now -- recomputed at the next freeze
    this.chairStage = 'moving';
    this.chairTimer = C.CHAIRS_MOVING_MIN + Math.random() * (C.CHAIRS_MOVING_MAX - C.CHAIRS_MOVING_MIN);
    this.pushEvent({ type: 'chairsMoving', chairs: this.activeChairs });
  }

  // -------------------------------------------------------------- snapshots

  rosterPayload() {
    return {
      code: this.code,
      name: this.name,
      mapId: this.mapId,
      state: this.state,
      hostId: this.hostId,
      maxPlayers: this.maxPlayers,
      minPlayers: this.minPlayers,
      roundTime: this.roundTime,
      isPublic: this.isPublic,
      botFill: this.botFill,
      botDifficulty: this.botDifficulty,
      persistent: this.persistent,
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        skin: p.skin,
        trail: p.trail,
        isBot: p.isBot,
        isAdmin: p.isAdmin,
        it: p.it,
        tags: p.tags,
        itTime: Math.round(p.itTime * 10) / 10,
        ping: p.ping,
      })),
    };
  }

  snapshot() {
    const players = [];
    for (const p of this.players.values()) {
      let flags = 0;
      if (p.body.onGround) flags |= 1;
      if (p.it) flags |= 2;
      if (p.immunity > 0) flags |= 4;
      if (p.respawn > 0) flags |= 8;
      if (p.invisible) flags |= 16;
      if (p.candyFreeze > 0) flags |= 32;
      if (p.powerTimer > 0 && p.powerType === 'shield') flags |= 64;
      if (this.chairEliminated.has(p.id)) flags |= 128;
      players.push([
        p.id,
        Math.round(p.body.x * 100) / 100,
        Math.round(p.body.y * 100) / 100,
        Math.round(p.body.vx * 10) / 10,
        Math.round(p.body.vy * 10) / 10,
        p.body.facing,
        flags,
        p.powerTimer > 0 ? C.ORB_POWERS.indexOf(p.powerType) + 1 : 0,
        Math.round(p.powerTimer * 10) / 10,
      ]);
    }
    return {
      t: 'snap',
      tick: this.tick,
      state: this.state,
      timer: Math.max(0, Math.round(this.timer * 10) / 10),
      seekerFreeze: Math.round(this.seekerFreezeTimer * 10) / 10,
      orbs: this.orbCooldowns.map((c) => Math.round(c * 10) / 10),
      chairs: this.map.musicalChairs ? {
        stage: this.chairStage,
        timer: Math.round(this.chairTimer * 10) / 10,
        active: this.activeChairs,
        remaining: [...this.players.values()].filter((p) => !this.chairEliminated.has(p.id)).length,
      } : null,
      players,
      ev: this.events,
    };
  }

  listing() {
    return {
      code: this.code,
      name: this.name,
      mapId: this.mapId,
      state: this.state,
      players: this.players.size,
      humans: this.humanCount(),
      bots: this.botCount(),
      maxPlayers: this.maxPlayers,
      persistent: this.persistent,
    };
  }
}
