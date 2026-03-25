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
      const API_BASE =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
      await fetch(`${API_BASE}/api/gate/status`, {
        credentials: "include",
        signal: AbortSignal.timeout(5000),
      });
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
