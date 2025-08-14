// Simple PWA + runtime tile cache
const CACHE_NAME = 'route-aid-v1';
const APP_ASSETS = [
  './',
  './index.html',
  './leaflet.js',
  './leaflet.css',
  './jszip.min.js',
  './togeojson.umd.js'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(APP_ASSETS)));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Cache-first for OSM tiles and app assets
  if (url.hostname.includes('tile.openstreetmap.org') || APP_ASSETS.some(a => url.pathname.endsWith(a.replace('./','/')))) {
    e.respondWith(
      caches.match(e.request).then(res => res || fetch(e.request).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, copy)).catch(()=>{});
        return resp;
      }).catch(() => caches.match('./index.html')))
    );
  }
});
