"use client";

import { Wifi, WifiOff, WifiLow, CloudOff } from "lucide-react";

interface StatusBarProps {
  status: "online" | "degraded" | "offline";
  gateName: string;
  eventName?: string;
  rate: number;
  pendingSync: number;
}

const STATUS_CONFIG = {
  online: {
    dot: "bg-[var(--success)]",
    label: "Online",
    icon: Wifi,
  },
  degraded: {
    dot: "bg-[var(--warning)]",
    label: "Slow",
    icon: WifiLow,
  },
  offline: {
    dot: "bg-[var(--destructive)]",
    label: "Offline",
    icon: WifiOff,
  },
} as const;

export function StatusBar({ status, gateName, eventName, rate, pendingSync }: StatusBarProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-4 py-2">
      {/* Left: connection status */}
      <div className="flex items-center gap-2">
        <span
          className={`size-2 rounded-full ${config.dot}${status === "degraded" ? " animate-pulse" : ""}`}
          aria-hidden="true"
        />
        <Icon className="size-3.5 text-[var(--muted-foreground)]" aria-hidden="true" />
        <span className="text-[13px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
          {config.label}
        </span>
      </div>

      {/* Center: event + gate name */}
      <span className="max-w-[40%] truncate text-[13px] font-semibold text-[var(--foreground)]">
        {eventName ? `${eventName} · ${gateName}` : gateName}
      </span>

      {/* Right: throughput + pending */}
      <div className="flex items-center gap-2 text-[13px] text-[var(--muted-foreground)]">
        <span className="tabular-nums">{rate}/min</span>
        {pendingSync > 0 && (
          <span className="flex items-center gap-1 text-[var(--warning)]">
            <CloudOff className="size-3" aria-hidden="true" />
            <span className="tabular-nums">{pendingSync}</span>
          </span>
        )}
      </div>
    </div>
  );
}
