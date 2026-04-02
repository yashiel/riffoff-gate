const CACHE_NAME = "riffoff-gate-v4";
const APP_SHELL = ["/", "/scan"];

// ─── Keepalive Config ───
let keepaliveInterval = null;
let apiBaseUrl = "";
let sessionToken = "";

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

// ─── Message handler — receive keepalive config from the app ───
self.addEventListener("message", (event) => {
  const data = event.data;

  if (data.type === "KEEPALIVE_START") {
    apiBaseUrl = data.apiBaseUrl || "";
    sessionToken = data.sessionToken || "";

    // Start keepalive ping every 10 seconds
    if (keepaliveInterval) clearInterval(keepaliveInterval);
    keepaliveInterval = setInterval(sendKeepalive, 10000);
    // Send first one immediately
    sendKeepalive();
  }

  if (data.type === "KEEPALIVE_STOP") {
    if (keepaliveInterval) clearInterval(keepaliveInterval);
    keepaliveInterval = null;
    sessionToken = "";
  }

  if (data.type === "KEEPALIVE_UPDATE_TOKEN") {
    sessionToken = data.sessionToken || "";
  }
});

async function sendKeepalive() {
  if (!apiBaseUrl || !sessionToken) return;

  const clients = await self.clients.matchAll();

  try {
    const start = Date.now();
    const res = await fetch(`${apiBaseUrl}/api/gate/status`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${sessionToken}`,
        "X-Screen-Size": "sw",
        "X-Timezone": "sw",
        "X-Language": "sw",
      },
    });

    // If session was revoked, notify all clients
    if (res.status === 401 || res.status === 403) {
      for (const client of clients) {
        client.postMessage({ type: "SESSION_REVOKED" });
      }
      if (keepaliveInterval) clearInterval(keepaliveInterval);
      keepaliveInterval = null;
      return;
    }

    // Broadcast connectivity status to all clients
    const elapsed = Date.now() - start;
    const status = elapsed > 2000 ? "degraded" : "online";
    for (const client of clients) {
      client.postMessage({ type: "CONNECTIVITY_STATUS", status });
    }
  } catch {
    // Network error — broadcast offline status
    for (const client of clients) {
      client.postMessage({ type: "CONNECTIVITY_STATUS", status: "offline" });
    }
  }
}

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
  const clients = await self.clients.matchAll();
  for (const client of clients) {
    client.postMessage({ type: "SYNC_TRIGGER" });
  }
}
