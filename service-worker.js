const CACHE_NAME = 'geoweather-cache-v2';
const ASSETS = [
  './index.html',
  './styles.css',
  './app.js',
  './sedes.js',
  './manifest.json',
  './app_icon.jpg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (e) => {
  // Ignora chamadas para APIs de terceiros (como previsão do tempo ou mapas)
  if (e.request.url.includes('api.open-meteo.com') || e.request.url.includes('openstreetmap.org')) {
    return;
  }
  
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      return cachedResponse || fetch(e.request);
    })
  );
});
