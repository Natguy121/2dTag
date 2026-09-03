// Screen routing and all DOM wiring: home, play, host, server browser, join
// code, lobby, skins, settings and the in-game HUD.

import * as C from '/shared/constants.js';
import { MAPS, getMap } from '/shared/maps.js';
import { SKINS, getSkin, isUnlocked } from '/shared/skins.js';
import * as net from './net.js';
import * as input from './input.js';
import { profile, save, resetStats, resetKeys, keyLabel, bumpStat, DEFAULT_KEYS } from './storage.js';
import { sfx, unlock as unlockAudio, setVolume } from './audio.js';
import { drawMapPreview, drawSkinPreview, formatTime } from './render.js';
import { Game } from './game.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const screens = new Map($$('[data-screen]').map((el) => [el.dataset.screen, el]));
let currentScreen = 'home';
let room = null;      // last roster payload
let youId = null;
let selectedHostMap = 'arena';
let game = null;
let toastTimer = null;

// --------------------------------------------------------------- screens

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
  } else if (game) {
    game.stop();
  }

  if (name === 'join-server') refreshServers();
  if (name === 'skins') renderSkins();
  if (name === 'settings') renderSettings();
  if (name === 'home') drawProfilePreview();
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
  net.send({ t: 'hello', name: profile.name, skin: profile.skin });
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
    score.textContent = `${row.itTime.toFixed(1)}s as it - ${row.tags} tag${row.tags === 1 ? '' : 's'}`;
    li.append(place, who, score);
    list.append(li);
  }

  const me = standings.find((r) => r.id === meId);
  const sub = $('[data-results-sub]');
  if (me) {
    sub.textContent = me.place === 1
      ? `You win! Only ${me.itTime.toFixed(1)}s spent as it.`
      : `You placed ${ordinal(me.place)} of ${standings.length}.`;
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
    if (p.isBot) li.append(tagSpan('tag-bot', 'Bot'));
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
  } else if (isHost) {
    startBtn.hidden = false;
    startBtn.disabled = room.players.length < 2;
    hint.textContent = room.players.length < 2
      ? 'Waiting for at least one more player or bot.'
      : `Share code ${room.code} so friends can join.`;
  } else {
    startBtn.hidden = true;
    hint.textContent = 'Waiting for the host to start the round.';
  }
}

function tagSpan(cls, text) {
  const s = document.createElement('span');
  s.className = cls;
  s.textContent = text;
  return s;
}

// ----------------------------------------------------------------- skins

function renderSkins() {
  const grid = $('[data-skin-grid]');
  grid.innerHTML = '';
  let unlockedCount = 0;

  for (const skin of SKINS) {
    const unlocked = isUnlocked(skin, profile.stats);
    if (unlocked) unlockedCount++;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `skin-card${unlocked ? '' : ' is-locked'}`;
    card.setAttribute('aria-pressed', String(profile.skin === skin.id));
    card.disabled = !unlocked;

    const canvas = document.createElement('canvas');
    canvas.width = 124;
    canvas.height = 148;
    const name = document.createElement('div');
    name.className = 'skin-name';
    name.textContent = skin.name;
    const note = document.createElement('div');
    note.className = 'skin-note';
    if (unlocked) {
      note.textContent = profile.skin === skin.id ? 'Equipped' : 'Tap to equip';
    } else {
      const have = profile.stats[skin.unlock.stat] || 0;
      note.textContent = `${skin.unlock.label} (${Math.min(have, skin.unlock.value)}/${skin.unlock.value})`;
    }
    card.append(canvas, name, note);
    card.addEventListener('click', () => {
      if (!unlocked) return;
      profile.skin = skin.id;
      save();
      sfx.click();
      net.send({ t: 'profile', name: profile.name, skin: profile.skin });
      renderSkins();
    });
    grid.append(card);
    requestAnimationFrame(() => drawSkinPreview(canvas, skin.id));
  }

  $('[data-skin-progress]').textContent =
    `${unlockedCount} of ${SKINS.length} unlocked. Locked skins unlock as you play.`;
}

function drawProfilePreview() {
  const canvas = $('[data-profile-preview]');
  $('[data-profile-name]').textContent = profile.name;
  requestAnimationFrame(() => drawSkinPreview(canvas, profile.skin));
}

// -------------------------------------------------------------- settings

function renderSettings() {
  $('[data-setting-name]').value = profile.name;
  $('[data-setting-volume]').value = Math.round(profile.volume * 100);
  $('[data-volume-value]').textContent = `${Math.round(profile.volume * 100)}%`;
  $('[data-setting-names]').checked = profile.showNames;
  $('[data-setting-particles]').checked = profile.particles;
  $('[data-setting-shake]').checked = profile.shake;
  $('[data-setting-fps]').checked = profile.showFps;
  renderKeybinds();
  renderStats();
}

const KEY_LABELS = { left: 'Move left', right: 'Move right', jump: 'Jump', down: 'Drop down' };

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
    ['Tags made', profile.stats.tags],
    ['Rounds played', profile.stats.games],
    ['Rounds won', profile.stats.wins],
    ['Moon rounds', profile.stats.moonRounds],
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
  for (let n = 2; n <= C.MAX_PLAYERS; n++) {
    const opt = document.createElement('option');
    opt.value = n;
    opt.textContent = `${n} players`;
    if (n === C.MAX_PLAYERS) opt.selected = true;
    maxSel.append(opt);
  }
  $('[data-host-name]').value = `${profile.name}'s game`.slice(0, 14);
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
      room = null;
      youId = null;
      showResults(null);
      showScreen('play');
    });
  }

  // Settings.
  $('[data-setting-name]').addEventListener('input', (e) => {
    profile.name = e.target.value.slice(0, C.MAX_NAME_LENGTH);
    save();
    net.send({ t: 'profile', name: profile.name, skin: profile.skin });
  });
  $('[data-setting-volume]').addEventListener('input', (e) => {
    profile.volume = Number(e.target.value) / 100;
    setVolume(profile.volume);
    $('[data-volume-value]').textContent = `${e.target.value}%`;
    save();
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
    renderSkins();
    toast('Progress reset.');
  });

  // Unlock audio on the first interaction anywhere.
  window.addEventListener('pointerdown', unlockAudio, { once: true });
  window.addEventListener('keydown', unlockAudio, { once: true });

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
net.connect();

// Debug handle: handy from the browser console while tweaking the game.
window.__tag = {
  get game() { return game; },
  get room() { return room; },
  get youId() { return youId; },
  net,
  profile,
};
