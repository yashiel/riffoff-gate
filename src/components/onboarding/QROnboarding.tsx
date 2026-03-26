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
  const scannerRef = useRef<InstanceType<
    typeof import("html5-qrcode").Html5Qrcode
  > | null>(null);
  const [state, setState] = useState<ScanState>("initializing");
  const [errorMessage, setErrorMessage] = useState("");
  const mountedRef = useRef(true);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const scanState = scannerRef.current.getState();
        if (scanState === 2 || scanState === 3) {
          await scannerRef.current.stop();
        }
      } catch {
        // Scanner may already be stopped
      }
      scannerRef.current = null;
    }
  }, []);

  const handleDecode = useCallback(
    async (decodedText: string) => {
      if (!mountedRef.current) return;

      await stopScanner();
      setState("processing");

      try {
        const deviceId = getDeviceId();

        // QR contains compact JSON: { p: pin, g: gateId, e: eventId }
        // Use PIN auth endpoint directly — same flow, simpler
        let pin = decodedText;
        let gateId = "default";
        try {
          const parsed = JSON.parse(decodedText);
          if (parsed.p) { pin = parsed.p; gateId = parsed.g || "default"; }
        } catch {
          // Not JSON — treat entire text as a legacy base64 payload
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
    [router, stopScanner]
  );

  const startScanner = useCallback(async () => {
    setState("initializing");
    setErrorMessage("");

    try {
      const { Html5Qrcode } = await import("html5-qrcode");

      if (!mountedRef.current) return;

      const scanner = new Html5Qrcode("qr-reader", {
        verbose: false,
      });
      scannerRef.current = scanner;

      const CAMERA_TIMEOUT_MS = 8000;
      const cameraPromise = scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 220, height: 220 },
        },
        (decodedText) => {
          void handleDecode(decodedText);
        },
        () => {}
      );

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Camera start timed out")), CAMERA_TIMEOUT_MS)
      );

      await Promise.race([cameraPromise, timeoutPromise]);

      if (mountedRef.current) {
        setState("scanning");
      }
    } catch (err) {
      if (!mountedRef.current) return;

      const message =
        err instanceof Error ? err.message.toLowerCase() : "";
      if (
        message.includes("permission") ||
        message.includes("notallowed") ||
        message.includes("not allowed")
      ) {
        setState("permission-denied");
      } else {
        setState("error");
        setErrorMessage(
          message.includes("timed out")
            ? "Camera not available. Try using PIN entry instead."
            : "Failed to start camera. Please check your device settings."
        );
      }
    }
  }, [handleDecode]);

  useEffect(() => {
    mountedRef.current = true;
    const deviceId = getDeviceId();
    void deviceId;
    void startScanner();

    return () => {
      mountedRef.current = false;
      void stopScanner();
    };
  }, [startScanner, stopScanner]);

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Camera viewport with corner brackets */}
      <div className="qr-viewport w-full aspect-[4/3] max-h-[280px] rounded-2xl relative">
        {/* Corner brackets */}
        <div className="qr-corner-tr" />
        <div className="qr-corner-bl" />

        {/* Scan line (only when scanning) */}
        {state === "scanning" && <div className="qr-scanline" />}

        {/* QR reader mount point */}
        <div
          id="qr-reader"
          className="absolute inset-0 rounded-2xl overflow-hidden"
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
            <span className="text-[15px] text-[var(--muted-foreground)]">
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
            <span className="text-[15px] text-[var(--coral)]">
              Creating session...
            </span>
          </div>
        )}

        {state === "permission-denied" && (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex items-center gap-2 text-[var(--warning)]">
              <ShieldAlert className="size-4" />
              <span className="text-[15px] font-medium">Camera access needed</span>
            </div>
            <p className="text-sm text-[var(--muted-foreground)] max-w-[260px]">
              Check your browser settings and grant camera permission for this site
            </p>
            <button
              type="button"
              onClick={() => void startScanner()}
              className="btn-retry min-h-[40px] px-5 rounded-xl text-[15px] font-medium flex items-center gap-2"
            >
              <RefreshCw className="size-3.5" />
              Retry
            </button>
          </div>
        )}

        {state === "error" && (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-[15px] text-[var(--destructive)] flex items-center gap-2">
              <Camera className="size-3.5 shrink-0" />
              {errorMessage}
            </p>
            <button
              type="button"
              onClick={() => void startScanner()}
              className="btn-retry min-h-[40px] px-5 rounded-xl text-[15px] font-medium flex items-center gap-2"
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
