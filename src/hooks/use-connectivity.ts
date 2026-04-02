"use client";

import { useState, useEffect, useCallback } from "react";

export type ConnectivityStatus = "online" | "degraded" | "offline";

/**
 * Connectivity hook — listens for Service Worker health pings AND
 * does its own fallback polling when SW isn't available.
 *
 * Primary: SW posts CONNECTIVITY_STATUS messages (avoids duplicate pings).
 * Fallback: If no SW message received within 15s, polls directly.
 */
export function useConnectivity(): ConnectivityStatus {
  const [status, setStatus] = useState<ConnectivityStatus>("online");
  const swActiveRef = { current: false };

  const checkStatusDirect = useCallback(async () => {
    if (!navigator.onLine) {
      setStatus("offline");
      return;
    }
    try {
      const start = Date.now();
      const { gateApi } = await import("@/lib/api/client");
      const res = await gateApi("/api/gate/status");
      if (!res.ok) {
        // Don't treat auth failures as connectivity issues
        setStatus("online");
        return;
      }
      const elapsed = Date.now() - start;
      setStatus(elapsed > 2000 ? "degraded" : "online");
    } catch {
      setStatus("offline");
    }
  }, []);

  useEffect(() => {
    // Listen to SW connectivity messages
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "CONNECTIVITY_STATUS") {
        swActiveRef.current = true;
        setStatus(event.data.status as ConnectivityStatus);
      }
      if (event.data?.type === "SESSION_REVOKED") {
        swActiveRef.current = true;
        setStatus("online");
      }
    };

    // Browser-level fallbacks
    const onOffline = () => setStatus("offline");
    const onOnline = () => {
      if (!swActiveRef.current) checkStatusDirect();
    };

    navigator.serviceWorker?.addEventListener("message", onMessage);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    // Initial state
    if (!navigator.onLine) {
      setStatus("offline");
    }

    // Fallback polling: if SW doesn't send a message within 15s,
    // assume SW isn't active and poll directly every 10s
    const fallbackTimer = setTimeout(() => {
      if (!swActiveRef.current) {
        checkStatusDirect();
      }
    }, 15_000);

    // Also do a direct check on mount for immediate feedback
    checkStatusDirect();

    // Fallback interval for when SW isn't registered
    const interval = setInterval(() => {
      if (!swActiveRef.current) {
        checkStatusDirect();
      }
    }, 10_000);

    return () => {
      navigator.serviceWorker?.removeEventListener("message", onMessage);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearTimeout(fallbackTimer);
      clearInterval(interval);
    };
  }, [checkStatusDirect]);

  return status;
}
