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

export function QROnboarding() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const [state, setState] = useState<ScanState>("initializing");
  const [errorMessage, setErrorMessage] = useState("");
  const mountedRef = useRef(true);

  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const handleDecode = useCallback(
    async (decodedText: string) => {
      if (!mountedRef.current) return;

      stopCamera();
      setState("processing");

      try {
        const deviceId = getDeviceId();

        // Parse QR: "RO:PIN" format, JSON, or raw text
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
      // Request camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });

      if (!mountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setState("scanning");
      scanningRef.current = true;

      // Use BarcodeDetector if available (Chrome, Edge, Samsung Internet)
      const hasBarcodeDetector = "BarcodeDetector" in window;

      if (hasBarcodeDetector) {
        // Native BarcodeDetector — fastest, most reliable
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
          } catch {
            // Detection failed this frame — continue
          }

          if (scanningRef.current) {
            requestAnimationFrame(scanLoop);
          }
        };

        requestAnimationFrame(scanLoop);
      } else {
        // Fallback: html5-qrcode for browsers without BarcodeDetector (Firefox, older Safari)
        const { Html5Qrcode } = await import("html5-qrcode");

        // Stop the getUserMedia stream since html5-qrcode manages its own
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        const el = document.getElementById("qr-fallback");
        if (!el) return;

        const scanner = new Html5Qrcode("qr-fallback", { verbose: false });

        await scanner.start(
          { facingMode: "environment" },
          { fps: 15, qrbox: { width: 250, height: 250 } },
          (text) => {
            scanningRef.current = false;
            scanner.stop().catch(() => {});
            void handleDecode(text);
          },
          () => {}
        );
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

        {/* Scan line animation */}
        {state === "scanning" && <div className="qr-scanline" />}

        {/* Native video element for BarcodeDetector */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover rounded-2xl"
          playsInline
          muted
          autoPlay
        />

        {/* Fallback container for html5-qrcode */}
        <div
          id="qr-fallback"
          className="absolute inset-0 rounded-2xl overflow-hidden"
          style={{ display: "BarcodeDetector" in (typeof window !== "undefined" ? window : {}) ? "none" : "block" }}
        />

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
