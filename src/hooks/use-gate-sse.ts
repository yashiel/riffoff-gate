"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getSessionToken } from "@/lib/session/store";

// --- SSE Event Types ---

export interface BroadcastMessage {
  id: string;
  message: string;
  gateId: string | null;
  createdAt: string;
}

export interface GateStatEntry {
  gateId: string;
  gateName: string;
  checkedIn: number;
  devices: number;
  conflicts: number;
  lastScan?: string;
}

export interface GateStats {
  total: { checkedIn: number; totalTickets: number };
  gates: GateStatEntry[];
}

export type SSEConnectionState = "connecting" | "connected" | "reconnecting" | "disconnected";

export interface GateSSEState {
  /** Connection state */
  connectionState: SSEConnectionState;
  /** Aggregated stats from the stream */
  stats: GateStats | null;
  /** Broadcast messages received via SSE */
  broadcasts: BroadcastMessage[];
  /** Whether the session has been revoked by organiser */
  revoked: boolean;
  /** Server time from last heartbeat (for clock sync) */
  serverTime: string | null;
  /** Dismiss a broadcast message locally */
  dismissBroadcast: (id: string) => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

/** Max reconnection delay (30 seconds) */
const MAX_RECONNECT_DELAY = 30_000;
/** Base reconnection delay (1 second) */
const BASE_RECONNECT_DELAY = 1_000;

/**
 * SSE hook for the scanner app.
 * Replaces:
 *   - BroadcastBanner polling (5s)
 *   - SessionProvider keepalive polling (10s)
 *   - Status heartbeat
 *
 * Connects to /api/gate/stream?token=<session>&role=scanner
 * and emits typed events to subscribers.
 */
export function useGateSSE(): GateSSEState {
  const [connectionState, setConnectionState] = useState<SSEConnectionState>("connecting");
  const [stats, setStats] = useState<GateStats | null>(null);
  const [broadcasts, setBroadcasts] = useState<BroadcastMessage[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [revoked, setRevoked] = useState(false);
  const [serverTime, setServerTime] = useState<string | null>(null);

  const esRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    const token = getSessionToken();
    if (!token) {
      setConnectionState("disconnected");
      return;
    }

    // Close existing connection
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    const url = `${API_BASE}/api/gate/stream?token=${encodeURIComponent(token)}&role=scanner`;
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener("connected", () => {
      setConnectionState("connected");
      retryCountRef.current = 0; // Reset backoff on successful connect
    });

    es.addEventListener("stats", (e) => {
      try {
        setStats(JSON.parse(e.data));
      } catch { /* malformed data */ }
    });

    es.addEventListener("broadcast", (e) => {
      try {
        const msg: BroadcastMessage = JSON.parse(e.data);
        setBroadcasts((prev) => {
          const ids = new Set(prev.map((m) => m.id));
          if (ids.has(msg.id)) return prev;
          return [msg, ...prev].slice(0, 20);
        });

        // Vibrate to alert staff
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate([100, 50, 100]);
        }
      } catch { /* malformed data */ }
    });

    es.addEventListener("revoked", () => {
      setRevoked(true);
      setConnectionState("disconnected");
      es.close();
    });

    es.addEventListener("heartbeat", (e) => {
      try {
        const data = JSON.parse(e.data);
        setServerTime(data.serverTime);
      } catch { /* ok */ }
    });

    es.addEventListener("error", () => {
      // EventSource has no typed error event — just a generic error
    });

    es.onopen = () => {
      setConnectionState("connected");
      retryCountRef.current = 0;
    };

    es.onerror = () => {
      // EventSource auto-reconnects, but we track state
      if (revoked) return; // Don't reconnect if revoked

      setConnectionState("reconnecting");
      es.close();
      esRef.current = null;

      // Exponential backoff with jitter
      const delay = Math.min(
        BASE_RECONNECT_DELAY * Math.pow(2, retryCountRef.current) +
          Math.random() * 1000,
        MAX_RECONNECT_DELAY,
      );
      retryCountRef.current++;

      retryTimerRef.current = setTimeout(connect, delay);
    };
  }, [revoked]);

  useEffect(() => {
    connect();

    return () => {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, [connect]);

  const dismissBroadcast = useCallback((id: string) => {
    setDismissed((prev) => new Set([...prev, id]));
  }, []);

  // Filter out dismissed broadcasts
  const visibleBroadcasts = broadcasts.filter((b) => !dismissed.has(b.id));

  return {
    connectionState,
    stats,
    broadcasts: visibleBroadcasts,
    revoked,
    serverTime,
    dismissBroadcast,
  };
}
