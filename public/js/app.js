// Screen routing and all DOM wiring: home, play, host, server browser, join
// code, lobby, skins, settings and the in-game HUD.

import * as C from '/shared/constants.js';
import { MAPS, getMap } from '/shared/maps.js';
import { SKINS, getSkin, isUnlocked } from '/shared/skins.js';
import { TRAILS, isTrailUnlocked } from '/shared/trails.js';
import { QUESTS } from '/shared/quests.js';
import * as net from './net.js';
import * as input from './input.js';
import {
  profile, save, resetStats, resetKeys, keyLabel, bumpStat, addCoins, buySkin, buyTrail,
  claimQuest, DEFAULT_KEYS,
} from './storage.js';
import { sfx, unlock as unlockAudio, setVolume } from './audio.js';
import * as music from './music.js';
import * as homeDemo from './homeDemo.js';
import { drawMapPreview, drawSkinPreview, formatTime } from './render.js';
import { Game, POWER_COLORS } from './game.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const screens = new Map($$('[data-screen]').map((el) => [el.dataset.screen, el]));
let currentScreen = 'home';
let room = null;      // last roster payload
let youId = null;
let selectedHostMap = 'arena';
let game = null;
let toastTimer = null;
// Admin is a per-session grant, not saved to localStorage: you re-enter the
// password each time you open the game, same as the server does per connection.
// The password itself is kept in memory only (never localStorage) so a brief
// network drop can silently re-authenticate without asking you to retype it.
let isAdminSession = false;
let adminPasswordCache = '';

// --------------------------------------------------------------- screens

// Best-effort landscape lock while actually playing. Support is inconsistent
// (mainly Android Chrome, and often only once installed to the home screen
// or in fullscreen) -- the CSS rotate-prompt is the reliable fallback
// everywhere else, so a failure here is expected and silently ignored.
function lockLandscape() {
  try {
    screen.orientation?.lock?.('landscape')?.catch(() => {});
  } catch {
    /* unsupported */
  }
}

function unlockOrientation() {
  try {
    screen.orientation?.unlock?.();
  } catch {
    /* unsupported */
  }
}

function showScreen(name) {
  if (currentScreen === name) return;
  const prev = screens.get(currentScreen);
  const next = screens.get(name);
  if (prev) prev.classList.remove('is-active');
  if (next) next.classList.add('is-active');
  currentScreen = name;

  if (name === 'game') {
    if (!game) game = createGame();
    game.start(youId);
    $('[data-touch]').hidden = !input.isTouchDevice();
    $('[data-shoot-btn]').hidden = !game.map.guns;
    lockLandscape();
  } else if (game) {
    game.stop();
    unlockOrientation();
  }

  if (name === 'join-server') refreshServers();
  if (name === 'skins') renderShop();
  if (name === 'settings') renderSettings();
  if (name === 'home') {
    drawProfilePreview();
    homeDemo.start($('[data-home-demo-canvas]'));
    // Retrigger the swipe-in animation every time Home comes back into view
    // -- toggling the class with no reflow between wouldn't restart it.
    const demo = $('[data-home-demo]');
    demo.classList.remove('is-swiping');
    void demo.offsetWidth;
    demo.classList.add('is-swiping');
  } else {
    homeDemo.stop();
  }
}

function toast(message, ms = 2600) {
  const el = $('[data-toast]');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

// ------------------------------------------------------------ networking

net.on('open', () => {
  $('[data-net-banner]').hidden = true;
  net.send({ t: 'hello', name: profile.name, skin: profile.skin, trail: profile.trail, password: profile.namePassword });
  if (isAdminSession) net.send({ t: 'admin', password: adminPasswordCache });
  if (currentScreen === 'join-server') refreshServers();
});

net.on('close', () => {
  const banner = $('[data-net-banner]');
  banner.textContent = 'Connection lost - reconnecting...';
  banner.hidden = false;
});

net.on('error', (msg) => {
  toast(msg.message || 'Something went wrong.');
  const err = $('[data-code-error]');
  if (currentScreen === 'join-code') err.textContent = msg.message || '';
});

net.on('rooms', (msg) => renderServerList(msg.rooms));

net.on('kicked', (msg) => {
  toast(msg.message || 'You were removed from the game.');
  leaveRoomLocally();
});

net.on('renamed', (msg) => {
  // The name we asked for is password-protected by someone else; the server
  // assigned a free variant instead. Reflect that everywhere so the UI never
  // shows a name we don't actually have.
  profile.name = msg.name;
  save();
  toast(msg.reason);
  if (currentScreen === 'settings') $('[data-setting-name]').value = profile.name;
  drawProfilePreview();
});

net.on('adminResult', (msg) => {
  isAdminSession = msg.ok;
  if (!msg.ok) adminPasswordCache = '';
  const message = msg.ok
    ? 'Admin access granted.'
    : msg.reason === 'unset'
      ? "This server has no admin password set -- the owner needs to add ADMIN_PASSWORD in Render's Environment tab."
      : 'Wrong admin password.';
  toast(message, msg.ok ? 2600 : 4200);
  if (currentScreen === 'settings') renderSettings();
  if (currentScreen === 'skins') renderShop();
  if (room) renderLobby();
});

net.on('joined', (msg) => {
  youId = msg.youId;
  room = msg.room;
  if (!game) game = createGame();
  game.setRoom(room);
  sfx.join();
  renderLobby();
  showScreen(room.state === 'lobby' ? 'lobby' : 'game');
});

net.on('roster', (msg) => {
  room = msg.room;
  if (game) game.setRoom(room);
  renderLobby();
  // Follow the room between the lobby and the round automatically.
  if (currentScreen === 'lobby' && room.state !== 'lobby') showScreen('game');
  else if (currentScreen === 'game' && room.state === 'lobby') showScreen('lobby');
});

net.on('snap', (msg) => {
  if (!game) return;
  game.onSnapshot(msg);
  if (currentScreen === 'game' && msg.state === 'lobby') showScreen('lobby');
});

// ---------------------------------------------------------------- game UI

function createGame() {
  const g = new Game($('#game-canvas'), {
    onHud: updateHud,
    onCenter: (text) => {
      const el = $('[data-center-message]');
      if (!text) { el.hidden = true; return; }
      el.textContent = text;
      el.hidden = false;
      // Restart the pop animation.
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = '';
    },
    onResults: showResults,
  });
  return g;
}

function updateHud(hud) {
  const timer = $('[data-hud-timer]');
  timer.textContent = hud.state === 'playing' ? hud.timeLabel : formatTime(hud.timer);
  timer.classList.toggle('is-low', hud.state === 'playing' && hud.timer <= 15);

  const itEl = $('[data-hud-it]');
  itEl.textContent = hud.itName;
  itEl.hidden = !hud.itName || hud.state === 'lobby';

  const powerEl = $('[data-hud-power]');
  powerEl.hidden = !hud.power || hud.state !== 'playing';
  if (hud.power) {
    powerEl.style.setProperty('--power-color', POWER_COLORS[hud.power] || '#fff');
    $('[data-hud-power-icon]').textContent = hud.powerIcon;
    $('[data-hud-power-label]').textContent = hud.powerLabel;
    const pct = Math.max(0, Math.min(100, (hud.powerT / C.ORB_POWER_TIME) * 100));
    $('[data-hud-power-fill]').style.width = `${pct}%`;
  }

  const list = $('[data-hud-scores]');
  list.innerHTML = '';
  for (const row of hud.rows) {
    const li = document.createElement('li');
    li.className = `${row.it ? 'is-it ' : ''}${row.isYou ? 'is-you' : ''}`;
    const name = document.createElement('b');
    name.textContent = row.name + (row.isBot ? ' [bot]' : '');
    const score = document.createElement('span');
    score.className = 'sc';
    score.textContent = `${row.itTime.toFixed(1)}s it`;
    li.append(name, score);
    list.append(li);
  }

  const debug = $('[data-hud-debug]');
  debug.hidden = !profile.showFps;
  if (profile.showFps) debug.textContent = `${hud.fps} fps | ${hud.ping} ms`;
}

function showResults(standings, meId) {
  const overlay = $('[data-results-overlay]');
  if (!standings) { overlay.hidden = true; return; }

  const list = $('[data-results-list]');
  list.innerHTML = '';
  for (const row of standings) {
    const li = document.createElement('li');
    li.className = `results-row${row.place === 1 ? ' is-winner' : ''}${row.id === meId ? ' is-you' : ''}`;
    const place = document.createElement('span');
    place.className = 'place';
    place.textContent = row.place;
    const who = document.createElement('span');
    who.className = 'who';
    who.textContent = row.name + (row.isBot ? ' [bot]' : '');
    const score = document.createElement('span');
    score.className = 'score';
    const coinsPart = row.coinsEarned ? ` · +${row.coinsEarned}c` : '';
    score.textContent = `${row.itTime.toFixed(1)}s as it - ${row.tags} tag${row.tags === 1 ? '' : 's'}${coinsPart}`;
    li.append(place, who, score);
    list.append(li);
  }

  const me = standings.find((r) => r.id === meId);
  const sub = $('[data-results-sub]');
  if (me) {
    const coinLine = typeof me.coinsEarned === 'number' ? ` +${me.coinsEarned} coins.` : '';
    sub.textContent = (me.place === 1
      ? `You win! Only ${me.itTime.toFixed(1)}s spent as it.`
      : `You placed ${ordinal(me.place)} of ${standings.length}.`) + coinLine;
    if (typeof me.coinsEarned === 'number') {
      addCoins(me.coinsEarned);
      bumpStat('coinsEarned', me.coinsEarned);
    }
    if (me.place === 1) {
      sfx.win();
      bumpStat('wins');
    } else {
      sfx.lose();
    }
  } else {
    sub.textContent = '';
  }

  $('[data-results-next]').textContent = 'Next round starts automatically.';
  overlay.hidden = false;
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ----------------------------------------------------------- server list

function refreshServers() {
  net.send({ t: 'list' });
}

function renderServerList(rooms) {
  const list = $('[data-server-list]');
  list.innerHTML = '';
  if (!rooms.length) {
    list.innerHTML = '<p class="empty">No public games right now. Host one!</p>';
    return;
  }
  for (const r of rooms) {
    const map = getMap(r.mapId);
    const full = r.humans >= r.maxPlayers;
    const row = document.createElement('div');
    row.className = 'server-row';
    row.dataset.full = full ? '1' : '0';
    row.tabIndex = 0;
    row.setAttribute('role', 'button');

    const left = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'server-name';
    name.textContent = r.name;
    const meta = document.createElement('div');
    meta.className = 'server-meta';
    meta.textContent = `${map.name} - ${stateLabel(r.state)}${r.bots ? ` - ${r.bots} bot${r.bots === 1 ? '' : 's'}` : ''}`;
    left.append(name, meta);

    const badges = document.createElement('div');
    if (r.persistent) {
      const b = document.createElement('span');
      b.className = 'badge badge-official';
      b.textContent = 'Official';
      badges.append(b);
    } else if (r.state === 'playing') {
      const b = document.createElement('span');
      b.className = 'badge badge-live';
      b.textContent = 'Live';
      badges.append(b);
    }

    const count = document.createElement('div');
    count.className = 'server-count';
    count.innerHTML = `${r.players}<small>/${r.maxPlayers}</small>`;

    row.append(left, badges, count);
    const join = () => {
      if (full) { toast('That game is full.'); return; }
      sfx.click();
      net.send({ t: 'join', code: r.code });
    };
    row.addEventListener('click', join);
    row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') join(); });
    list.append(row);
  }
}

function stateLabel(state) {
  return { lobby: 'In lobby', countdown: 'Starting', playing: 'In progress', results: 'Round over' }[state] || state;
}

// ------------------------------------------------------------- map grids

/** Rebuild the host screen's map picker so the selected card stays in sync. */
function refreshHostMapGrid() {
  buildMapGrid($('[data-map-grid]'), selectedHostMap, (mapId) => {
    selectedHostMap = mapId;
    refreshHostMapGrid();
  });
}

function buildMapGrid(container, selectedId, onPick) {
  container.innerHTML = '';
  for (const map of MAPS) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'map-card';
    card.setAttribute('aria-pressed', String(map.id === selectedId));

    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 169;
    canvas.style.aspectRatio = '16 / 9';

    const body = document.createElement('div');
    body.className = 'map-card-body';
    const name = document.createElement('div');
    name.className = 'map-card-name';
    name.textContent = map.name;
    const sub = document.createElement('div');
    sub.className = 'map-card-sub';
    if (map.moon) {
      sub.innerHTML = '<span class="moon-flag">Low gravity</span> - jump higher';
    } else {
      sub.textContent = map.blurb;
    }
    body.append(name, sub);
    card.append(canvas, body);
    card.addEventListener('click', () => { sfx.click(); onPick(map.id); });
    container.append(card);
    // Size is only known once it is in the document.
    requestAnimationFrame(() => drawMapPreview(canvas, map));
  }
}

// ----------------------------------------------------------------- lobby

function renderLobby() {
  if (!room) return;
  const map = getMap(room.mapId);
  const isHost = room.hostId === youId;
  const canModerate = isHost || isAdminSession;

  $('[data-lobby-title]').textContent = room.name;
  $('[data-room-code]').textContent = room.code;
  $('[data-lobby-map-name]').textContent = map.name;
  $('[data-lobby-map-blurb]').textContent = map.moon
    ? `${map.blurb} Gravity is ${Math.round(map.gravityScale * 100)}% of normal.`
    : map.blurb;
  const preview = $('[data-lobby-map]');
  requestAnimationFrame(() => drawMapPreview(preview, map));

  const humans = room.players.filter((p) => !p.isBot).length;
  $('[data-lobby-count]').textContent =
    `Players ${room.players.length}/${room.maxPlayers} (${humans} human${humans === 1 ? '' : 's'})`;

  const list = $('[data-lobby-list]');
  list.innerHTML = '';
  for (const p of room.players) {
    const li = document.createElement('li');
    li.className = `player-row${p.it ? ' is-it' : ''}`;
    const canvas = document.createElement('canvas');
    canvas.width = 52;
    canvas.height = 60;
    const who = document.createElement('span');
    who.className = 'who';
    who.textContent = p.name;
    li.append(canvas, who);
    if (p.id === youId) li.append(tagSpan('tag-you', 'You'));
    if (p.id === room.hostId) li.append(tagSpan('tag-host', 'Host'));
    if (p.isAdmin) li.append(tagSpan('tag-admin', 'Admin'));
    if (p.isBot) li.append(tagSpan('tag-bot', 'Bot'));
    if (canModerate && p.id !== youId) {
      const kick = document.createElement('button');
      kick.type = 'button';
      kick.className = 'btn btn-small btn-kick';
      kick.textContent = 'Kick';
      kick.addEventListener('click', () => {
        sfx.click();
        net.send({ t: 'kick', targetId: p.id });
      });
      li.append(kick);
    }
    list.append(li);
    requestAnimationFrame(() => drawSkinPreview(canvas, p.skin));
  }

  const hostControls = $('[data-host-controls]');
  hostControls.hidden = !isHost || room.persistent;
  if (!hostControls.hidden) {
    buildMapGrid($('[data-lobby-map-grid]'), room.mapId, (mapId) => {
      net.send({ t: 'settings', patch: { mapId } });
    });
  }

  const startBtn = $('[data-action="start-round"]');
  const hint = $('[data-lobby-hint]');
  if (room.persistent) {
    startBtn.hidden = true;
    hint.textContent = 'Official server - the next round starts automatically.';
  } else if (canModerate) {
    startBtn.hidden = false;
    startBtn.disabled = room.players.length < 1;
    hint.textContent = room.players.length < 1
      ? 'Waiting for at least one more player or bot.'
      : isHost ? `Share code ${room.code} so friends can join.` : 'Starting as admin.';
  } else {
    startBtn.hidden = true;
    hint.textContent = 'Waiting for the host to start the round.';
  }
}

/** Clear local room state and head back to the Play menu -- used both when we
 * leave voluntarily and when we're kicked or the room otherwise drops us. */
function leaveRoomLocally() {
  room = null;
  youId = null;
  showResults(null);
  showScreen('play');
}

function tagSpan(cls, text) {
  const s = document.createElement('span');
  s.className = cls;
  s.textContent = text;
  return s;
}

// ----------------------------------------------------------------- skins

function sendProfile() {
  net.send({
    t: 'profile', name: profile.name, skin: profile.skin, trail: profile.trail, password: profile.namePassword,
  });
}

function equipSkin(skinId) {
  profile.skin = skinId;
  save();
  sfx.click();
  sendProfile();
  renderSkins();
  drawProfilePreview();
}

function equipTrail(trailId) {
  profile.trail = trailId;
  save();
  sfx.click();
  sendProfile();
  renderTrails();
  drawProfilePreview();
}

function renderSkins() {
  const grid = $('[data-skin-grid]');
  grid.innerHTML = '';
  let unlockedCount = 0;

  for (const skin of SKINS) {
    // Admins can preview and wear anything, but it's a live bypass, not a
    // purchase -- nothing is added to ownedSkins, so it re-locks the moment
    // admin status drops.
    const owns = isUnlocked(skin, profile.stats, profile.ownedSkins);
    const unlocked = owns || isAdminSession;
    if (unlocked) unlockedCount++;

    const card = document.createElement('button');
    card.type = 'button';
    card.className = `skin-card${unlocked ? '' : ' is-locked'}`;
    card.setAttribute('aria-pressed', String(profile.skin === skin.id));

    const canvas = document.createElement('canvas');
    canvas.width = 124;
    canvas.height = 148;
    const name = document.createElement('div');
    name.className = 'skin-name';
    name.textContent = skin.name;
    const note = document.createElement('div');
    note.className = 'skin-note';

    const isCoinSkin = skin.unlock?.type === 'coins';
    let action = null; // what a click on this card should do

    if (unlocked) {
      if (!owns && isAdminSession) note.textContent = profile.skin === skin.id ? 'Equipped (admin)' : 'Admin preview';
      else note.textContent = profile.skin === skin.id ? 'Equipped' : 'Tap to equip';
      action = () => equipSkin(skin.id);
    } else if (isCoinSkin) {
      const afford = (profile.coins || 0) >= skin.unlock.price;
      note.textContent = `${skin.unlock.price} coins${afford ? ' — tap to buy' : ''}`;
      card.classList.toggle('is-affordable', afford);
      if (afford) {
        action = () => {
          if (buySkin(skin.id, skin.unlock.price)) equipSkin(skin.id);
        };
      }
    } else {
      const have = profile.stats[skin.unlock.stat] || 0;
      note.textContent = `${skin.unlock.label} (${Math.min(have, skin.unlock.value)}/${skin.unlock.value})`;
    }

    card.disabled = !action;
    card.append(canvas, name, note);
    if (action) card.addEventListener('click', action);
    grid.append(card);
    requestAnimationFrame(() => drawSkinPreview(canvas, skin.id));
  }

  const coinNote = ` · ${profile.coins || 0} coins`;
  $('[data-skin-progress]').textContent = isAdminSession
    ? `${unlockedCount} of ${SKINS.length} unlocked (admin: everything unlocked for preview)${coinNote}`
    : `${unlockedCount} of ${SKINS.length} unlocked. Play to earn coins and stats for the rest.${coinNote}`;
}

/** Refresh every tab of the Skins screen -- used whenever something that can
 * change more than one tab's unlock state happens (admin toggle, a progress
 * reset), so a tab you're not currently looking at isn't left stale. */
function renderShop() {
  renderSkins();
  renderTrails();
  renderQuests();
}

function setShopTab(tab) {
  for (const btn of $$('[data-shop-tab]')) btn.classList.toggle('is-active', btn.dataset.shopTab === tab);
  $('[data-skin-progress]').hidden = tab !== 'skins';
  $('[data-skin-grid]').hidden = tab !== 'skins';
  $('[data-trail-progress]').hidden = tab !== 'trails';
  $('[data-trail-grid]').hidden = tab !== 'trails';
  $('[data-quest-progress]').hidden = tab !== 'quests';
  $('[data-quest-list]').hidden = tab !== 'quests';
}

function renderTrails() {
  const grid = $('[data-trail-grid]');
  grid.innerHTML = '';
  let unlockedCount = 0;

  for (const trail of TRAILS) {
    // Same admin-preview rule as skins: unlocked to wear/see, not owned.
    const owns = isTrailUnlocked(trail, profile.stats, profile.ownedTrails);
    const unlocked = owns || isAdminSession;
    if (unlocked) unlockedCount++;

    const card = document.createElement('button');
    card.type = 'button';
    card.className = `skin-card trail-card${unlocked ? '' : ' is-locked'}`;
    card.setAttribute('aria-pressed', String(profile.trail === trail.id));

    const swatch = document.createElement('div');
    swatch.className = 'trail-swatch-row';
    if (trail.colors.length) {
      for (const c of trail.colors) {
        const dot = document.createElement('span');
        dot.className = 'trail-dot';
        dot.style.background = c;
        swatch.append(dot);
      }
    } else {
      swatch.append(Object.assign(document.createElement('span'), { className: 'trail-dot trail-dot-none' }));
    }

    const name = document.createElement('div');
    name.className = 'skin-name';
    name.textContent = trail.name;
    const note = document.createElement('div');
    note.className = 'skin-note';

    const isCoinTrail = trail.unlock?.type === 'coins';
    let action = null;

    if (unlocked) {
      if (!owns && isAdminSession) note.textContent = profile.trail === trail.id ? 'Equipped (admin)' : 'Admin preview';
      else note.textContent = profile.trail === trail.id ? 'Equipped' : 'Tap to equip';
      action = () => equipTrail(trail.id);
    } else if (isCoinTrail) {
      const afford = (profile.coins || 0) >= trail.unlock.price;
      note.textContent = `${trail.unlock.price} coins${afford ? ' — tap to buy' : ''}`;
      card.classList.toggle('is-affordable', afford);
      if (afford) {
        action = () => {
          if (buyTrail(trail.id, trail.unlock.price)) equipTrail(trail.id);
        };
      }
    } else {
      const have = profile.stats[trail.unlock.stat] || 0;
      note.textContent = `${trail.unlock.label} (${Math.min(have, trail.unlock.value)}/${trail.unlock.value})`;
    }

    card.disabled = !action;
    card.append(swatch, name, note);
    if (action) card.addEventListener('click', action);
    grid.append(card);
  }

  const coinNote = ` · ${profile.coins || 0} coins`;
  $('[data-trail-progress]').textContent = isAdminSession
    ? `${unlockedCount} of ${TRAILS.length} unlocked (admin: everything unlocked for preview)${coinNote}`
    : `${unlockedCount} of ${TRAILS.length} unlocked. Play to earn coins and stats for the rest.${coinNote}`;
}

function questProgress(quest) {
  if (quest.stat === 'mapsPlayed') return (profile.mapsPlayed || []).length;
  return profile.stats[quest.stat] || 0;
}

function renderQuests() {
  const list = $('[data-quest-list]');
  list.innerHTML = '';
  let claimedCount = 0;

  for (const quest of QUESTS) {
    const have = questProgress(quest);
    const done = have >= quest.goal;
    const claimed = profile.claimedQuests.includes(quest.id);
    if (claimed) claimedCount++;

    const row = document.createElement('div');
    row.className = `quest-row${claimed ? ' is-claimed' : done ? ' is-ready' : ''}`;

    const info = document.createElement('div');
    info.className = 'quest-info';
    const name = document.createElement('div');
    name.className = 'quest-name';
    name.textContent = quest.name;
    const desc = document.createElement('div');
    desc.className = 'quest-desc';
    desc.textContent = `${quest.label} (${Math.min(have, quest.goal)}/${quest.goal})`;
    info.append(name, desc);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-small';
    if (claimed) {
      btn.textContent = 'Claimed';
      btn.disabled = true;
    } else if (done) {
      btn.textContent = `Claim +${quest.reward}`;
      btn.classList.add('btn-primary');
      btn.addEventListener('click', () => {
        if (claimQuest(quest.id, quest.reward)) {
          sfx.win();
          renderQuests();
          drawProfilePreview();
        }
      });
    } else {
      btn.textContent = `+${quest.reward} coins`;
      btn.disabled = true;
    }

    row.append(info, btn);
    list.append(row);
  }

  $('[data-quest-progress]').textContent =
    `${claimedCount} of ${QUESTS.length} quests claimed · ${profile.coins || 0} coins`;
}

function drawProfilePreview() {
  const canvas = $('[data-profile-preview]');
  $('[data-profile-name]').textContent = profile.name;
  $('[data-profile-coins]').textContent = `${profile.coins || 0} coin${profile.coins === 1 ? '' : 's'}`;
  requestAnimationFrame(() => drawSkinPreview(canvas, profile.skin));
}

// -------------------------------------------------------------- settings

function renderThemePicker() {
  for (const btn of $$('[data-theme-option]')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.themeOption === profile.theme));
  }
}

const THEMES = ['classic', 'blossom', 'pink', 'blue'];

function applyTheme(theme) {
  profile.theme = THEMES.includes(theme) ? theme : 'classic';
  save();
  if (profile.theme === 'classic') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', profile.theme);
  renderThemePicker();
}

function renderSettings() {
  $('[data-setting-name]').value = profile.name;
  $('[data-setting-namepass]').value = profile.namePassword;
  renderThemePicker();
  $('[data-setting-volume]').value = Math.round(profile.volume * 100);
  $('[data-volume-value]').textContent = `${Math.round(profile.volume * 100)}%`;
  $('[data-setting-music-volume]').value = Math.round(profile.musicVolume * 100);
  $('[data-music-volume-value]').textContent = `${Math.round(profile.musicVolume * 100)}%`;
  $('[data-setting-music-track]').value = profile.musicTrack;
  $('[data-setting-names]').checked = profile.showNames;
  $('[data-setting-particles]').checked = profile.particles;
  $('[data-setting-shake]').checked = profile.shake;
  $('[data-setting-fps]').checked = profile.showFps;
  renderKeybinds();
  renderStats();

  const status = $('[data-admin-status]');
  status.textContent = isAdminSession
    ? 'Admin access active for this session.'
    : 'Not an admin. Only works if the server owner set a private password.';
  status.classList.toggle('is-on', isAdminSession);
  $('[data-action="admin-grant-coins"]').hidden = !isAdminSession;
  $('[data-admin-form]').hidden = isAdminSession;
}

const KEY_LABELS = { left: 'Move left', right: 'Move right', jump: 'Jump', down: 'Drop down', shoot: 'Shoot (gun maps)' };

function renderKeybinds() {
  const wrap = $('[data-keybinds]');
  wrap.innerHTML = '';
  for (const action of Object.keys(DEFAULT_KEYS)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'keybind';
    const name = document.createElement('span');
    name.className = 'k-name';
    name.textContent = KEY_LABELS[action];
    const key = document.createElement('span');
    key.className = 'k-key';
    key.textContent = keyLabel(profile.keys[action]);
    btn.append(name, key);

    btn.addEventListener('click', () => {
      btn.classList.add('is-listening');
      key.textContent = 'Press...';
      input.setCapturing(true);

      const onKey = (e) => {
        e.preventDefault();
        window.removeEventListener('keydown', onKey, true);
        input.setCapturing(false);
        if (e.code !== 'Escape') {
          profile.keys[action] = e.code;
          save();
        }
        renderKeybinds();
      };
      window.addEventListener('keydown', onKey, true);
    });
    wrap.append(btn);
  }
}

function renderStats() {
  const grid = $('[data-stats-grid]');
  const stats = [
    ['Coins', profile.coins || 0],
    ['Tags made', profile.stats.tags],
    ['Rounds played', profile.stats.games],
    ['Rounds won', profile.stats.wins],
    ['Moon rounds', profile.stats.moonRounds],
    ['Shots landed', profile.stats.shotHits],
    ['Maps played', profile.mapsPlayed.length],
  ];
  grid.innerHTML = '';
  for (const [label, value] of stats) {
    const el = document.createElement('div');
    el.className = 'stat';
    el.innerHTML = `<b>${value}</b><span>${label}</span>`;
    grid.append(el);
  }
}

// ---------------------------------------------------------------- wiring

function wire() {
  // Simple navigation buttons.
  for (const el of $$('[data-go]')) {
    el.addEventListener('click', () => {
      unlockAudio();
      sfx.click();
      showScreen(el.dataset.go);
    });
  }

  // Skins screen tabs: Skins / Trails / Quests.
  for (const btn of $$('[data-shop-tab]')) {
    btn.addEventListener('click', () => { sfx.click(); setShopTab(btn.dataset.shopTab); });
  }

  $('[data-action="refresh-servers"]').addEventListener('click', () => { sfx.click(); refreshServers(); });
  $('[data-action="quick-join"]').addEventListener('click', () => { sfx.click(); net.send({ t: 'quick' }); });

  // Join by code.
  const codeInput = $('[data-code-input]');
  codeInput.addEventListener('input', () => {
    codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, C.CODE_LENGTH);
  });
  $('[data-code-form]').addEventListener('submit', (e) => {
    e.preventDefault();
    const code = codeInput.value.trim();
    if (code.length < C.CODE_LENGTH) {
      $('[data-code-error]').textContent = `Room codes are ${C.CODE_LENGTH} characters.`;
      return;
    }
    $('[data-code-error]').textContent = '';
    net.send({ t: 'join', code });
  });

  // Host options.
  const timeSel = $('[data-host-time]');
  for (const t of C.ROUND_TIME_OPTIONS) {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t < 60 ? `${t} seconds` : `${formatTime(t)} minutes`;
    if (t === C.ROUND_TIME_DEFAULT) opt.selected = true;
    timeSel.append(opt);
  }
  const maxSel = $('[data-host-max]');
  for (let n = 1; n <= C.MAX_PLAYERS; n++) {
    const opt = document.createElement('option');
    opt.value = n;
    opt.textContent = n === 1 ? '1 player (solo)' : `${n} players`;
    if (n === C.MAX_PLAYERS) opt.selected = true;
    maxSel.append(opt);
  }
  $('[data-host-name]').value = `${profile.name}'s game`.slice(0, 14);

  const musicSel = $('[data-setting-music-track]');
  for (const t of music.MUSIC_TRACKS) {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name;
    musicSel.append(opt);
  }
  refreshHostMapGrid();

  $('[data-action="create-game"]').addEventListener('click', () => {
    sfx.click();
    net.send({
      t: 'host',
      options: {
        name: $('[data-host-name]').value || `${profile.name}'s game`,
        mapId: selectedHostMap,
        roundTime: Number(timeSel.value),
        maxPlayers: Number(maxSel.value),
        botFill: $('[data-host-botfill]').value === '1',
        botDifficulty: $('[data-host-botskill]').value,
        isPublic: $('[data-host-public]').value === '1',
      },
    });
  });

  // Lobby actions.
  $('[data-action="copy-code"]').addEventListener('click', async () => {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.code);
      toast(`Copied ${room.code}`);
    } catch {
      toast(`Room code: ${room.code}`);
    }
  });

  $('[data-action="start-round"]').addEventListener('click', () => {
    sfx.click();
    net.send({ t: 'start' });
  });

  for (const el of $$('[data-action="leave-room"]')) {
    el.addEventListener('click', () => {
      sfx.click();
      net.send({ t: 'leave' });
      leaveRoomLocally();
    });
  }

  // Settings.
  $('[data-setting-name]').addEventListener('input', (e) => {
    profile.name = e.target.value.slice(0, C.MAX_NAME_LENGTH);
    save();
    sendProfile();
  });
  $('[data-setting-namepass]').addEventListener('change', (e) => {
    profile.namePassword = e.target.value.slice(0, 64);
    save();
    sendProfile();
  });
  for (const btn of $$('[data-theme-option]')) {
    btn.addEventListener('click', () => {
      sfx.click();
      applyTheme(btn.dataset.themeOption);
    });
  }

  $('[data-admin-form]').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('[data-admin-password]');
    adminPasswordCache = input.value;
    input.value = '';
    net.send({ t: 'admin', password: adminPasswordCache });
  });
  $('[data-action="admin-grant-coins"]').addEventListener('click', () => {
    if (!isAdminSession) return;
    addCoins(1000);
    renderSettings();
    toast('+1000 coins');
  });
  $('[data-setting-volume]').addEventListener('input', (e) => {
    profile.volume = Number(e.target.value) / 100;
    setVolume(profile.volume);
    $('[data-volume-value]').textContent = `${e.target.value}%`;
    save();
  });
  $('[data-setting-music-volume]').addEventListener('input', (e) => {
    profile.musicVolume = Number(e.target.value) / 100;
    music.setVolume(profile.musicVolume);
    $('[data-music-volume-value]').textContent = `${e.target.value}%`;
    save();
  });
  $('[data-setting-music-track]').addEventListener('change', (e) => {
    profile.musicTrack = e.target.value;
    save();
    // Switch immediately if music is already playing; if it hasn't started
    // yet (no gesture unlocked audio), the choice just takes effect once it does.
    if (music.currentTrack()) music.play(profile.musicTrack);
  });
  const toggles = [
    ['[data-setting-names]', 'showNames'],
    ['[data-setting-particles]', 'particles'],
    ['[data-setting-shake]', 'shake'],
    ['[data-setting-fps]', 'showFps'],
  ];
  for (const [sel, key] of toggles) {
    $(sel).addEventListener('change', (e) => {
      profile[key] = e.target.checked;
      save();
    });
  }
  $('[data-action="reset-keys"]').addEventListener('click', () => { resetKeys(); renderKeybinds(); });
  $('[data-action="reset-stats"]').addEventListener('click', () => {
    resetStats();
    renderStats();
    renderShop();
    toast('Progress reset.');
  });

  // Unlock audio (sfx + background music) on the first interaction anywhere
  // -- browsers refuse to make sound before one, so this is the earliest
  // either can actually start.
  function unlockAll() {
    unlockAudio();
    music.play(profile.musicTrack);
  }
  window.addEventListener('pointerdown', unlockAll, { once: true });
  window.addEventListener('keydown', unlockAll, { once: true });

  input.init({
    onEscape: () => {
      if (currentScreen === 'game') return; // quitting is an explicit button
      if (currentScreen !== 'home') showScreen(currentScreen === 'play' ? 'home' : 'play');
    },
  });
}

wire();
drawProfilePreview();
setVolume(profile.volume);
music.setVolume(profile.musicVolume);
net.connect();

// Home is already the active screen in the markup before any showScreen()
// call happens, so it needs its own kick-off here too.
homeDemo.start($('[data-home-demo-canvas]'));
$('[data-home-demo]').classList.add('is-swiping');

// Cache the shell so it loads instantly on a repeat visit or a shaky
// connection. Purely an optimization -- actual play still needs the live
// websocket, so a failure here is harmless and silently ignored.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// Debug handle: handy from the browser console while tweaking the game.
window.__tag = {
  get game() { return game; },
  get room() { return room; },
  get youId() { return youId; },
  net,
  profile,
};
