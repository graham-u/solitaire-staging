const CACHE_NAME = "solitaire-v28";

// How long to wait for the network before falling back to the cached copy.
// A truly offline device rejects fetch() quickly, but a device connected to a
// network with no real internet access (dead router, captive portal) can leave
// fetch() hanging for a long time. Without this cap every asset stalls and the
// app never loads, defeating the offline guarantee of the PWA.
const NETWORK_TIMEOUT_MS = 3000;
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./solver-worker.js",
  "./manifest.json",
  "./icon.png"
];

self.addEventListener("install", (e) => {
  // `cache: "reload"` forces each asset to be fetched fresh from the network
  // on install, bypassing the browser's HTTP cache. Without this a stale HTTP
  // cache entry could be baked into the new service worker's cache, leaving
  // the app in an inconsistent state after a version bump.
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(ASSETS.map((url) =>
        fetch(url, { cache: "reload" }).then((resp) => cache.put(url, resp))
      ))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  // `cache: "no-cache"` makes the browser revalidate with the server (ETag /
  // If-Modified-Since) instead of serving an unvalidated HTTP-cache entry.
  // Combined with the network-first strategy below, this ensures new app
  // versions are picked up as soon as they are deployed.
  e.respondWith(
    new Promise((resolve) => {
      let settled = false;
      const settle = (resp) => {
        // Ignore a missing cache match (undefined) so a slow network still wins
        // if the cache can't satisfy the request.
        if (!settled && resp) {
          settled = true;
          resolve(resp);
        }
      };

      // If the network hasn't answered in time, serve the cached version so the
      // user can keep playing. The network request is left running so its
      // response still refreshes the cache for next time.
      const timer = setTimeout(() => {
        caches.match(e.request).then(settle);
      }, NETWORK_TIMEOUT_MS);

      fetch(e.request, { cache: "no-cache" })
        .then((response) => {
          clearTimeout(timer);
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          settle(response);
        })
        .catch(() => {
          clearTimeout(timer);
          // Network failed: serve from cache, or surface a network error if the
          // request was never cached (so respondWith always resolves).
          caches.match(e.request).then((cached) => {
            if (cached) settle(cached);
            else if (!settled) {
              settled = true;
              resolve(Response.error());
            }
          });
        });
    })
  );
});
