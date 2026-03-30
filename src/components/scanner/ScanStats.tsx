"use client";

import { Users, TrendingUp } from "lucide-react";

interface ScanStatsProps {
  checkedIn: number;
  total: number;
}

export function ScanStats({ checkedIn, total }: ScanStatsProps) {
  const percentage = total > 0 ? ((checkedIn / total) * 100).toFixed(1) : "0.0";
  const progressWidth = total > 0 ? Math.min((checkedIn / total) * 100, 100) : 0;

  return (
    <div className="shrink-0 border-t border-[var(--border)] bg-[var(--card)] px-4 py-2.5">
      {/* Stats row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="size-3.5 text-[var(--muted-foreground)]" />
          <span className="font-mono text-base font-bold tabular-nums text-[var(--foreground)]">
            {checkedIn.toLocaleString()}
          </span>
          <span className="text-sm text-[var(--muted-foreground)]">
            / {total.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingUp className="size-3.5 text-[var(--success)]" />
          <span className="font-mono text-sm font-semibold tabular-nums text-[var(--foreground)]">
            {percentage}%
          </span>
          {total > 0 && checkedIn / total >= 0.9 && (
            <span className="rounded-full bg-[#f59e0b]/15 px-2 py-0.5 text-xs font-semibold text-[#f59e0b]">
              NEAR CAPACITY
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--muted)]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--coral)] to-[var(--success)] transition-[width] duration-500 ease-out"
          style={{ width: `${progressWidth}%` }}
        />
      </div>
    </div>
  );
}
