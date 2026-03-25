"use client";

import { useEffect, useRef, useCallback, useState } from "react";

interface QRViewportProps {
  onScan: (decodedText: string) => void;
  active: boolean;
}

export function QRViewport({ onScan, active }: QRViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<unknown>(null);
  const lastScanRef = useRef<string>("");
  const lastScanTimeRef = useRef<number>(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const handleScan = useCallback(
    (decodedText: string) => {
      const now = Date.now();
      if (
        decodedText === lastScanRef.current &&
        now - lastScanTimeRef.current < 3000
      ) {
        return;
      }
      lastScanRef.current = decodedText;
      lastScanTimeRef.current = now;
      onScan(decodedText);
    },
    [onScan]
  );

  useEffect(() => {
    if (!active || !containerRef.current) return;

    let html5QrCode: {
      start: (
        cameraId: { facingMode: string },
        config: { fps: number; qrbox: { width: number; height: number } },
        onSuccess: (text: string) => void,
        onError: () => void
      ) => Promise<void>;
      stop: () => Promise<void>;
      clear: () => void;
    } | null = null;

    async function initScanner() {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const scannerId = "qr-scanner-region";

        if (!document.getElementById(scannerId)) {
          const el = document.createElement("div");
          el.id = scannerId;
          containerRef.current?.appendChild(el);
        }

        html5QrCode = new Html5Qrcode(scannerId) as unknown as typeof html5QrCode;
        scannerRef.current = html5QrCode;

        await html5QrCode!.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          handleScan,
          () => {}
        );
        setCameraReady(true);
      } catch {
        setPermissionDenied(true);
      }
    }

    initScanner();

    return () => {
      if (html5QrCode) {
        html5QrCode.stop().catch(() => {});
        html5QrCode.clear();
      }
      scannerRef.current = null;
      setCameraReady(false);
    };
  }, [active, handleScan]);

  return (
    <div className="relative flex-1 overflow-hidden bg-black" ref={containerRef}>
      {!cameraReady && !permissionDenied && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="size-8 animate-spin rounded-full border-2 border-[var(--muted-foreground)] border-t-[var(--coral)]" />
            <p className="text-xs text-[var(--muted-foreground)]">
              Starting camera...
            </p>
          </div>
        </div>
      )}
      {permissionDenied && (
        <div className="absolute inset-0 z-10 flex items-center justify-center px-8">
          <div className="text-center">
            <p className="text-sm font-medium text-[var(--foreground)]">
              Camera access required
            </p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Allow camera permission in your browser settings to scan tickets.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
