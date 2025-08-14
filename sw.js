// ---- PWA + Runtime tile cache (improved) ----
const VERSION = 'v1.1.0';
const STATIC_CACHE = `static-${VERSION}`;
const TILE_CACHE   = `tiles-${VERSION}`;
const MAX_TILES    = 800;               // タイルの最大保存数（必要に応じて調整）

// この SW が配信されているベース URL（GitHub Pages でも OK）
const BASE = self.registration.scope;   // 例: https://username.github.io/repo/

// 事前キャッシュする静的資産
const APP_ASSETS_REL = [
  './',
  './index.html',
  './leaflet.js',
  './leaflet.css',
  './jszip.min.js',
  './togeojson.umd.js',
  './manifest.webmanifest'
];

// 相対 → 絶対 URL に正規化（スコープ配下に確実に一致させる）
const APP_ASSETS = APP_ASSETS_REL.map(p => new URL(p, BASE).href);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(APP_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k !== STATIC_CACHE && k !== TILE_CACHE)
        .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// タイルを SWR で取得し、件数制限をかける
async function staleWhileRevalidateTile(request) {
  const cache = await caches.open(TILE_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request, { mode: 'cors' })
    .then(async (resp) => {
      if (resp && resp.status === 200) {
        try {
          await cache.put(request, resp.clone());
          // タイル枚数を制限（FIFO）
          const keys = await cache.keys();
          if (keys.length > MAX_TILES) {
            await cache.delete(keys[0]);
          }
        } catch {}
      }
      return resp;
    })
    .catch(() => null);

  return cached || network || new Response('', { status: 504 });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1) OSM タイル
  if (url.hostname.endsWith('tile.openstreetmap.org')) {
    event.respondWith(staleWhileRevalidateTile(req));
    return;
  }

  // 2) 自サイトの静的資産はキャッシュ優先
  if (APP_ASSETS.includes(url.href)) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req))
    );
    return;
  }

  // 3) ナビゲーション（ページ遷移）はオフライン時に index.html を返す
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match(new URL('./index.html', BASE).href))
    );
    return;
  }

  // 4) それ以外はネット優先（失敗時はキャッシュ）
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});
