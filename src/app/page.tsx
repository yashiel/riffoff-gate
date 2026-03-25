"use client";

import { useState } from "react";
import { QROnboarding } from "@/components/onboarding/QROnboarding";
import { PINOnboarding } from "@/components/onboarding/PINOnboarding";
import { ScanLine, KeyRound } from "lucide-react";

type Mode = "qr" | "pin";

export default function OnboardingPage() {
  const [mode, setMode] = useState<Mode>("qr");

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6">
      {/* Logo */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight">
          <span className="text-[var(--coral)]">Riff</span>
          <span className="text-[var(--foreground)]/70">Off</span>
          <span className="ml-1.5 text-sm font-medium text-[var(--muted-foreground)]">Gate</span>
        </h1>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          Scan the organiser&apos;s QR to start
        </p>
      </div>

      {/* Mode tabs */}
      <div className="mb-6 flex w-full max-w-sm gap-1 rounded-xl bg-[var(--muted)] p-1">
        <button
          onClick={() => setMode("qr")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
            mode === "qr"
              ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm"
              : "text-[var(--muted-foreground)]"
          }`}
        >
          <ScanLine className="size-3.5" />
          Scan QR
        </button>
        <button
          onClick={() => setMode("pin")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
            mode === "pin"
              ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm"
              : "text-[var(--muted-foreground)]"
          }`}
        >
          <KeyRound className="size-3.5" />
          Enter PIN
        </button>
      </div>

      {/* Onboarding content */}
      <div className="w-full max-w-sm">
        {mode === "qr" ? <QROnboarding /> : <PINOnboarding />}
      </div>
    </div>
  );
}
