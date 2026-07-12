const CACHE_NAME = 'geoweather-cache-v8';
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
  // Ignora chamadas para APIs dinâmicas (como previsão do tempo, roteamento e busca nominatim)
  if (
    e.request.url.includes('api.open-meteo.com') || 
    e.request.url.includes('nominatim.openstreetmap.org') || 
    e.request.url.includes('router.project-osrm.org') ||
    e.request.url.includes('viacep.com.br')
  ) {
    return;
  }
  
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(e.request).then((response) => {
        // Cacheia dinamicamente bibliotecas de CDN e fontes para uso offline
        if (
          e.request.url.includes('unpkg.com') || 
          e.request.url.includes('fonts.googleapis.com') || 
          e.request.url.includes('fonts.gstatic.com')
        ) {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, response.clone());
            return response;
          });
        }
        return response;
      });
    })
  );
});
