"use client";

import { useState, useEffect, useCallback } from "react";

export type ConnectivityStatus = "online" | "degraded" | "offline";

export function useConnectivity(): ConnectivityStatus {
  const [status, setStatus] = useState<ConnectivityStatus>("online");

  const checkStatus = useCallback(async () => {
    if (!navigator.onLine) {
      setStatus("offline");
      return;
    }
    try {
      const start = Date.now();
      // Use gateApi so the Authorization header is sent (raw fetch
      // without it causes 401 on cross-origin requests).
      const { gateApi } = await import("@/lib/api/client");
      const res = await gateApi("/api/gate/status");
      if (!res.ok) {
        // Don't treat auth failures as connectivity issues -
        // gateApi handles 401 signout already.
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
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    const onOnline = () => checkStatus();
    const onOffline = () => setStatus("offline");
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [checkStatus]);

  return status;
}
