"use client";

import { useEffect } from "react";

const SW_VERSION = "v5";

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    (async () => {
      try {
        // Force-clear old caches that don't match current version
        const cacheNames = await caches.keys();
        for (const name of cacheNames) {
          if (name !== `riffoff-gate-${SW_VERSION}`) {
            await caches.delete(name);
          }
        }

        // Register with cache-bust param to bypass HTTP cache on iOS
        const reg = await navigator.serviceWorker.register(
          `/sw.js?v=${SW_VERSION}`,
          { updateViaCache: "none" },
        );

        // Force the new SW to activate immediately
        if (reg.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
        }
        reg.addEventListener("updatefound", () => {
          const newSW = reg.installing;
          newSW?.addEventListener("statechange", () => {
            if (newSW.state === "activated") {
              // New SW active — reload to pick up fresh assets
              window.location.reload();
            }
          });
        });
      } catch {
        // SW registration failed — app still works without it
      }
    })();
  }, []);

  return null;
}
