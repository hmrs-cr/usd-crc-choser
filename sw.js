/* Service worker: keeps the app shell cached so the app opens offline.
 * Strategy: stale-while-revalidate for same-origin GETs.
 * Exchange-rate APIs (cross-origin) are never cached here — the page keeps
 * the last rate in localStorage (fx_last_rate) so it knows the rate's age.
 * To ship an update, bump CACHE_VERSION. */
const CACHE_VERSION = 'v8';
const CACHE = `fx-optimizer-${CACHE_VERSION}`;
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('fx-optimizer-') && k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return; // let APIs hit the network

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const isNav = req.mode === 'navigate';
    const cached = await cache.match(req, { ignoreSearch: isNav });

    const network = fetch(req)
      .then((res) => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      })
      .catch(() => null);

    if (cached) {
      event.waitUntil(network); // refresh in background
      return cached;
    }

    const res = await network;
    if (res) return res;
    if (isNav) {
      const shell = (await cache.match('./index.html')) || (await cache.match('./'));
      if (shell) return shell;
    }
    return Response.error();
  })());
});
