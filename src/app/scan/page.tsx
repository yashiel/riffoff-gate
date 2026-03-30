"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { QRViewport } from "@/components/scanner/QRViewport";
import { ScanResult } from "@/components/scanner/ScanResult";
import type { ScanResultData } from "@/components/scanner/ScanResult";
import { ScanStats } from "@/components/scanner/ScanStats";
import { FullScreenFlash } from "@/components/scanner/FullScreenFlash";
import { StatusBar } from "@/components/shared/StatusBar";
import { BroadcastBanner } from "@/components/shared/BroadcastBanner";
import { BottomNav } from "@/components/shared/BottomNav";
import type { ActiveSheet } from "@/components/shared/BottomNav";
import { HistorySheet, addToHistory } from "@/components/shared/HistorySheet";
import { InfoSheet } from "@/components/shared/InfoSheet";
import { getSession, clearSession } from "@/lib/session/store";
import type { GateSessionData } from "@/lib/session/store";
import { gateApi } from "@/lib/api/client";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { useAudio } from "@/hooks/use-audio";
import { useConnectivity } from "@/hooks/use-connectivity";
import { AlertTriangle } from "lucide-react";

const SCAN_RESULT_DISMISS_MS = 5000;

export default function ScanPage() {
  const router = useRouter();
  const [session, setSession] = useState<GateSessionData | null>(null);
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>("scan");
  const [scanResult, setScanResult] = useState<ScanResultData | null>(null);
  const [flashStatus, setFlashStatus] = useState<"valid" | "invalid" | null>(null);
  const [checkedIn, setCheckedIn] = useState(0);
  const [total, setTotal] = useState(0);
  const [scanRate, setScanRate] = useState(0);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState("");
  // TODO: wire to offline queue length when offline sync is implemented
  const [pendingSync] = useState(0);
  const scanTimesRef = useRef<number[]>([]);
  const flashKeyRef = useRef(0);
  const manualInputRef = useRef<HTMLInputElement>(null);

  const [emergencyActive, setEmergencyActive] = useState(false);

  const connectivity = useConnectivity();
  const { playSuccess, playDenied, playDuplicate } = useAudio();
  useWakeLock();

  // Check session on mount
  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.replace("/");
      return;
    }
    setSession(s);
  }, [router]);

  // Calculate scan rate (scans per minute over last 60s)
  const updateRate = useCallback(() => {
    const now = Date.now();
    const cutoff = now - 60_000;
    scanTimesRef.current = scanTimesRef.current.filter((t) => t > cutoff);
    setScanRate(scanTimesRef.current.length);
  }, []);

  const handleScan = useCallback(
    async (decodedText: string) => {
      try {
        const res = await gateApi("/api/gate/checkin", {
          method: "POST",
          body: JSON.stringify({
            ticketId: decodedText,
            scannedAt: new Date().toISOString(),
          }),
        });

        const data = await res.json();

        const result: ScanResultData = {
          status: data.status ?? (res.ok ? "valid" : "invalid"),
          ticketCode: data.ticketCode ?? decodedText.slice(0, 12),
          attendeeName: data.attendeeName,
          tierName: data.tierName,
          reason: data.reason,
          attendeePhotoUrl: data.attendeePhotoUrl ?? null,
          seatInfo: data.seatInfo ?? null,
          firstScannedAt: data.firstScannedAt ?? null,
          firstScannedByGate: data.firstScannedByGate ?? null,
        };

        setScanResult(result);

        // Flash
        const flashType = result.status === "valid" ? "valid" : "invalid";
        flashKeyRef.current += 1;
        setFlashStatus(null);
        requestAnimationFrame(() => setFlashStatus(flashType));

        // Audio + haptics
        if (result.status === "valid") {
          playSuccess();
          setCheckedIn((prev) => prev + 1);
        } else if (result.status === "duplicate") {
          playDuplicate();
        } else {
          playDenied();
        }

        // Update stats from API response
        if (data.checkedIn != null) setCheckedIn(data.checkedIn);
        if (data.total != null) setTotal(data.total);

        // Track scan time for rate
        scanTimesRef.current.push(Date.now());
        updateRate();

        // Add to history
        if (result.status) {
          addToHistory({
            ticketCode: result.ticketCode ?? decodedText.slice(0, 12),
            status: result.status as "valid" | "invalid" | "duplicate" | "conflict",
            timestamp: new Date().toISOString(),
            attendeeName: result.attendeeName,
            tierName: result.tierName,
            reason: result.reason,
          });
        }
      } catch {
        setScanResult({
          status: "invalid",
          reason: connectivity === "offline" ? "No connection" : "Scan failed",
        });
        playDenied();
        flashKeyRef.current += 1;
        setFlashStatus(null);
        requestAnimationFrame(() => setFlashStatus("invalid"));
      }
    },
    [connectivity, playSuccess, playDenied, playDuplicate, updateRate]
  );

  const handleManualSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const code = manualCode.trim();
      if (!code) return;
      setManualCode("");
      setShowManualEntry(false);
      handleScan(code);
    },
    [manualCode, handleScan]
  );

  const handleDismissResult = useCallback(() => {
    setScanResult(null);
  }, []);

  const handleLogout = useCallback(async () => {
    // Notify server to revoke session (removes from Gate Control device list)
    try {
      await gateApi("/api/gate/logout", { method: "POST" });
    } catch { /* still logout locally */ }
    clearSession();
    router.replace("/");
  }, [router]);

  // Don't render until session is verified
  if (!session) return null;

  return (
    <>
      {/* Status bar */}
      <StatusBar
        status={connectivity}
        gateName={session.gateName}
        rate={scanRate}
        pendingSync={pendingSync}
      />

      {/* Camera viewport */}
      <div className="relative flex-1 overflow-hidden">
        <QRViewport
          onScan={handleScan}
          active={activeSheet === "scan" && !emergencyActive}
        />
        <BroadcastBanner onEmergency={setEmergencyActive} />
        <ScanResult result={scanResult} onDismiss={handleDismissResult} dismissMs={SCAN_RESULT_DISMISS_MS} />

        {/* Emergency overlay — pauses scanning */}
        {emergencyActive && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-red-950/60 backdrop-blur-[2px]">
            <div className="flex flex-col items-center gap-2 text-white">
              <AlertTriangle className="size-10 text-[#ef4444] animate-pulse" />
              <p className="text-lg font-bold uppercase tracking-wider">
                Scanning Paused
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Full-screen flash */}
      <FullScreenFlash key={flashKeyRef.current} status={flashStatus} />

      {/* Manual code entry (toggleable) */}
      {showManualEntry && (
        <div className="border-t border-[var(--border)] bg-[var(--card)] px-3 py-2 motion-safe:animate-[slideUp_150ms_ease-out]">
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              ref={manualInputRef}
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              placeholder="RIFF-XXXXXX or ticket code"
              className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--muted)] px-3 py-2.5 font-mono text-sm uppercase text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] placeholder:normal-case outline-none focus:border-[var(--coral)]"
              autoComplete="off"
              spellCheck={false}
              autoFocus
            />
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="shrink-0 rounded-lg bg-[var(--coral)] px-4 py-2.5 text-sm font-bold text-black transition-colors disabled:opacity-40"
            >
              Check In
            </button>
          </form>
        </div>
      )}

      {/* Stats bar */}
      <ScanStats checkedIn={checkedIn} total={total} />

      {/* Bottom navigation + manual entry toggle + disconnect */}
      <BottomNav
        active={activeSheet}
        onChange={setActiveSheet}
        onManualEntry={() => {
          setShowManualEntry(!showManualEntry);
          if (!showManualEntry) {
            setTimeout(() => manualInputRef.current?.focus(), 100);
          }
        }}
        showManualEntry={showManualEntry}
        onLogout={handleLogout}
      />

      {/* Sheets */}
      <HistorySheet
        open={activeSheet === "history"}
        onClose={() => setActiveSheet("scan")}
      />
      <InfoSheet
        open={activeSheet === "info"}
        onClose={() => setActiveSheet("scan")}
        onLogout={handleLogout}
        session={session}
      />
    </>
  );
}
