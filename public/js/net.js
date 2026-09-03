// WebSocket client: a thin event emitter over the JSON protocol, with
// automatic reconnection and a rolling ping estimate.

const listeners = new Map();
let ws = null;
let reconnectDelay = 500;
let reconnectTimer = null;
let wantOpen = false;
let pingTimer = null;

export const state = {
  connected: false,
  ping: 0,
};

export function on(type, fn) {
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type).add(fn);
  return () => listeners.get(type).delete(fn);
}

function emit(type, payload) {
  const set = listeners.get(type);
  if (set) for (const fn of set) fn(payload);
}

function url() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}`;
}

export function connect() {
  wantOpen = true;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  try {
    ws = new WebSocket(url());
  } catch {
    scheduleReconnect();
    return;
  }

  ws.addEventListener('open', () => {
    state.connected = true;
    reconnectDelay = 500;
    emit('open');
    clearInterval(pingTimer);
    pingTimer = setInterval(() => send({ t: 'ping', ts: Date.now() }), 2000);
  });

  ws.addEventListener('message', (e) => {
    let msg;
    try {
      msg = JSON.parse(e.data);
    } catch {
      return;
    }
    if (msg.t === 'pong') {
      // Smooth the round trip a little so the HUD number is not jumpy.
      const rtt = Date.now() - msg.ts;
      state.ping = state.ping ? Math.round(state.ping * 0.7 + rtt * 0.3) : rtt;
      return;
    }
    emit(msg.t, msg);
  });

  ws.addEventListener('close', () => {
    state.connected = false;
    clearInterval(pingTimer);
    emit('close');
    scheduleReconnect();
  });

  ws.addEventListener('error', () => {
    try { ws.close(); } catch { /* already closing */ }
  });
}

function scheduleReconnect() {
  if (!wantOpen || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, reconnectDelay);
  reconnectDelay = Math.min(8000, reconnectDelay * 1.8);
}

export function send(obj) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  ws.send(JSON.stringify(obj));
  return true;
}

export function disconnect() {
  wantOpen = false;
  clearInterval(pingTimer);
  clearTimeout(reconnectTimer);
  reconnectTimer = null;
  if (ws) ws.close();
}
