"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Info, AlertTriangle, ShieldAlert, X } from "lucide-react";
import { gateApi } from "@/lib/api/client";
import { getSessionToken } from "@/lib/session/store";
import { useAudio } from "@/hooks/use-audio";

type BroadcastPriority = "info" | "warning" | "emergency";

interface BroadcastMessage {
  id: string;
  message: string;
  createdAt: string;
  gateId?: string | null;
  priority?: BroadcastPriority;
}

interface BroadcastBannerProps {
  onEmergency?: (active: boolean) => void;
}

const MAX_VISIBLE = 5;

/** Three-tier broadcast banner: info / warning / emergency */
export function BroadcastBanner({ onEmergency }: BroadcastBannerProps) {
  const [messages, setMessages] = useState<BroadcastMessage[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const lastFetchRef = useRef(
    new Date(Date.now() - 5 * 60 * 1000).toISOString()
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeEmergencyRef = useRef(false);
  const playedIdsRef = useRef<Set<string>>(new Set());
  const vibrationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );

  const { playWarning, playEmergency, stopEmergency } = useAudio();

  // Poll for messages
  useEffect(() => {
    async function fetchMessages() {
      const token = getSessionToken();
      if (!token) return;

      try {
        const params = lastFetchRef.current
          ? `?since=${lastFetchRef.current}`
          : "";
        const res = await gateApi(`/api/gate/messages${params}`);
        if (!res.ok) return;

        const data = await res.json();
        const newMsgs = (data.messages || []) as BroadcastMessage[];

        if (newMsgs.length > 0) {
          setMessages((prev) => {
            const ids = new Set(prev.map((m) => m.id));
            const unique = newMsgs.filter((m) => !ids.has(m.id));
            return [...unique, ...prev].slice(0, 20);
          });
          lastFetchRef.current = new Date().toISOString();
        }
      } catch {
        // Network error - skip
      }
    }

    fetchMessages();
    intervalRef.current = setInterval(fetchMessages, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Handle sound/haptic effects for new messages
  useEffect(() => {
    const visible = messages.filter((m) => !dismissed.has(m.id));
    const hasEmergency = visible.some(
      (m) => (m.priority || "info") === "emergency"
    );

    // Play sounds for newly arrived messages
    for (const msg of visible) {
      if (playedIdsRef.current.has(msg.id)) continue;
      playedIdsRef.current.add(msg.id);

      const priority = msg.priority || "info";

      if (priority === "warning") {
        playWarning();
        navigator.vibrate?.(200);
      } else if (priority === "emergency") {
        playEmergency();
        navigator.vibrate?.([500, 200, 500, 200, 500]);
        if (!vibrationIntervalRef.current) {
          vibrationIntervalRef.current = setInterval(() => {
            navigator.vibrate?.([500, 200, 500, 200, 500]);
          }, 2500);
        }
      }
    }

    // Emergency state management
    if (hasEmergency && !activeEmergencyRef.current) {
      activeEmergencyRef.current = true;
      onEmergency?.(true);
    } else if (!hasEmergency && activeEmergencyRef.current) {
      activeEmergencyRef.current = false;
      stopEmergency();
      onEmergency?.(false);
      if (vibrationIntervalRef.current) {
        clearInterval(vibrationIntervalRef.current);
        vibrationIntervalRef.current = null;
      }
      navigator.vibrate?.(0);
    }
  }, [messages, dismissed, playWarning, playEmergency, stopEmergency, onEmergency]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopEmergency();
      if (vibrationIntervalRef.current) {
        clearInterval(vibrationIntervalRef.current);
      }
      navigator.vibrate?.(0);
    };
  }, [stopEmergency]);

  const handleDismiss = useCallback((id: string) => {
    setDismissed((prev) => new Set([...prev, id]));
  }, []);

  const handleAcknowledge = useCallback(
    (id: string) => {
      setDismissed((prev) => new Set([...prev, id]));
      stopEmergency();
      if (vibrationIntervalRef.current) {
        clearInterval(vibrationIntervalRef.current);
        vibrationIntervalRef.current = null;
      }
      navigator.vibrate?.(0);
    },
    [stopEmergency]
  );

  const priorityOrder: Record<BroadcastPriority, number> = {
    emergency: 0,
    warning: 1,
    info: 2,
  };

  const visible = messages
    .filter((m) => !dismissed.has(m.id))
    .sort(
      (a, b) =>
        priorityOrder[a.priority || "info"] -
        priorityOrder[b.priority || "info"]
    )
    .slice(0, MAX_VISIBLE);

  if (visible.length === 0) return null;

  return (
    <div className="absolute inset-x-0 top-12 z-40 flex flex-col gap-2 px-3">
      {visible.map((msg) => {
        const priority = msg.priority || "info";

        if (priority === "emergency") {
          return (
            <EmergencyBanner
              key={msg.id}
              message={msg.message}
              onAcknowledge={() => handleAcknowledge(msg.id)}
            />
          );
        }

        if (priority === "warning") {
          return (
            <WarningBanner
              key={msg.id}
              message={msg.message}
              onDismiss={() => handleDismiss(msg.id)}
            />
          );
        }

        return (
          <InfoBanner
            key={msg.id}
            message={msg.message}
            onDismiss={() => handleDismiss(msg.id)}
          />
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Info tier                                                         */
/* ------------------------------------------------------------------ */
function InfoBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 shadow-lg backdrop-blur-sm motion-safe:animate-[slideDown_300ms_ease-out]">
      <Info className="mt-0.5 size-5 shrink-0 text-blue-400/70" />
      <div className="min-w-0 flex-1">
        <p className="text-base font-medium text-white/80">{message}</p>
      </div>
      <button
        onClick={onDismiss}
        className="shrink-0 rounded-lg p-1 transition-colors hover:bg-white/10"
        aria-label="Dismiss"
      >
        <X className="size-4 text-white/50" />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Warning tier                                                      */
/* ------------------------------------------------------------------ */
function WarningBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#f59e0b]/30 bg-[#f59e0b]/10 p-3 shadow-lg shadow-[#f59e0b]/10 backdrop-blur-sm motion-safe:animate-[slideDown_300ms_ease-out] animate-pulse-border-amber">
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[#f59e0b]" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold uppercase tracking-wider text-[#f59e0b]">
          Warning
        </p>
        <p className="mt-0.5 text-base font-medium text-white/90">{message}</p>
      </div>
      <button
        onClick={onDismiss}
        className="shrink-0 rounded-lg p-1 transition-colors hover:bg-[#f59e0b]/20"
        aria-label="Dismiss"
      >
        <X className="size-4 text-[#f59e0b]/70" />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Emergency tier                                                    */
/* ------------------------------------------------------------------ */
function EmergencyBanner({
  message,
  onAcknowledge,
}: {
  message: string;
  onAcknowledge: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border-2 border-[#ef4444] bg-[#ef4444]/15 p-3 shadow-lg shadow-[#ef4444]/20 backdrop-blur-sm motion-safe:animate-[slideDown_300ms_ease-out] animate-flash-border-red">
      <ShieldAlert className="mt-0.5 size-6 shrink-0 text-[#ef4444] animate-pulse" />
      <div className="min-w-0 flex-1">
        <p className="text-base font-bold uppercase tracking-wider text-[#ef4444]">
          Emergency
        </p>
        <p className="mt-1 text-base font-medium text-white">{message}</p>
        <button
          onClick={onAcknowledge}
          className="mt-2 rounded-lg bg-[#ef4444] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#dc2626] active:bg-[#b91c1c]"
        >
          Acknowledge
        </button>
      </div>
    </div>
  );
}
