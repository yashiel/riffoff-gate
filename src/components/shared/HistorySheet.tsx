"use client";

import { useEffect, useState, useRef } from "react";
import { X, CheckCircle2, XCircle, AlertTriangle, Search } from "lucide-react";

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
  const [search, setSearch] = useState("");
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setHistory(getHistory());
      setSearch("");
    }
  }, [open]);

  if (!open) return null;

  const filtered = search
    ? history.filter((h) =>
        h.ticketCode.toLowerCase().includes(search.toLowerCase())
      )
    : history;

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
      <div className="max-h-[75dvh] overflow-hidden rounded-t-2xl bg-[var(--card)] motion-safe:animate-[slideUp_200ms_ease-out]">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--card)]">
          <div className="flex items-center justify-between px-4 py-3">
            <h2 className="text-base font-semibold text-[var(--foreground)]">
              Scan History
              <span className="ml-2 text-sm font-normal text-[var(--muted-foreground)]">
                {filtered.length}
              </span>
            </h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)]"
              aria-label="Close history"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Search */}
          {history.length > 0 && (
            <div className="px-4 pb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--muted-foreground)]" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter by ticket code"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--muted)] py-2 pl-9 pr-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none focus:border-[var(--coral)]"
                  autoComplete="off"
                />
              </div>
            </div>
          )}
        </div>

        {/* List */}
        <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: "calc(75dvh - 110px)" }}>
          {filtered.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-[var(--muted-foreground)]">
              {search ? `No scans matching "${search}"` : "No scans yet this session"}
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {filtered.map((entry, i) => {
                const s = STATUS_ICONS[entry.status];
                const Icon = s.icon;
                const time = new Date(entry.timestamp);
                return (
                  <li key={`${entry.ticketCode}-${i}`} className="flex items-center gap-3 px-4 py-3">
                    <Icon className={`size-4 shrink-0 ${s.color}`} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--foreground)]">
                        {entry.ticketCode}
                      </p>
                    </div>
                    <time className="shrink-0 text-sm tabular-nums text-[var(--muted-foreground)]">
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
