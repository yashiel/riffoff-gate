"use client";

interface ScanStatsProps {
  checkedIn: number;
  total: number;
}

export function ScanStats({ checkedIn, total }: ScanStatsProps) {
  const percentage = total > 0 ? ((checkedIn / total) * 100).toFixed(1) : "0.0";
  const progressWidth = total > 0 ? Math.min((checkedIn / total) * 100, 100) : 0;

  return (
    <div className="shrink-0 border-t border-[var(--border)] bg-[var(--card)] px-4 py-3">
      <div className="flex items-center justify-between text-[13px]">
        <span className="font-semibold tabular-nums text-[var(--foreground)]">
          {checkedIn.toLocaleString()} / {total.toLocaleString()}
        </span>
        <span className="text-[var(--muted-foreground)]">{percentage}%</span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--muted)]">
        <div
          className="h-full rounded-full bg-[var(--success)] transition-[width] duration-300"
          style={{ width: `${progressWidth}%` }}
        />
      </div>
    </div>
  );
}
