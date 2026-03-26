const CACHE_NAME = "riffoff-gate-v3";
const APP_SHELL = ["/", "/scan"];

// Cache app shell on install
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Clean old caches on activate
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // API calls: network-only (never cache auth/session)
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // Static assets: stale-while-revalidate
  if (url.pathname.match(/\.(js|css|png|jpg|mp3|svg|ico|woff2?)$/)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          const fetched = fetch(event.request).then((response) => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          });
          return cached || fetched;
        })
      )
    );
    return;
  }

  // App shell: cache-first (instant load offline)
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

// Background sync for offline check-ins
self.addEventListener("sync", (event) => {
  if (event.tag === "checkin-sync") {
    event.waitUntil(syncCheckIns());
  }
});

async function syncCheckIns() {
  // Sync logic handled by the app's sync-queue module
  // This just triggers a message to the client
  const clients = await self.clients.matchAll();
  for (const client of clients) {
    client.postMessage({ type: "SYNC_TRIGGER" });
  }
}
