// ============================================
// service-worker.js — Cache offline de l'app shell
// ============================================

const CACHE_NAME = 'biosynth-idle-v2';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/main.js',
  './js/state.js',
  './js/save.js',
  './js/ui.js',
  './js/economy.js',
  './icons/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Stratégie cache-first : sert le cache, retombe sur le réseau si absent
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    })
  );
});
