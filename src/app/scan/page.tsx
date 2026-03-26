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

export default function ScanPage() {
  const router = useRouter();
  const [session, setSession] = useState<GateSessionData | null>(null);
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>("scan");
  const [scanResult, setScanResult] = useState<ScanResultData | null>(null);
  const [flashStatus, setFlashStatus] = useState<"valid" | "invalid" | null>(null);
  const [checkedIn, setCheckedIn] = useState(0);
  const [total, setTotal] = useState(0);
  const [scanRate, setScanRate] = useState(0);
  // TODO: wire to offline queue length when offline sync is implemented
  const [pendingSync] = useState(0);
  const scanTimesRef = useRef<number[]>([]);
  const flashKeyRef = useRef(0);

  const connectivity = useConnectivity();
  const { playSuccess, playError } = useAudio();
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
        } else {
          playError();
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
          });
        }
      } catch {
        setScanResult({
          status: "invalid",
          reason: connectivity === "offline" ? "No connection" : "Scan failed",
        });
        playError();
        flashKeyRef.current += 1;
        setFlashStatus(null);
        requestAnimationFrame(() => setFlashStatus("invalid"));
      }
    },
    [connectivity, playSuccess, playError, updateRate]
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
        <QRViewport onScan={handleScan} active={activeSheet === "scan"} />
        <BroadcastBanner />
        <ScanResult result={scanResult} onDismiss={handleDismissResult} />
      </div>

      {/* Full-screen flash */}
      <FullScreenFlash key={flashKeyRef.current} status={flashStatus} />

      {/* Stats bar */}
      <ScanStats checkedIn={checkedIn} total={total} />

      {/* Bottom navigation */}
      <BottomNav active={activeSheet} onChange={setActiveSheet} />

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
