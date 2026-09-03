// A Room is one game instance: a lobby, a round timer, up to 10 players (human
// or bot) and the authoritative simulation that drives them.

import * as C from '../shared/constants.js';
import { getMap, MAPS } from '../shared/maps.js';
import { BOT_NAMES, BOT_SKINS, DEFAULT_SKIN, SKIN_BY_ID } from '../shared/skins.js';
import { BOT_TRAILS, DEFAULT_TRAIL, TRAIL_BY_ID } from '../shared/trails.js';
import { createBody, placeAtSpawn, stepBody, bodiesTouch, decodeInput, resolveShot } from '../shared/physics.js';
import { createBrain, think } from './bots.js';

let nextPlayerId = 1;

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

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
    }
    const starter = pick([...this.players.values()]);
    starter.it = true;
    this.pushEvent({ type: 'newIt', to: starter.id, reason: 'start' });
    this.rosterDirty = true;
  }

  beginRound() {
    this.state = 'playing';
    this.timer = this.roundTime;
    // Hide-and-seek maps freeze the tagger for a head start; everyone else is
    // free to move and scatter the instant the round begins.
    this.seekerFreezeTimer = this.map.seekerFreeze || 0;
    this.rosterDirty = true;
    this.pushEvent({ type: 'go' });
  }

  endRound() {
    this.state = 'results';
    this.timer = C.POST_ROUND_TIME;
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
    // Least time spent as "it" wins; more tags made breaks a tie.
    list.sort((a, b) => (a.itTime - b.itTime) || (b.tags - a.tags) || a.name.localeCompare(b.name));
    list.forEach((entry, i) => {
      entry.place = i + 1;
      // Coins: a flat payout for finishing the round, more for tags made and
      // for time spent NOT it, with a bonus for placing well. Skins are
      // purely cosmetic, so this only ever buys a look, never an advantage.
      const evadeBonus = Math.round(Math.max(0, this.roundTime - entry.itTime) / 12);
      const placeBonus = entry.place === 1 ? 20 : entry.place === 2 ? 10 : entry.place === 3 ? 5 : 0;
      entry.coinsEarned = 8 + entry.tags * 4 + evadeBonus + placeBonus;
    });
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

    // Bots decide first so they move on the same tick as the humans.
    if (this.players.size) {
      const all = [...this.players.values()];
      for (const p of this.players.values()) {
        if (!p.isBot) continue;
        p.inputBits = frozen ? 0 : think(p, all, map, dt, this.state);
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

      // Hide-and-seek: the tagger can't move for the first few seconds, so
      // everyone else gets a genuine head start to find a hiding spot.
      const bits = frozen || (seekerFrozen && p.it) ? 0 : p.inputBits;
      const speedMult = p.it && this.state === 'playing' ? C.TAGGER_SPEED_MULT : 1;
      const ev = stepBody(p.body, bits, map, dt, { speedMult });

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
      this.resolveTags();
      this.resolveShots(map, dt);
      this.updateInvisibility(map, dt);
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

    for (const p of this.players.values()) {
      if (p.id === tagger.id || p.respawn > 0 || p.immunity > 0) continue;
      if (!bodiesTouch(tagger.body, p.body, C.TAG_REACH)) continue;
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
      .filter((p) => p.id !== tagger.id && p.respawn <= 0 && p.immunity <= 0)
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
   * timer, always starting visible right when they become "it". */
  updateInvisibility(map, dt) {
    for (const p of this.players.values()) {
      if (!p.it || !map.invisibilityCycle) { p.invisCycle = 0; p.invisible = false; continue; }
      p.invisCycle += dt;
      const cycle = C.INVISIBLE_VISIBLE_TIME + C.INVISIBLE_HIDDEN_TIME;
      if (p.invisCycle >= cycle) p.invisCycle -= cycle;
      p.invisible = p.invisCycle >= C.INVISIBLE_VISIBLE_TIME;
    }
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
      players.push([
        p.id,
        Math.round(p.body.x * 100) / 100,
        Math.round(p.body.y * 100) / 100,
        Math.round(p.body.vx * 10) / 10,
        Math.round(p.body.vy * 10) / 10,
        p.body.facing,
        flags,
      ]);
    }
    return {
      t: 'snap',
      tick: this.tick,
      state: this.state,
      timer: Math.max(0, Math.round(this.timer * 10) / 10),
      seekerFreeze: Math.round(this.seekerFreezeTimer * 10) / 10,
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
