"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  clearSession,
  getSession,
  getSessionToken,
  type GateSessionData,
} from "@/lib/session/store";
import { gateApi } from "@/lib/api/client";
import { useRouter } from "next/navigation";

interface SessionContextValue {
  session: GateSessionData | null;
  isLoading: boolean;
  logout: () => void;
}

const SessionContext = createContext<SessionContextValue>({
  session: null,
  isLoading: true,
  logout: () => {},
});

export function useSession() {
  return useContext(SessionContext);
}

/** Keepalive interval — ping server every 10 seconds */
const KEEPALIVE_INTERVAL_MS = 10_000;

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<GateSessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const keepaliveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Verify session on mount + start keepalive
  useEffect(() => {
    let cancelled = false;

    async function verify() {
      const stored = getSession();
      if (!stored || !getSessionToken()) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await gateApi("/api/gate/status");

        if (!cancelled && res.ok) {
          setSession(stored);
        } else if (!cancelled) {
          clearSession();
          router.push("/");
        }
      } catch {
        if (!cancelled) {
          clearSession();
          router.push("/");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    verify();

    // Register keepalive with Service Worker (runs even when app is minimized)
    const token = getSessionToken();
    if (token && "serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "KEEPALIVE_START",
        apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || "",
        sessionToken: token,
      });

      // Listen for session revocation from SW
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type === "SESSION_REVOKED") {
          clearSession();
          setSession(null);
          if (typeof window !== "undefined") window.location.href = "/";
        }
      });
    }

    // Also keep a foreground interval as fallback (SW may not be active yet)
    keepaliveRef.current = setInterval(async () => {
      const t = getSessionToken();
      if (!t) return;

      try {
        const res = await gateApi("/api/gate/status");
        if (!res.ok && (res.status === 401 || res.status === 403)) {
          clearSession();
          setSession(null);
          if (typeof window !== "undefined") window.location.href = "/";
        }
      } catch {
        // Network error — keep trying
      }
    }, KEEPALIVE_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (keepaliveRef.current) clearInterval(keepaliveRef.current);
    };
  }, [router]);

  // Logout — notify server to revoke session, stop keepalive, clear locally
  const logout = useCallback(async () => {
    // Stop SW keepalive
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "KEEPALIVE_STOP" });
    }

    // Notify server to revoke this session
    try {
      await gateApi("/api/gate/logout", { method: "POST" });
    } catch {
      // Server notification failed — still logout locally
    }

    clearSession();
    setSession(null);
    if (keepaliveRef.current) clearInterval(keepaliveRef.current);
    router.push("/");
  }, [router]);

  return (
    <SessionContext.Provider value={{ session, isLoading, logout }}>
      {children}
    </SessionContext.Provider>
  );
}
