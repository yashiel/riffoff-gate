"use client";

import { useEffect } from "react";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

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

export function ScanResult({ result, onDismiss }: ScanResultProps) {
  useEffect(() => {
    if (!result) return;
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [result, onDismiss]);

  if (!result || !result.status) return null;

  const config = {
    valid: {
      bg: "bg-[var(--success)]",
      icon: <CheckCircle2 className="size-6 shrink-0" />,
      label: "Valid Ticket",
    },
    invalid: {
      bg: "bg-[var(--destructive)]",
      icon: <XCircle className="size-6 shrink-0" />,
      label: "Invalid",
    },
    duplicate: {
      bg: "bg-[var(--warning)]",
      icon: <AlertTriangle className="size-6 shrink-0" />,
      label: "Already Checked In",
    },
    conflict: {
      bg: "bg-[var(--destructive)]",
      icon: <XCircle className="size-6 shrink-0" />,
      label: "Conflict",
    },
  }[result.status];

  return (
    <button
      type="button"
      onClick={onDismiss}
      className={`absolute inset-x-4 bottom-4 z-40 rounded-2xl ${config.bg} p-4 text-white shadow-2xl motion-safe:animate-[slideUp_200ms_ease-out]`}
    >
      <div className="flex items-start gap-3">
        {config.icon}
        <div className="min-w-0 flex-1 text-left">
          <p className="text-[15px] font-bold">{config.label}</p>
          {result.status === "valid" && (
            <>
              {result.attendeeName && (
                <p className="truncate text-[15px] opacity-90">
                  {result.attendeeName}
                </p>
              )}
              <div className="mt-1 flex items-center gap-2 text-[13px] opacity-75">
                {result.ticketCode && <span>{result.ticketCode}</span>}
                {result.tierName && (
                  <>
                    <span aria-hidden="true">&middot;</span>
                    <span>{result.tierName}</span>
                  </>
                )}
              </div>
            </>
          )}
          {result.status !== "valid" && result.reason && (
            <p className="mt-0.5 text-[15px] opacity-90">{result.reason}</p>
          )}
        </div>
      </div>
    </button>
  );
}
