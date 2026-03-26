"use client";

import { ScanLine, Clock, Info } from "lucide-react";

export type ActiveSheet = "scan" | "history" | "info";

interface BottomNavProps {
  active: ActiveSheet;
  onChange: (sheet: ActiveSheet) => void;
}

const TABS: { id: ActiveSheet; label: string; icon: typeof ScanLine }[] = [
  { id: "scan", label: "Scan", icon: ScanLine },
  { id: "history", label: "History", icon: Clock },
  { id: "info", label: "Info", icon: Info },
];

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav
      className="flex shrink-0 border-t border-[var(--border)] bg-[var(--card)]"
      role="tablist"
      aria-label="Scanner navigation"
    >
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`flex flex-1 flex-col items-center gap-0.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 transition-colors ${
              isActive
                ? "text-[var(--coral)]"
                : "text-[var(--muted-foreground)]"
            }`}
          >
            <Icon className="size-5" aria-hidden="true" />
            <span className="text-[13px] font-medium">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
