"use client";

import { X, LogOut } from "lucide-react";
import type { GateSessionData } from "@/lib/session/store";
import { getDeviceId } from "@/lib/session/store";

interface InfoSheetProps {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
  session: GateSessionData | null;
}

export function InfoSheet({ open, onClose, onLogout, session }: InfoSheetProps) {
  if (!open) return null;

  const deviceId = typeof window !== "undefined" ? getDeviceId() : "";
  const truncatedSession = session?.sessionId
    ? `${session.sessionId.slice(0, 8)}...`
    : "N/A";

  return (
    <div className="absolute inset-0 z-30 flex flex-col">
      {/* Backdrop */}
      <div className="flex-1 bg-black/60" onClick={onClose} aria-hidden="true" />
      {/* Sheet */}
      <div className="rounded-t-2xl bg-[var(--card)] motion-safe:animate-[slideUp_200ms_ease-out]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h2 className="text-[15px] font-semibold text-[var(--foreground)]">
            Session Info
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)]"
            aria-label="Close info"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Info rows */}
        <div className="space-y-0 divide-y divide-[var(--border)] px-4">
          <InfoRow label="Event" value={session?.eventId ?? "N/A"} />
          <InfoRow label="Gate" value={session?.gateName ?? "N/A"} />
          <InfoRow label="Session" value={truncatedSession} />
          <InfoRow
            label="Device"
            value={deviceId ? `${deviceId.slice(0, 8)}...` : "N/A"}
          />
        </div>

        {/* Logout */}
        <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            onClick={onLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--destructive)]/10 py-3 text-[15px] font-semibold text-[var(--destructive)] transition-colors active:bg-[var(--destructive)]/20"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-[13px] text-[var(--muted-foreground)]">{label}</span>
      <span className="text-[13px] font-medium text-[var(--foreground)]">
        {value}
      </span>
    </div>
  );
}
