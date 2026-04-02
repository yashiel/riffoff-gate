"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, RefreshCw, ShieldAlert } from "lucide-react";
import { setSession, getDeviceId } from "@/lib/session/store";
import { gateApi } from "@/lib/api/client";

type ScanState =
  | "initializing"
  | "scanning"
  | "processing"
  | "error"
  | "permission-denied";

function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent);
}

export function QROnboarding() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const fallbackScannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const [state, setState] = useState<ScanState>("initializing");
  const [errorMessage, setErrorMessage] = useState("");
  const [useLibScanner, setUseLibScanner] = useState(false);
  const mountedRef = useRef(true);

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

  const handleDecode = useCallback(
    async (decodedText: string) => {
      if (!mountedRef.current) return;

      stopCamera();
      setState("processing");

      try {
        const deviceId = getDeviceId();

        let pin = decodedText;
        const gateId = "default";

        if (decodedText.startsWith("RO:")) {
          pin = decodedText.slice(3);
        } else {
          try {
            const parsed = JSON.parse(decodedText);
            if (parsed.p) pin = parsed.p;
          } catch {
            // Use raw text as PIN
          }
        }

        const res = await gateApi("/api/gate/auth/pin", {
          method: "POST",
          body: JSON.stringify({ pin, gateId, deviceId }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            (data as { error?: string }).error || "Failed to authenticate"
          );
        }

        const session = await res.json();
        setSession(session);
        router.push("/scan");
      } catch (err) {
        if (!mountedRef.current) return;
        setState("error");
        setErrorMessage(
          err instanceof Error ? err.message : "Connection failed. Please try again."
        );
      }
    },
    [router, stopCamera]
  );

  const startScanner = useCallback(async () => {
    setState("initializing");
    setErrorMessage("");

    try {
      const android = isAndroid();
      const hasBarcodeDetector = "BarcodeDetector" in window;
      const useNative = hasBarcodeDetector && !android;

      if (useNative) {
        // ── Native path (iOS/Desktop) ──
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        });

        if (!mountedRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          const video = videoRef.current;
          video.srcObject = stream;

          await new Promise<void>((resolve, reject) => {
            const onLoaded = () => { video.removeEventListener("loadedmetadata", onLoaded); video.removeEventListener("error", onError); resolve(); };
            const onError = () => { video.removeEventListener("loadedmetadata", onLoaded); video.removeEventListener("error", onError); reject(new Error("Video failed")); };
            if (video.readyState >= 1) resolve();
            else { video.addEventListener("loadedmetadata", onLoaded); video.addEventListener("error", onError); }
          });

          if (!mountedRef.current) return;
          await video.play();
        }

        setState("scanning");
        scanningRef.current = true;

        const detector = new (window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector({
          formats: ["qr_code"],
        });

        const scanLoop = async () => {
          if (!scanningRef.current || !videoRef.current || !mountedRef.current) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0) {
              scanningRef.current = false;
              void handleDecode(barcodes[0].rawValue);
              return;
            }
          } catch { /* continue */ }
          if (scanningRef.current) requestAnimationFrame(scanLoop);
        };

        requestAnimationFrame(scanLoop);
      } else {
        // ── html5-qrcode path (Android + Firefox + older browsers) ──
        setUseLibScanner(true);

        const { Html5Qrcode } = await import("html5-qrcode");

        // Wait for container to mount after state update
        await new Promise((r) => setTimeout(r, 50));
        if (!mountedRef.current) return;

        const el = document.getElementById("qr-onboard-region");
        if (!el) return;

        const scanner = new Html5Qrcode("qr-onboard-region", { verbose: false });
        fallbackScannerRef.current = scanner as unknown as typeof fallbackScannerRef.current;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 15, qrbox: { width: 220, height: 220 } },
          (text) => {
            scanningRef.current = false;
            scanner.stop().catch(() => {});
            void handleDecode(text);
          },
          () => {}
        );

        setState("scanning");
        scanningRef.current = true;
      }
    } catch (err) {
      if (!mountedRef.current) return;

      const message = err instanceof Error ? err.message.toLowerCase() : "";
      if (
        message.includes("permission") ||
        message.includes("notallowed") ||
        message.includes("not allowed")
      ) {
        setState("permission-denied");
      } else {
        setState("error");
        setErrorMessage(
          message.includes("timed out") || message.includes("overconstrained")
            ? "Camera not available. Try using PIN entry instead."
            : "Failed to start camera. Please check your device settings."
        );
      }
    }
  }, [handleDecode]);

  useEffect(() => {
    mountedRef.current = true;
    void startScanner();

    return () => {
      mountedRef.current = false;
      stopCamera();
    };
  }, [startScanner, stopCamera]);

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Camera viewport */}
      <div className="qr-viewport w-full aspect-[4/3] max-h-[320px] rounded-2xl relative overflow-hidden bg-black">
        {/* Corner brackets */}
        <div className="qr-corner-tr" />
        <div className="qr-corner-bl" />

        {/* Scan line animation (native path only) */}
        {state === "scanning" && !useLibScanner && <div className="qr-scanline" />}

        {/* Native video element (iOS/Desktop) */}
        {!useLibScanner && (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover rounded-2xl"
            playsInline
            muted
            autoPlay
          />
        )}

        {/* html5-qrcode container (Android + fallback) */}
        {useLibScanner && (
          <div
            id="qr-onboard-region"
            className="absolute inset-0 rounded-2xl overflow-hidden"
          />
        )}

        {/* Overlay for non-scanning states */}
        {state !== "scanning" && state !== "initializing" && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/60 z-20" />
        )}
      </div>

      {/* Status messages */}
      <div className="min-h-[56px] flex flex-col items-center justify-center">
        {state === "initializing" && (
          <div className="flex items-center gap-2.5">
            <div className="size-4 rounded-full gate-spinner animate-spin" />
            <span className="text-base text-[var(--muted-foreground)]">
              Starting camera...
            </span>
          </div>
        )}

        {state === "scanning" && (
          <div className="status-badge text-[var(--coral)]">
            Scanning — point at gate QR code
          </div>
        )}

        {state === "processing" && (
          <div className="flex items-center gap-2.5">
            <div className="size-4 rounded-full gate-spinner animate-spin" />
            <span className="text-base text-[var(--coral)]">
              Creating session...
            </span>
          </div>
        )}

        {state === "permission-denied" && (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex items-center gap-2 text-[var(--warning)]">
              <ShieldAlert className="size-4" />
              <span className="text-base font-medium">Camera access needed</span>
            </div>
            <p className="text-sm text-[var(--muted-foreground)] max-w-[260px]">
              Check your browser settings and grant camera permission
            </p>
            <button
              type="button"
              onClick={() => void startScanner()}
              className="btn-retry min-h-[44px] px-5 rounded-xl text-base font-medium flex items-center gap-2"
            >
              <RefreshCw className="size-3.5" />
              Retry
            </button>
          </div>
        )}

        {state === "error" && (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-base text-[var(--destructive)] flex items-center gap-2">
              <Camera className="size-3.5 shrink-0" />
              {errorMessage}
            </p>
            <button
              type="button"
              onClick={() => void startScanner()}
              className="btn-retry min-h-[44px] px-5 rounded-xl text-base font-medium flex items-center gap-2"
            >
              <RefreshCw className="size-3.5" />
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
