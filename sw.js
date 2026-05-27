const CACHE_NAME = 'impostor-cache-v1.3';

const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './impostor-word-engine.js',
    './audio-engine.js',
    './favicon.svg',
    './manifest.json',
    './impostor_deck_200_v1_1_normalizado.json',
    './medicine_general.json',
    './psychology.json'
];

self.addEventListener('install', event => {
    self.skipWaiting(); // Force new SW to activate immediately
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim(); // Take control of all open pages immediately
});

self.addEventListener('fetch', event => {
    // Network-first for JSON files to get latest data, fallback to cache
    if (event.request.url.endsWith('.json')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const clonedRes = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clonedRes));
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Cache-first for other assets
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});
