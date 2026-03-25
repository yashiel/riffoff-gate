"use client";

import { useEffect, useState, useRef } from "react";
import { X, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

interface HistoryEntry {
  ticketCode: string;
  status: "valid" | "invalid" | "duplicate" | "conflict";
  timestamp: string;
}

interface HistorySheetProps {
  open: boolean;
  onClose: () => void;
}

const HISTORY_KEY = "riffoff-gate-scan-history";
const MAX_HISTORY = 50;

export function addToHistory(entry: HistoryEntry) {
  const raw = localStorage.getItem(HISTORY_KEY);
  const history: HistoryEntry[] = raw ? JSON.parse(raw) : [];
  history.unshift(entry);
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function getHistory(): HistoryEntry[] {
  const raw = localStorage.getItem(HISTORY_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as HistoryEntry[];
  } catch {
    return [];
  }
}

const STATUS_ICONS = {
  valid: { icon: CheckCircle2, color: "text-[var(--success)]" },
  invalid: { icon: XCircle, color: "text-[var(--destructive)]" },
  duplicate: { icon: AlertTriangle, color: "text-[var(--warning)]" },
  conflict: { icon: XCircle, color: "text-[var(--destructive)]" },
} as const;

export function HistorySheet({ open, onClose }: HistorySheetProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setHistory(getHistory());
  }, [open]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-30 flex flex-col">
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className="flex-1 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Sheet */}
      <div className="max-h-[70dvh] overflow-hidden rounded-t-2xl bg-[var(--card)] motion-safe:animate-[slideUp_200ms_ease-out]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Scan History
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)]"
            aria-label="Close history"
          >
            <X className="size-5" />
          </button>
        </div>
        {/* List */}
        <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: "calc(70dvh - 52px)" }}>
          {history.length === 0 ? (
            <div className="px-4 py-12 text-center text-xs text-[var(--muted-foreground)]">
              No scans yet this session
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {history.map((entry, i) => {
                const s = STATUS_ICONS[entry.status];
                const Icon = s.icon;
                const time = new Date(entry.timestamp);
                return (
                  <li key={`${entry.ticketCode}-${i}`} className="flex items-center gap-3 px-4 py-3">
                    <Icon className={`size-4 shrink-0 ${s.color}`} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-[var(--foreground)]">
                        {entry.ticketCode}
                      </p>
                    </div>
                    <time className="shrink-0 text-[10px] tabular-nums text-[var(--muted-foreground)]">
                      {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </time>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
