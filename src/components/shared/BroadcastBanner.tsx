"use client";

import { Megaphone, X } from "lucide-react";
import { useGateSSEContext } from "@/providers/GateSSEProvider";

/**
 * Shows broadcast messages from the organiser as banner overlays.
 * Powered by SSE — no polling.
 */
export function BroadcastBanner() {
  const { broadcasts, dismissBroadcast } = useGateSSEContext();

  if (broadcasts.length === 0) return null;

  return (
    <div className="absolute inset-x-0 top-12 z-40 flex flex-col gap-2 px-3">
      {broadcasts.map((msg) => (
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
            onClick={() => dismissBroadcast(msg.id)}
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
