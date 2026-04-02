"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
import { useGateSSEContext } from "./GateSSEProvider";

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

/**
 * Session provider — verifies session on mount, then relies on SSE for:
 *   - Keepalive (SSE connection itself updates lastSeenAt on server)
 *   - Revocation detection (SSE emits `revoked` event)
 *
 * No more 10-second polling interval.
 * Service Worker keepalive is kept as a fallback when app is minimized
 * (SSE disconnects when the browser suspends the tab).
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<GateSessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { revoked } = useGateSSEContext();

  // Verify session on mount (one-time check)
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
        // Network error on initial verify — still show stored session
        // SSE will detect revocation later
        if (!cancelled) {
          const stored2 = getSession();
          if (stored2) setSession(stored2);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    verify();

    // Register SW keepalive as fallback (for when app is minimized / SSE disconnects)
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

    return () => {
      cancelled = true;
    };
  }, [router]);

  // React to SSE revocation events
  useEffect(() => {
    if (revoked) {
      clearSession();
      setSession(null);
      if (typeof window !== "undefined") window.location.href = "/";
    }
  }, [revoked]);

  // Logout — notify server to revoke session, clear locally
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
    router.push("/");
  }, [router]);

  return (
    <SessionContext.Provider value={{ session, isLoading, logout }}>
      {children}
    </SessionContext.Provider>
  );
}
