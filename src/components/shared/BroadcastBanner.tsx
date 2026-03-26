"use client";

import { useEffect, useRef, useState } from "react";
import { Megaphone, X } from "lucide-react";
import { gateApi } from "@/lib/api/client";
import { getSessionToken } from "@/lib/session/store";

interface BroadcastMessage {
  id: string;
  message: string;
  createdAt: string;
}

/** Polls for broadcast messages and shows them as a banner overlay */
export function BroadcastBanner() {
  const [messages, setMessages] = useState<BroadcastMessage[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const lastFetchRef = useRef<string>("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function fetchMessages() {
      const token = getSessionToken();
      if (!token) return;

      try {
        const params = lastFetchRef.current ? `?since=${lastFetchRef.current}` : "";
        const res = await gateApi(`/api/gate/messages${params}`);
        if (!res.ok) return;

        const data = await res.json();
        const newMsgs = (data.messages || []) as BroadcastMessage[];

        if (newMsgs.length > 0) {
          setMessages((prev) => {
            const ids = new Set(prev.map((m) => m.id));
            const unique = newMsgs.filter((m) => !ids.has(m.id));
            return [...unique, ...prev].slice(0, 10);
          });
          lastFetchRef.current = new Date().toISOString();

          // Vibrate to alert staff
          if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        }
      } catch {
        // Network error — skip
      }
    }

    // Initial fetch
    lastFetchRef.current = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // Last 5 min
    fetchMessages();

    // Poll every 5 seconds
    intervalRef.current = setInterval(fetchMessages, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const visible = messages.filter((m) => !dismissed.has(m.id));

  if (visible.length === 0) return null;

  return (
    <div className="absolute inset-x-0 top-12 z-40 flex flex-col gap-2 px-3">
      {visible.map((msg) => (
        <div
          key={msg.id}
          className="flex items-start gap-3 rounded-xl bg-amber-500 p-3 text-black shadow-lg shadow-amber-500/20 motion-safe:animate-[slideDown_300ms_ease-out]"
        >
          <Megaphone className="mt-0.5 size-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold uppercase tracking-wider">Broadcast</p>
            <p className="mt-0.5 text-base font-medium">{msg.message}</p>
          </div>
          <button
            onClick={() => setDismissed((prev) => new Set([...prev, msg.id]))}
            className="shrink-0 rounded-lg p-1 transition-colors hover:bg-black/10"
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
