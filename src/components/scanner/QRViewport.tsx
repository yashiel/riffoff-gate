"use client";

import { useEffect, useRef, useCallback, useState } from "react";

interface QRViewportProps {
  onScan: (decodedText: string) => void;
  active: boolean;
}

/**
 * High-performance QR scanner viewport.
 *
 * Strategy:
 * - iOS/Desktop with BarcodeDetector: native video + BarcodeDetector (fastest)
 * - Android / no BarcodeDetector: html5-qrcode (handles Android video quirks)
 *
 * Android Chrome has a known compositing bug where <video> elements with
 * absolute positioning + object-cover render black even when the stream is
 * playing. html5-qrcode manages its own video element with Android-safe settings.
 *
 * Security:
 * - Debounce: same QR ignored for 3 seconds (prevents double-scan)
 * - Session auth: check-in API validates httpOnly session cookie
 * - Input validation: API validates ticketId format
 * - Rate limiting: server-side rate limits per session
 */

function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent);
}

export function QRViewport({ onScan, active }: QRViewportProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const lastScanRef = useRef<string>("");
  const lastScanTimeRef = useRef<number>(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [useLibScanner, setUseLibScanner] = useState(false);
  const fallbackScannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);

  // Debounced scan handler — prevents double-scans of same ticket
  const handleScan = useCallback(
    (decodedText: string) => {
      if (!decodedText || decodedText.length < 3) return;

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

  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (fallbackScannerRef.current) {
      fallbackScannerRef.current.stop().catch(() => {});
      try { fallbackScannerRef.current.clear(); } catch { /* */ }
      fallbackScannerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!active) {
      stopCamera();
      setCameraReady(false);
      return;
    }

    let cancelled = false;

    async function initScanner() {
      try {
        const android = isAndroid();
        const hasBarcodeDetector = "BarcodeDetector" in window;

        // Android Chrome: always use html5-qrcode (handles video element quirks)
        // Non-Android with BarcodeDetector: use native path (fastest)
        // No BarcodeDetector: use html5-qrcode
        const useNative = hasBarcodeDetector && !android;

        if (useNative) {
          // ── Native BarcodeDetector (iOS Safari 17.2+, Desktop Chrome) ──
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: "environment",
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          });

          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }

          streamRef.current = stream;

          if (videoRef.current) {
            const video = videoRef.current;
            video.srcObject = stream;

            await new Promise<void>((resolve, reject) => {
              const onLoaded = () => {
                video.removeEventListener("loadedmetadata", onLoaded);
                video.removeEventListener("error", onError);
                resolve();
              };
              const onError = () => {
                video.removeEventListener("loadedmetadata", onLoaded);
                video.removeEventListener("error", onError);
                reject(new Error("Video failed to load"));
              };
              if (video.readyState >= 1) {
                resolve();
              } else {
                video.addEventListener("loadedmetadata", onLoaded);
                video.addEventListener("error", onError);
              }
            });

            if (cancelled) return;
            await video.play();
          }

          setCameraReady(true);
          scanningRef.current = true;

          const detector = new (
            window as unknown as {
              BarcodeDetector: new (opts: { formats: string[] }) => {
                detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
              };
            }
          ).BarcodeDetector({ formats: ["qr_code"] });

          const scanLoop = async () => {
            if (!scanningRef.current || !videoRef.current || cancelled) return;

            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes.length > 0 && barcodes[0].rawValue) {
                handleScan(barcodes[0].rawValue);
              }
            } catch {
              // Frame detection failed — continue
            }

            if (scanningRef.current && !cancelled) {
              requestAnimationFrame(scanLoop);
            }
          };

          requestAnimationFrame(scanLoop);
        } else {
          // ── html5-qrcode (Android + Firefox + older browsers) ──
          // This library manages its own video element with proper
          // Android-compatible settings (no compositing black screen).
          setUseLibScanner(true);

          const { Html5Qrcode } = await import("html5-qrcode");
          const containerId = "qr-scanner-region";

          // Wait for container to be in the DOM after state update
          await new Promise((r) => setTimeout(r, 50));
          if (cancelled) return;

          const el = document.getElementById(containerId);
          if (!el) return;

          const scanner = new Html5Qrcode(containerId, { verbose: false });
          fallbackScannerRef.current = scanner as unknown as typeof fallbackScannerRef.current;

          await scanner.start(
            { facingMode: "environment" },
            { fps: 15, qrbox: { width: 250, height: 250 } },
            (text) => handleScan(text),
            () => {}
          );

          setCameraReady(true);
          scanningRef.current = true;
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message.toLowerCase() : "";
        if (msg.includes("permission") || msg.includes("notallowed") || msg.includes("not allowed")) {
          setPermissionDenied(true);
        } else {
          setPermissionDenied(true);
        }
      }
    }

    initScanner();

    return () => {
      cancelled = true;
      stopCamera();
      setCameraReady(false);
    };
  }, [active, handleScan, stopCamera]);

  return (
    <div ref={containerRef} className="relative flex-1 overflow-hidden bg-black">
      {/* Native video element (iOS/Desktop only) */}
      {!useLibScanner && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
          autoPlay
        />
      )}

      {/* html5-qrcode container (Android + fallback) */}
      {useLibScanner && (
        <div
          id="qr-scanner-region"
          style={{ width: "100%", height: "100%" }}
        />
      )}

      {/* Loading state */}
      {!cameraReady && !permissionDenied && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="size-8 animate-spin rounded-full border-2 border-[var(--muted-foreground)] border-t-[var(--coral)]" />
            <p className="text-sm text-[var(--muted-foreground)]">
              Starting camera...
            </p>
          </div>
        </div>
      )}

      {/* Permission denied */}
      {permissionDenied && (
        <div className="absolute inset-0 z-10 flex items-center justify-center px-8">
          <div className="text-center">
            <p className="text-base font-medium text-[var(--foreground)]">
              Camera access required
            </p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Allow camera permission in your browser settings to scan tickets.
            </p>
          </div>
        </div>
      )}

      {/* Scan overlay — crosshair guides (native path only, html5-qrcode has its own UI) */}
      {cameraReady && !useLibScanner && (
        <div className="absolute inset-0 z-10 pointer-events-none">
          {/* Center scan zone indicator */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="size-[200px] sm:size-[240px] relative">
              {/* Corner brackets */}
              <div className="absolute top-0 left-0 size-6 border-t-2 border-l-2 border-[var(--coral)] rounded-tl-lg" />
              <div className="absolute top-0 right-0 size-6 border-t-2 border-r-2 border-[var(--coral)] rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 size-6 border-b-2 border-l-2 border-[var(--coral)] rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 size-6 border-b-2 border-r-2 border-[var(--coral)] rounded-br-lg" />
              {/* Animated scan line */}
              <div className="absolute left-2 right-2 h-0.5 bg-[var(--coral)]/60 animate-[scanline_2s_ease-in-out_infinite]" />
            </div>
          </div>
          {/* Dim surrounding area */}
          <div className="absolute inset-0 bg-black/30" style={{
            maskImage: "radial-gradient(circle 120px at center, transparent 100%, black 100%)",
            WebkitMaskImage: "radial-gradient(circle 120px at center, transparent 100%, black 100%)",
          }} />
        </div>
      )}
    </div>
  );
}
