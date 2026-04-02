"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useGateSSE, type GateSSEState } from "@/hooks/use-gate-sse";

const GateSSEContext = createContext<GateSSEState>({
  connectionState: "connecting",
  stats: null,
  broadcasts: [],
  revoked: false,
  serverTime: null,
  dismissBroadcast: () => {},
});

export function useGateSSEContext() {
  return useContext(GateSSEContext);
}

/**
 * Provides a single SSE connection shared by all scanner components.
 * Replaces multiple polling intervals with one persistent stream.
 */
export function GateSSEProvider({ children }: { children: ReactNode }) {
  const sse = useGateSSE();

  return (
    <GateSSEContext.Provider value={sse}>
      {children}
    </GateSSEContext.Provider>
  );
}
