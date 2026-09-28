/**
 * Minimal service worker. Hand-written rather than generated, because the whole
 * requirement is one sentence: never show a blank screen.
 *
 * Strategy:
 *  - Navigations: network first, falling back to the last cached copy of that
 *    page, then to a cached shell. The screen always shows SOMETHING.
 *  - Static assets: stale-while-revalidate.
 *  - Anything that is not a GET: straight to the network, never cached. Writes
 *    require connectivity; they are not queued.
 *
 * Deliberately NOT cached: /api/export (a backup should never be stale) and
 * every auth route, so a locked app cannot appear unlocked from cache.
 */
const VERSION = 'v1';
const PAGES = `pages-${VERSION}`;
const ASSETS = `assets-${VERSION}`;

const NEVER_CACHE = ['/api/', '/lock', '/pin', '/setup'];

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER_CACHE.some((p) => url.pathname.startsWith(p))) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.pathname.startsWith('/_next/static') || /\.(png|svg|ico|woff2?|css|js)$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(PAGES);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Fall back to any cached page rather than the browser's error screen.
    const anyPage = await cache.match('/');
    if (anyPage) return anyPage;
    return new Response(
      '<!doctype html><meta charset="utf-8"><title>Offline</title>' +
        '<body style="font-family:system-ui;padding:2rem;background:#faf6f0;color:#2b2620">' +
        '<h1>No internet just now</h1><p>The dashboard will come back when the wifi does.</p>',
      { headers: { 'content-type': 'text/html' }, status: 503 },
    );
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(ASSETS);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached ?? network;
}
