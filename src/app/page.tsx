"use client";

import { useState, useEffect } from "react";
import { QROnboarding } from "@/components/onboarding/QROnboarding";
import { PINOnboarding } from "@/components/onboarding/PINOnboarding";
import { ScanLine, KeyRound } from "lucide-react";
import { Logo } from "@/components/shared/Logo";

type Mode = "qr" | "pin";

export default function OnboardingPage() {
  const [mode, setMode] = useState<Mode>("qr");
  const [mounted, setMounted] = useState(false);

  // Wait for client mount to avoid hydration mismatch from browser extensions
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#050507]">
        <div className="size-8 animate-spin rounded-full border-2 border-[#bfff00]/20 border-t-[#bfff00]" />
      </div>
    );
  }

  return (
    <div className="relative min-h-[100dvh]">
      {/* Ambient background */}
      <div className="gate-bg" />

      <div className="relative z-10 flex min-h-[100dvh] flex-col items-center justify-center px-5">
        {/* Logo */}
        <div className="mb-10 flex flex-col items-center gap-3 animate-fade-in">
          <div className="flex items-center gap-2.5">
            <Logo height={30} className="text-[var(--foreground)]" />
            <span className="rounded-md border border-[var(--coral)]/20 bg-[var(--coral)]/5 px-2.5 py-1 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--coral)]">
              Gate
            </span>
          </div>
          <p className="text-[15px] text-[var(--muted-foreground)]">
            Venue check-in terminal
          </p>
        </div>

        {/* Main card */}
        <div
          className="glass-card w-full max-w-[380px] rounded-2xl p-5 animate-fade-in"
          style={{ animationDelay: "0.1s" }}
        >
          {/* Mode tabs */}
          <div
            role="tablist"
            className="tab-container mb-5 flex gap-1 rounded-xl p-1"
          >
            <button
              role="tab"
              type="button"
              aria-selected={mode === "qr"}
              onClick={() => setMode("qr")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg min-h-[44px] py-3 text-sm font-semibold uppercase tracking-[0.15em] transition-all duration-200 ${
                mode === "qr" ? "tab-active" : "tab-inactive"
              }`}
            >
              <ScanLine className="size-4" />
              Scan QR
            </button>
            <button
              role="tab"
              type="button"
              aria-selected={mode === "pin"}
              onClick={() => setMode("pin")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg min-h-[44px] py-3 text-sm font-semibold uppercase tracking-[0.15em] transition-all duration-200 ${
                mode === "pin" ? "tab-active" : "tab-inactive"
              }`}
            >
              <KeyRound className="size-4" />
              Enter PIN
            </button>
          </div>

          {/* Content */}
          <div className="w-full">
            {mode === "qr" ? <QROnboarding /> : <PINOnboarding />}
          </div>
        </div>

        {/* Footer */}
        <p
          className="mt-8 text-sm uppercase tracking-[0.2em] text-[var(--muted-foreground)]/50 animate-fade-in"
          style={{ animationDelay: "0.2s" }}
        >
          Powered by RiffOff
        </p>
      </div>
    </div>
  );
}
