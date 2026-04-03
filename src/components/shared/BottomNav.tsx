"use client";

import { ScanLine, Clock, Info, Keyboard, LogOut } from "lucide-react";

export type ActiveSheet = "scan" | "history" | "info";

interface BottomNavProps {
  active: ActiveSheet;
  onChange: (sheet: ActiveSheet) => void;
  onManualEntry?: () => void;
  showManualEntry?: boolean;
  onLogout?: () => void;
}

export function BottomNav({
  active,
  onChange,
  onManualEntry,
  showManualEntry,
  onLogout,
}: BottomNavProps) {
  return (
    <nav
      className="flex shrink-0 items-stretch border-t border-[var(--border)] bg-[var(--card)]"
      role="tablist"
      aria-label="Scanner navigation"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {/* Scan */}
      <button
        role="tab"
        aria-selected={active === "scan"}
        onClick={() => onChange("scan")}
        className={`flex flex-1 flex-col items-center gap-0.5 pb-2 pt-2.5 transition-colors ${
          active === "scan"
            ? "text-[var(--coral)]"
            : "text-[var(--muted-foreground)]"
        }`}
      >
        <ScanLine className="size-5" aria-hidden="true" />
        <span className="text-xs font-medium">Scan</span>
      </button>

      {/* Manual entry toggle */}
      {onManualEntry && (
        <button
          onClick={onManualEntry}
          className={`flex flex-1 flex-col items-center gap-0.5 pb-2 pt-2.5 transition-colors ${
            showManualEntry
              ? "text-[var(--coral)]"
              : "text-[var(--muted-foreground)]"
          }`}
          aria-label="Enter ticket code manually"
        >
          <Keyboard className="size-5" aria-hidden="true" />
          <span className="text-xs font-medium">Manual</span>
        </button>
      )}

      {/* History */}
      <button
        role="tab"
        aria-selected={active === "history"}
        onClick={() => onChange("history")}
        className={`flex flex-1 flex-col items-center gap-0.5 pb-2 pt-2.5 transition-colors ${
          active === "history"
            ? "text-[var(--coral)]"
            : "text-[var(--muted-foreground)]"
        }`}
      >
        <Clock className="size-5" aria-hidden="true" />
        <span className="text-xs font-medium">History</span>
      </button>

      {/* Info */}
      <button
        role="tab"
        aria-selected={active === "info"}
        onClick={() => onChange("info")}
        className={`flex flex-1 flex-col items-center gap-0.5 pb-2 pt-2.5 transition-colors ${
          active === "info"
            ? "text-[var(--coral)]"
            : "text-[var(--muted-foreground)]"
        }`}
      >
        <Info className="size-5" aria-hidden="true" />
        <span className="text-xs font-medium">Info</span>
      </button>

      {/* Disconnect — always visible */}
      {onLogout && (
        <button
          onClick={() => {
            if (window.confirm("Disconnect from this scanner session?")) {
              onLogout();
            }
          }}
          className="flex flex-1 flex-col items-center gap-0.5 pb-2 pt-2.5 text-red-400 transition-colors active:text-red-300"
          aria-label="Disconnect scanner"
        >
          <LogOut className="size-5" aria-hidden="true" />
          <span className="text-xs font-medium">Exit</span>
        </button>
      )}
    </nav>
  );
}
