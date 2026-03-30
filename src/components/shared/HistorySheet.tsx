"use client";

import { useEffect, useState, useRef } from "react";
import { X, CheckCircle2, XCircle, AlertTriangle, Zap, Search } from "lucide-react";

interface HistoryEntry {
  ticketCode: string;
  status: "valid" | "invalid" | "duplicate" | "conflict";
  timestamp: string;
  attendeeName?: string;
  tierName?: string;
  reason?: string;
}

interface HistorySheetProps {
  open: boolean;
  onClose: () => void;
}

type FilterTab = "all" | "valid" | "failed" | "duplicate";

const HISTORY_KEY = "riffoff-gate-scan-history";
const MAX_HISTORY = 100;

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

const STATUS_CONFIG = {
  valid: { icon: CheckCircle2, color: "text-emerald-400", border: "border-l-emerald-500", bg: "bg-emerald-500" },
  invalid: { icon: XCircle, color: "text-red-400", border: "border-l-red-500", bg: "bg-red-500" },
  duplicate: { icon: AlertTriangle, color: "text-amber-400", border: "border-l-amber-500", bg: "bg-amber-500" },
  conflict: { icon: Zap, color: "text-orange-400", border: "border-l-orange-500", bg: "bg-orange-500" },
} as const;

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "valid", label: "Valid" },
  { key: "failed", label: "Failed" },
  { key: "duplicate", label: "Duplicate" },
];

function matchesFilter(entry: HistoryEntry, filter: FilterTab): boolean {
  if (filter === "all") return true;
  if (filter === "valid") return entry.status === "valid";
  if (filter === "failed") return entry.status === "invalid" || entry.status === "conflict";
  if (filter === "duplicate") return entry.status === "duplicate";
  return true;
}

function TierBadge({ tier }: { tier?: string }) {
  if (!tier) return null;
  const lower = tier.toLowerCase();
  const isVip = lower.includes("vip");
  const isEarly = lower.includes("early");
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        isVip
          ? "bg-[#fef3c7] text-[#b8860b]"
          : isEarly
            ? "bg-[#dbeafe] text-[#1e40af]"
            : "bg-[#f3f4f6] text-[#374151]"
      }`}
    >
      {tier}
    </span>
  );
}

export function HistorySheet({ open, onClose }: HistorySheetProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setHistory(getHistory());
      setSearch("");
      setActiveFilter("all");
    }
  }, [open]);

  if (!open) return null;

  const filtered = history.filter((h) => {
    if (!matchesFilter(h, activeFilter)) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        h.ticketCode.toLowerCase().includes(q) ||
        (h.attendeeName?.toLowerCase().includes(q) ?? false) ||
        (h.tierName?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  const filterLabel = activeFilter === "all" ? "Scan History" : FILTER_TABS.find((t) => t.key === activeFilter)?.label ?? "Scan History";
  const countLabel =
    activeFilter === "all"
      ? `${filtered.length} scan${filtered.length !== 1 ? "s" : ""}`
      : `${filtered.length} of ${history.length}`;

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
              {filterLabel}
              <span className="ml-2 text-sm font-normal text-[var(--muted-foreground)]">
                {countLabel}
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

          {/* Filter Tabs */}
          <div className="flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-none">
            {FILTER_TABS.map((tab) => {
              const isActive = activeFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveFilter(tab.key)}
                  className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-[var(--coral)]/10 text-[var(--coral)]"
                      : "text-[var(--muted-foreground)] hover:bg-white/5"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
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
                  placeholder="Search name, code, or tier..."
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--muted)] py-2 pl-9 pr-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none focus:border-[var(--coral)]"
                  autoComplete="off"
                />
              </div>
            </div>
          )}
        </div>

        {/* List */}
        <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: "calc(75dvh - 160px)" }}>
          {filtered.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-[var(--muted-foreground)]">
              {search
                ? `No scans matching "${search}"`
                : activeFilter !== "all"
                  ? `No ${activeFilter} scans yet`
                  : "No scans yet this session"}
            </div>
          ) : (
            <div className="flex flex-col gap-2 p-4">
              {filtered.map((entry, i) => {
                const config = STATUS_CONFIG[entry.status];
                const Icon = config.icon;
                const time = new Date(entry.timestamp);
                const timeStr = time.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

                return (
                  <div
                    key={`${entry.ticketCode}-${i}`}
                    className={`flex items-start gap-3 rounded-lg border-l-[3px] bg-white/5 px-3 py-2.5 ${config.border}`}
                  >
                    <Icon className={`mt-0.5 size-4 shrink-0 ${config.color}`} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                        {entry.attendeeName || "Unknown"}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <TierBadge tier={entry.tierName} />
                        <span className="font-mono text-xs text-[var(--muted-foreground)]">
                          {entry.ticketCode}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <time className="text-xs tabular-nums text-[var(--muted-foreground)]">
                          {timeStr}
                        </time>
                        {entry.reason && (
                          <span className="truncate text-xs text-amber-400/80">
                            {entry.reason}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
