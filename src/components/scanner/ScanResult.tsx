"use client";

import { useEffect } from "react";
import { CheckCircle2, XCircle, AlertTriangle, UserCheck, Ticket } from "lucide-react";

export interface ScanResultData {
  status: "valid" | "invalid" | "duplicate" | "conflict" | null;
  ticketCode?: string;
  attendeeName?: string;
  tierName?: string;
  reason?: string;
}

interface ScanResultProps {
  result: ScanResultData | null;
  onDismiss: () => void;
}

const STATUS_CONFIG = {
  valid: {
    bg: "bg-emerald-500",
    glow: "shadow-[0_0_40px_rgba(16,185,129,0.3)]",
    icon: CheckCircle2,
    label: "CHECK-IN CONFIRMED",
    sublabel: "Welcome!",
  },
  invalid: {
    bg: "bg-red-500",
    glow: "shadow-[0_0_40px_rgba(239,68,68,0.3)]",
    icon: XCircle,
    label: "INVALID TICKET",
    sublabel: "Entry denied",
  },
  duplicate: {
    bg: "bg-amber-500",
    glow: "shadow-[0_0_40px_rgba(245,158,11,0.3)]",
    icon: AlertTriangle,
    label: "ALREADY SCANNED",
    sublabel: "Previously checked in",
  },
  conflict: {
    bg: "bg-red-500",
    glow: "shadow-[0_0_40px_rgba(239,68,68,0.3)]",
    icon: XCircle,
    label: "CONFLICT",
    sublabel: "Scanned at another gate",
  },
};

export function ScanResult({ result, onDismiss }: ScanResultProps) {
  // Auto-dismiss after 4 seconds
  useEffect(() => {
    if (!result) return;
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [result, onDismiss]);

  if (!result || !result.status) return null;

  const config = STATUS_CONFIG[result.status];
  const Icon = config.icon;
  const isValid = result.status === "valid";

  return (
    <button
      type="button"
      onClick={onDismiss}
      className={`absolute inset-x-3 bottom-3 z-40 overflow-hidden rounded-2xl ${config.bg} ${config.glow} text-white motion-safe:animate-[slideUp_250ms_cubic-bezier(0.16,1,0.3,1)]`}
    >
      {/* Top accent line */}
      <div className="h-1 w-full bg-white/20" />

      <div className="p-4">
        <div className="flex items-start gap-3.5">
          {/* Icon with pulse ring for valid */}
          <div className="relative shrink-0">
            <Icon className="size-8" />
            {isValid && (
              <div className="absolute inset-0 animate-ping rounded-full bg-white/30" style={{ animationDuration: "1s", animationIterationCount: "2" }} />
            )}
          </div>

          <div className="min-w-0 flex-1 text-left">
            {/* Status label */}
            <p className="text-sm font-black uppercase tracking-[0.15em]">
              {config.label}
            </p>

            {/* Valid: show attendee info */}
            {isValid && (
              <div className="mt-2 space-y-1.5">
                {result.attendeeName && (
                  <div className="flex items-center gap-2">
                    <UserCheck className="size-4 opacity-70" />
                    <p className="truncate text-base font-semibold">{result.attendeeName}</p>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm opacity-80">
                  {result.ticketCode && (
                    <span className="flex items-center gap-1.5">
                      <Ticket className="size-3.5" />
                      <span className="font-mono font-bold">{result.ticketCode}</span>
                    </span>
                  )}
                  {result.tierName && (
                    <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold uppercase">
                      {result.tierName}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Invalid/duplicate: show reason */}
            {!isValid && (
              <p className="mt-1 text-sm opacity-90">
                {result.reason || config.sublabel}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Tap to dismiss hint */}
      <div className="border-t border-white/10 px-4 py-1.5 text-center text-xs font-medium opacity-50">
        Tap to dismiss
      </div>
    </button>
  );
}
