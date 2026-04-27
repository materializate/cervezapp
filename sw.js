// ══════════════════════════════════════════════════
// CervezApp — Service Worker
// ══════════════════════════════════════════════════
const CACHE = 'cervezapp-v1';

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap',
];

// Instalación — precachear recursos principales
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      return Promise.allSettled(
        PRECACHE.map(url => cache.add(url).catch(() => console.log('No cacheado:', url)))
      );
    }).then(() => self.skipWaiting())
  );
});

// Activación — limpiar cachés antiguas
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — Network first para API de Supabase, cache first para el resto
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Supabase y APIs externas: siempre red (datos en tiempo real)
  if (url.hostname.includes('supabase.co') ||
      url.hostname.includes('overpass-api') ||
      url.hostname.includes('basemaps.cartocdn') ||
      url.hostname.includes('tile.openstreetmap')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }

  // Resto: cache first, fallback a red
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, clone));
        return response;
      }).catch(() => {
        // Offline fallback para la app principal
        if (e.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
