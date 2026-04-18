const CACHE_NAME = "solitaire-v23";
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
    fetch(e.request, { cache: "no-cache" })
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
