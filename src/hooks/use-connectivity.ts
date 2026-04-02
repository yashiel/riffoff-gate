"use client";

import { useState, useEffect } from "react";

export type ConnectivityStatus = "online" | "degraded" | "offline";

/**
 * Connectivity hook — passive listener for Service Worker health pings.
 * The SW already pings /api/gate/status every 10s; this hook just
 * listens for its messages instead of duplicating the polling.
 * Falls back to browser online/offline events if SW isn't available.
 */
export function useConnectivity(): ConnectivityStatus {
  const [status, setStatus] = useState<ConnectivityStatus>("online");

  useEffect(() => {
    // Listen to SW connectivity messages
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "CONNECTIVITY_STATUS") {
        setStatus(event.data.status as ConnectivityStatus);
      }
      // Session revocation implies we're online (server responded)
      if (event.data?.type === "SESSION_REVOKED") {
        setStatus("online");
      }
    };

    // Browser-level fallbacks
    const onOffline = () => setStatus("offline");
    const onOnline = () => setStatus("online");

    navigator.serviceWorker?.addEventListener("message", onMessage);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    // Initial state from browser
    if (!navigator.onLine) setStatus("offline");

    return () => {
      navigator.serviceWorker?.removeEventListener("message", onMessage);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return status;
}
