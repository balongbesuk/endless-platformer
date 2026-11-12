const CACHE_VERSION = 'offline-adventure-v2.8.7';
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './assets/kenney/tiles.png',
  './assets/kenney/bg.png',
  './assets/kenney/chars.png',
  './assets/scenery/tree_spring_large.png',
  './assets/scenery/tree_summer_large.png',
  './assets/scenery/tree_autumn_large.png',
  './assets/scenery/tree_winter_large.png',
  './assets/scenery/tree_spring_small.png',
  './assets/scenery/tree_summer_small.png',
  './assets/scenery/tree_autumn_small.png',
  './assets/scenery/tree_winter_small.png',
  './assets/scenery/bush_spring.png',
  './assets/scenery/bush_summer.png',
  './assets/scenery/bush_autumn.png',
  './assets/scenery/bush_winter.png',
  './assets/ui/Volume.png',
  './assets/ui/Leaderboard.png',
  './assets/ui/Play.png',
  './assets/ui/Restart.png',
  './assets/ui/Back.png',
  './assets/effects/collected.png',
  './assets/effects/dust.png',
  './assets/effects/shield_bubble.png',
  './assets/ui/heart.png',
  './assets/ui/heart_empty.png',
  './assets/ui/Settings.png',
  './assets/ui/Close.png',
  './assets/items/box_idle.png',
  './assets/items/box_break.png',
  './assets/items/shield_melon.png',
  './assets/items/magnet_pineapple.png',
  './assets/items/life_apple.png',
  './assets/items/mushroom_super.png',
  './assets/player/scout/Idle.png',
  './assets/player/scout/Run.png',
  './assets/player/scout/Jump.png',
  './assets/player/scout/Fall.png',
  './assets/player/scout/Hit.png',
  './assets/player/ninja/Idle.png',
  './assets/player/ninja/Run.png',
  './assets/player/ninja/Jump.png',
  './assets/player/ninja/Fall.png',
  './assets/player/ninja/Hit.png',
  './assets/player/knight/Idle.png',
  './assets/player/knight/Run.png',
  './assets/player/knight/Jump.png',
  './assets/player/knight/Fall.png',
  './assets/player/knight/Hit.png',
  './assets/player/retro/Idle.png',
  './assets/player/retro/Run.png',
  './assets/player/retro/Jump.png',
  './assets/player/retro/Fall.png',
  './assets/player/retro/Hit.png'
];

// 1. Install & Precache seluruh aset inti
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// 2. Activate & Bersihkan cache versi lama secara terkontrol
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('offline-adventure-') && key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// 3. Strategi Cache-First untuk aset game & Fallback halaman offline
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_VERSION).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Jika navigasi halaman gagal saat offline, tampilkan game offline
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        });
    })
  );
});