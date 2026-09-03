// 2D Tag server: static file hosting + the websocket game protocol.
//
// One 60 Hz loop drives every room; snapshots go out at SNAPSHOT_RATE. The
// server owns all game state -- clients only ever send inputs.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

import * as C from '../shared/constants.js';
import { MAPS } from '../shared/maps.js';
import { INPUT_MASK } from '../shared/physics.js';
import { Room, sanitizeName, sanitizeSkin } from './room.js';
import { claimName, checkAdminPassword, adminLoginEnabled } from './accounts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// ---------------------------------------------------------------- static

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

// Only these directories are reachable over HTTP.
const SERVE_DIRS = ['public', 'shared'];

function resolveStatic(urlPath) {
  let rel;
  try {
    rel = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return null;
  }
  if (rel === '/' || rel === '') rel = '/index.html';

  // /shared/* maps to the shared module folder, everything else to public/.
  const first = rel.split('/')[1];
  const base = SERVE_DIRS.includes(first) && first !== 'public'
    ? path.join(ROOT, first)
    : path.join(ROOT, 'public');
  const stripped = first === 'shared' ? rel.slice(first.length + 1) : rel;

  const full = path.join(base, stripped);
  // Reject anything that escapes the served directory.
  if (!full.startsWith(base + path.sep) && full !== base) return null;
  return full;
}

const httpServer = http.createServer((req, res) => {
  if (req.url === '/api/health') {
    return sendJson(res, 200, { ok: true, rooms: rooms.size, uptime: process.uptime() });
  }
  if (req.url === '/api/rooms') {
    return sendJson(res, 200, { rooms: publicListings() });
  }

  const file = resolveStatic(req.url || '/');
  if (!file) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(payload);
}

// ----------------------------------------------------------------- rooms

/** @type {Map<string, Room>} */
const rooms = new Map();

function makeCode() {
  for (let attempt = 0; attempt < 200; attempt++) {
    let code = '';
    for (let i = 0; i < C.CODE_LENGTH; i++) {
      code += C.CODE_ALPHABET[Math.floor(Math.random() * C.CODE_ALPHABET.length)];
    }
    if (!rooms.has(code)) return code;
  }
  // Extremely unlikely; fall back to a longer code.
  return `${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

function createRoom(opts) {
  const code = makeCode();
  const room = new Room({ ...opts, code });
  room.onEmpty = (r) => {
    if (r.persistent) return;
    rooms.delete(r.code);
  };
  rooms.set(code, room);
  return room;
}

function publicListings() {
  return [...rooms.values()]
    .filter((r) => r.isPublic)
    .map((r) => r.listing())
    .sort((a, b) => (b.persistent - a.persistent) || (b.humans - a.humans) || a.name.localeCompare(b.name));
}

// Always-on public rooms so the server browser is never empty and a lone
// player always lands in a game that already has bots running around.
const PERSISTENT_ROOMS = [
  { name: 'Neon Arena', mapId: 'arena', minPlayers: 5, rotateMaps: false },
  { name: 'Moon Base 24/7', mapId: 'moon', minPlayers: 5, rotateMaps: false },
  { name: 'Map Rotation', mapId: 'towers', minPlayers: 4, rotateMaps: true },
];

for (const cfg of PERSISTENT_ROOMS) {
  createRoom({ ...cfg, persistent: true, isPublic: true, botFill: true });
}

// --------------------------------------------------------------- protocol

const wss = new WebSocketServer({ server: httpServer, maxPayload: 16 * 1024 });

/** Per-connection session state. */
const sessions = new WeakMap();

function send(ws, obj) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify(obj));
}

function fail(ws, message) {
  send(ws, { t: 'error', message });
}

function leaveRoom(ws) {
  const s = sessions.get(ws);
  if (!s || !s.room) return;
  const room = s.room;
  if (s.playerId) room.removePlayer(s.playerId);
  s.room = null;
  s.playerId = null;
  broadcastRoster(room);
}

function broadcastRoster(room) {
  const payload = { t: 'roster', room: room.rosterPayload() };
  for (const p of room.players.values()) {
    if (p.conn) send(p.conn, payload);
  }
  room.rosterDirty = false;
}

function joinRoom(ws, room) {
  const s = sessions.get(ws);
  if (!s) return;
  if (s.room) leaveRoom(ws);

  const player = room.addHuman(ws, s.name, s.skin);
  if (!player) {
    fail(ws, 'That game is full.');
    return;
  }
  player.isAdmin = s.isAdmin;
  s.room = room;
  s.playerId = player.id;
  send(ws, {
    t: 'joined',
    code: room.code,
    youId: player.id,
    room: room.rosterPayload(),
  });
  broadcastRoster(room);
}

wss.on('connection', (ws, req) => {
  sessions.set(ws, {
    name: 'Player',
    skin: 'runner',
    room: null,
    playerId: null,
    lastInput: 0,
    inputCount: 0,
    windowStart: Date.now(),
    ip: req.socket.remoteAddress,
    isAdmin: false,
  });
  ws.isAlive = true;
  send(ws, { t: 'welcome', version: C.PROTOCOL_VERSION, maxPlayers: C.MAX_PLAYERS });

  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    const s = sessions.get(ws);
    if (!s) return;

    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (!msg || typeof msg.t !== 'string') return;

    // Cheap flood guard: at most ~240 messages per second per connection.
    const now = Date.now();
    if (now - s.windowStart > 1000) { s.windowStart = now; s.inputCount = 0; }
    if (++s.inputCount > 240) return;

    switch (msg.t) {
      case 'hello':
      case 'profile': {
        const wanted = sanitizeName(msg.name, s.name);
        const password = typeof msg.password === 'string' ? msg.password.slice(0, 64) : '';
        const claim = claimName(wanted, password);
        if (claim.ok) {
          s.name = wanted;
        } else {
          // Name is password-protected and the password didn't match -- give
          // them a free variant instead of silently failing to connect. Tell
          // the client what actually happened so its UI doesn't keep showing
          // the name it asked for as if it had been granted.
          s.name = `${wanted}${Math.floor(10 + Math.random() * 89)}`;
          send(ws, { t: 'renamed', name: s.name, reason: `"${wanted}" needs a password to use -- you're "${s.name}" instead.` });
        }
        s.skin = sanitizeSkin(msg.skin);
        const player = s.room?.players.get(s.playerId);
        if (player) {
          player.name = s.name;
          player.skin = s.skin;
          s.room.rosterDirty = true;
        }
        break;
      }

      case 'admin': {
        const ok = checkAdminPassword(typeof msg.password === 'string' ? msg.password : '');
        s.isAdmin = ok;
        const player = s.room?.players.get(s.playerId);
        if (player) {
          player.isAdmin = ok;
          s.room.rosterDirty = true;
        }
        // Distinguish "not configured at all" from "wrong password" -- the
        // fix for each is completely different, so don't make someone guess.
        const reason = ok ? null : (adminLoginEnabled() ? 'wrong' : 'unset');
        send(ws, { t: 'adminResult', ok, reason });
        break;
      }

      case 'kick': {
        const room = s.room;
        const me = room?.players.get(s.playerId);
        if (!room || !me) break;
        if (!me.isAdmin && room.hostId !== s.playerId) { fail(ws, 'Only the host or an admin can remove players.'); break; }
        const target = room.players.get(String(msg.targetId));
        if (!target || target.id === s.playerId) break;
        const targetWs = target.conn;
        room.removePlayer(target.id);
        broadcastRoster(room);
        if (targetWs) {
          const ts = sessions.get(targetWs);
          if (ts) { ts.room = null; ts.playerId = null; }
          send(targetWs, { t: 'kicked', message: 'You were removed from the game.' });
        }
        break;
      }

      case 'list':
        send(ws, { t: 'rooms', rooms: publicListings() });
        break;

      case 'host': {
        const o = msg.options || {};
        const room = createRoom({
          name: sanitizeName(o.name, `${s.name}'s game`),
          mapId: MAPS.some((m) => m.id === o.mapId) ? o.mapId : 'arena',
          isPublic: o.isPublic !== false,
          maxPlayers: Number(o.maxPlayers) || C.MAX_PLAYERS,
          roundTime: C.ROUND_TIME_OPTIONS.includes(Number(o.roundTime))
            ? Number(o.roundTime)
            : C.ROUND_TIME_DEFAULT,
          botFill: o.botFill !== false,
          minPlayers: Number(o.minPlayers) || C.MIN_ACTIVE_PLAYERS,
          botDifficulty: ['easy', 'normal', 'hard'].includes(o.botDifficulty) ? o.botDifficulty : 'normal',
        });
        joinRoom(ws, room);
        break;
      }

      case 'join': {
        const code = String(msg.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
        const room = rooms.get(code);
        if (!room) { fail(ws, `No game found with code ${code || '----'}.`); break; }
        if (room.isFull()) { fail(ws, 'That game is full.'); break; }
        joinRoom(ws, room);
        break;
      }

      case 'quick': {
        // Prefer a public room with room to spare and the most humans in it.
        const open = [...rooms.values()]
          .filter((r) => r.isPublic && !r.isFull())
          .sort((a, b) => b.humanCount() - a.humanCount());
        const room = open[0] || createRoom({
          name: `${s.name}'s game`,
          mapId: 'arena',
          isPublic: true,
          persistent: false,
        });
        joinRoom(ws, room);
        break;
      }

      case 'leave':
        leaveRoom(ws);
        break;

      case 'input': {
        const player = s.room?.players.get(s.playerId);
        if (!player) break;
        const seq = Number(msg.seq) || 0;
        if (seq < player.lastSeq) break; // stale/out of order
        player.lastSeq = seq;
        player.inputBits = Number(msg.bits) & INPUT_MASK;
        break;
      }

      case 'settings': {
        const room = s.room;
        if (!room) break;
        if (room.persistent) { fail(ws, 'This is an official server; its settings are fixed.'); break; }
        if (room.hostId !== s.playerId) { fail(ws, 'Only the host can change settings.'); break; }
        room.setSettings(msg.patch || {});
        broadcastRoster(room);
        break;
      }

      case 'start': {
        const room = s.room;
        if (!room) break;
        const me = room.players.get(s.playerId);
        if (room.hostId !== s.playerId && !me?.isAdmin && !room.persistent) {
          fail(ws, 'Only the host can start the round.');
          break;
        }
        if (room.state === 'lobby') room.startCountdown();
        break;
      }

      case 'ping':
        send(ws, { t: 'pong', ts: msg.ts });
        break;

      default:
        break;
    }
  });

  ws.on('close', () => {
    leaveRoom(ws);
    sessions.delete(ws);
  });

  ws.on('error', () => {
    leaveRoom(ws);
  });
});

// Drop connections that stop responding to pings.
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { ws.terminate(); continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch { /* ignore */ }
  }
}, 30000);

// ------------------------------------------------------------- game loop

let last = process.hrtime.bigint();
let accumulator = 0;
let snapAccum = 0;
const SNAP_INTERVAL = 1 / C.SNAPSHOT_RATE;

function loop() {
  const now = process.hrtime.bigint();
  let dt = Number(now - last) / 1e9;
  last = now;
  // Guard against huge catch-up steps after the event loop stalls.
  if (dt > 0.25) dt = 0.25;

  // Fixed timestep so the simulation matches the client's prediction exactly.
  accumulator += dt;
  let steps = 0;
  while (accumulator >= C.DT && steps < 8) {
    for (const room of rooms.values()) room.step(C.DT);
    accumulator -= C.DT;
    steps++;
  }
  if (steps === 8) accumulator = 0; // we fell too far behind; drop the backlog

  snapAccum += dt;
  if (snapAccum >= SNAP_INTERVAL) {
    snapAccum = 0;
    broadcastAll();
  }

  cleanupRooms();
}

function broadcastAll() {
  for (const room of rooms.values()) {
    if (room.rosterDirty) broadcastRoster(room);

    const hasHumans = room.humanCount() > 0;
    if (!hasHumans) { room.events.length = 0; continue; }

    const snap = room.snapshot();
    const standings = room.state === 'results' ? room.standings : null;

    for (const p of room.players.values()) {
      if (!p.conn) continue;
      send(p.conn, { ...snap, ack: p.lastSeq, you: p.id, standings });
    }
    room.events.length = 0;
  }
}

function cleanupRooms() {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.persistent) continue;
    if (room.humanCount() > 0) { room.emptySince = now; continue; }
    if (now - room.emptySince > C.IDLE_ROOM_TIMEOUT) rooms.delete(room.code);
  }
}

const loopTimer = setInterval(loop, 1000 / C.TICK_RATE);

httpServer.listen(PORT, HOST, () => {
  console.log(`2D Tag server listening on http://localhost:${PORT}`);
  console.log(`  ${MAPS.length} maps | up to ${C.MAX_PLAYERS} players per game`);
  for (const room of rooms.values()) {
    console.log(`  public room "${room.name}" [${room.code}] on ${room.map.name}`);
  }
});

function shutdown() {
  clearInterval(loopTimer);
  clearInterval(heartbeat);
  for (const ws of wss.clients) ws.close(1001, 'server shutting down');
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
