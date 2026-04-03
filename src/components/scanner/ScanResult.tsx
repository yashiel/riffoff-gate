"use client";

import { useEffect, useState, useCallback } from "react";
import { Check, X, AlertTriangle, Zap } from "lucide-react";

export interface ScanResultData {
  status: "valid" | "invalid" | "duplicate" | "conflict" | null;
  ticketCode?: string;
  attendeeName?: string;
  tierName?: string;
  reason?: string;
  attendeePhotoUrl?: string | null;
  seatInfo?: string | null;
  firstScannedAt?: string | null;
  firstScannedByGate?: string | null;
}

interface ScanResultProps {
  result: ScanResultData | null;
  onDismiss: () => void;
  dismissMs?: number;
}

const STATUS_CONFIG = {
  valid: {
    color: "#10b981",
    icon: Check,
    label: "APPROVED",
  },
  invalid: {
    color: "#ef4444",
    icon: X,
    label: "DENIED",
  },
  duplicate: {
    color: "#f59e0b",
    icon: AlertTriangle,
    label: "ALREADY SCANNED",
  },
  conflict: {
    color: "#f97316",
    icon: Zap,
    label: "CONFLICT",
  },
} as const;

function InitialsAvatar({ name }: { name: string }) {
  const initial = name?.charAt(0)?.toUpperCase() || "?";
  const colors = ["#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316"];
  const bg = colors[initial.charCodeAt(0) % colors.length];
  return (
    <div
      className="size-14 rounded-full flex items-center justify-center text-xl font-bold text-white shrink-0"
      style={{ backgroundColor: bg }}
    >
      {initial}
    </div>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const t = tier.toLowerCase();
  let classes = "text-[#374151] bg-[#f3f4f6]";
  if (t.includes("vip")) classes = "text-[#b8860b] bg-[#fef3c7]";
  else if (t.includes("early")) classes = "text-[#1e40af] bg-[#dbeafe]";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${classes}`}>
      {tier}
    </span>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function ScanResult({ result, onDismiss, dismissMs = 5000 }: ScanResultProps) {
  const [visible, setVisible] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    if (prefersReducedMotion) {
      onDismiss();
      return;
    }
    // Allow slide-down animation to finish before calling onDismiss
    const timeout = setTimeout(onDismiss, 260);
    return () => clearTimeout(timeout);
  }, [onDismiss, prefersReducedMotion]);

  // Show when result arrives
  useEffect(() => {
    if (result?.status) {
      setVisible(true);
    }
  }, [result]);

  // Auto-dismiss timer
  useEffect(() => {
    if (!result?.status || !visible) return;
    const timer = setTimeout(dismiss, dismissMs);
    return () => clearTimeout(timer);
  }, [result, visible, dismiss, dismissMs]);

  if (!result || !result.status) return null;

  const config = STATUS_CONFIG[result.status];
  const Icon = config.icon;
  const isPositive = result.status === "valid" || result.status === "duplicate";
  const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <button
      type="button"
      onClick={dismiss}
      className="absolute inset-x-0 bottom-0 z-30 focus:outline-none"
      style={{
        transform: visible ? "translateY(0)" : "translateY(100%)",
        transition: prefersReducedMotion ? "none" : "transform 250ms cubic-bezier(0.16, 1, 0.3, 1)",
      }}
      aria-label="Dismiss scan result"
    >
      <div className="rounded-t-2xl overflow-hidden bg-[#1a1a1f]" style={{ minHeight: "60dvh" }}>
        {/* Color header strip */}
        <div
          className="flex items-center justify-center gap-3 px-5"
          style={{ backgroundColor: config.color, height: 48 }}
        >
          <Icon className="size-6 text-white" strokeWidth={3} />
          <span className="text-base font-black uppercase tracking-widest text-white">
            {config.label}
          </span>
        </div>

        {/* Content area */}
        <div className="px-5 py-4">
          {/* Valid or duplicate: show attendee details */}
          {isPositive && (
            <div className="flex flex-col items-center text-center gap-3">
              {/* Photo / initials */}
              {result.attendeePhotoUrl ? (
                <img
                  src={result.attendeePhotoUrl}
                  alt={result.attendeeName || "Attendee"}
                  className="size-14 rounded-full object-cover shrink-0"
                />
              ) : result.attendeeName ? (
                <InitialsAvatar name={result.attendeeName} />
              ) : null}

              {/* Name */}
              {result.attendeeName && (
                <p className="text-xl font-bold text-white truncate max-w-full">
                  {result.attendeeName}
                </p>
              )}

              {/* Tier badge */}
              {result.tierName && <TierBadge tier={result.tierName} />}

              {/* Ticket code */}
              {result.ticketCode && (
                <p className="font-mono text-sm text-[#9ca3af] tracking-wide">
                  {result.ticketCode}
                </p>
              )}

              {/* Seat info */}
              {result.seatInfo && (
                <p className="text-sm text-[#d1d5db]">{result.seatInfo}</p>
              )}

              {/* Duplicate context */}
              {result.status === "duplicate" && (result.firstScannedByGate || result.firstScannedAt) && (
                <p className="text-sm text-[#f59e0b] mt-1">
                  First scanned
                  {result.firstScannedByGate ? ` by ${result.firstScannedByGate}` : ""}
                  {result.firstScannedAt ? ` at ${formatTime(result.firstScannedAt)}` : ""}
                </p>
              )}
            </div>
          )}

          {/* Invalid / conflict: show reason */}
          {!isPositive && (
            <div className="flex flex-col items-center text-center gap-3 py-4">
              <p className="text-lg font-semibold text-white">
                {result.reason || "Entry denied"}
              </p>
              {result.ticketCode && (
                <p className="font-mono text-sm text-[#9ca3af] tracking-wide">
                  {result.ticketCode}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-auto border-t border-white/10 px-5 py-3 flex items-center justify-between">
          <span className="text-xs text-[#6b7280]">{now}</span>
          <span className="text-xs text-[#6b7280]">Tap to dismiss</span>
        </div>
      </div>
    </button>
  );
}
