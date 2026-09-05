// Service worker: caches the static app shell (menus, renderer, physics --
// everything except live game state) so the game loads instantly on a
// repeat visit or a shaky connection. Actual play still needs a live
// WebSocket; this only ever makes the shell arrive faster, never plays
// offline.
//
// Bump CACHE_NAME whenever the shell changes materially -- a new name means
// old cached clients pick up the new files instead of stale ones lingering.
const CACHE_NAME = '2dtag-shell-v9';

const SHELL_FILES = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/game.js',
  '/js/render.js',
  '/js/input.js',
  '/js/net.js',
  '/js/storage.js',
  '/js/audio.js',
  '/js/music.js',
  '/js/homeDemo.js',
  '/shared/constants.js',
  '/shared/maps.js',
  '/shared/physics.js',
  '/shared/skins.js',
  '/shared/trails.js',
  '/shared/quests.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Never cache the live room list or health check -- they're only ever
  // meaningful fresh, and the websocket itself doesn't go through fetch.
  if (url.pathname.startsWith('/api/')) return;

  // Stale-while-revalidate: answer from cache immediately if we have it, but
  // always fetch in the background and update the cache for next time.
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => cache.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => cached);
      return cached || network;
    })),
  );
});
