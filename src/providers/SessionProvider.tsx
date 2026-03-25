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

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<GateSessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function verify() {
      const stored = getSession();
      if (!stored) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await gateApi("/api/gate/status", {
          headers: {
            "X-Session-Id": stored.sessionId,
          },
        });

        if (res.ok) {
          setSession(stored);
        } else {
          clearSession();
          router.push("/");
        }
      } catch {
        clearSession();
        router.push("/");
      } finally {
        setIsLoading(false);
      }
    }

    verify();
  }, [router]);

  const logout = useCallback(() => {
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
