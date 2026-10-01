// Service worker del juego: hace que siempre se juegue con la última versión publicada.
// Cada archivo del juego se pide a la red preguntando al servidor si ha cambiado
// (si no ha cambiado, el servidor responde «304» y se usa la copia guardada, así que apenas gasta datos).
// Si no hay conexión, se usa la última copia guardada.
const CACHE = 'wapuu-game';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // three.js, Firebase y fuentes van por su cuenta
  e.respondWith((async () => {
    try {
      const res = await fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' });
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req.url, copy)).catch(() => {});
      }
      return res;
    } catch (err) {
      const hit = await caches.match(req.url);
      if (hit) return hit;
      throw err;
    }
  })());
});
