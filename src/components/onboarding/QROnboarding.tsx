"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
        // Html5QrcodeScannerState: 2 = SCANNING, 3 = PAUSED
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

      let payload: unknown;
      try {
        payload = JSON.parse(decodedText);
      } catch {
        setState("error");
        setErrorMessage("Invalid QR code format. Please scan a valid gate QR code.");
        return;
      }

      try {
        const res = await gateApi("/api/gate/auth/qr", {
          method: "POST",
          body: JSON.stringify(payload),
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

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          void handleDecode(decodedText);
        },
        () => {
          // Scan failure — ignore, keep scanning
        }
      );

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
        setErrorMessage("Failed to start camera. Please check your device settings.");
      }
    }
  }, [handleDecode]);

  useEffect(() => {
    mountedRef.current = true;

    // Provide device ID header for all requests
    const deviceId = getDeviceId();
    void deviceId; // Used via gateApi headers

    void startScanner();

    return () => {
      mountedRef.current = false;
      void stopScanner();
    };
  }, [startScanner, stopScanner]);

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      {/* Camera viewport */}
      <div
        id="qr-reader"
        className="w-full max-w-[320px] aspect-square rounded-2xl overflow-hidden bg-neutral-900"
        style={{ minHeight: 280 }}
      />

      {/* States */}
      {state === "initializing" && (
        <p className="text-sm text-neutral-400 animate-pulse">
          Starting camera...
        </p>
      )}

      {state === "scanning" && (
        <p className="text-sm text-neutral-400">
          Point your camera at the gate QR code
        </p>
      )}

      {state === "processing" && (
        <div className="flex flex-col items-center gap-2">
          <div className="size-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-neutral-400">Creating session...</p>
        </div>
      )}

      {state === "permission-denied" && (
        <div className="flex flex-col items-center gap-4 text-center px-4">
          <p className="text-sm text-neutral-300">
            Allow camera access to continue
          </p>
          <p className="text-xs text-neutral-500">
            Check your browser settings and grant camera permission for this site.
          </p>
          <button
            type="button"
            onClick={() => void startScanner()}
            className="h-11 px-6 rounded-xl bg-white text-black font-medium text-sm
              active:scale-95 transition-transform"
          >
            Retry
          </button>
        </div>
      )}

      {state === "error" && (
        <div className="flex flex-col items-center gap-4 text-center px-4">
          <p className="text-sm text-red-400">{errorMessage}</p>
          <button
            type="button"
            onClick={() => void startScanner()}
            className="h-11 px-6 rounded-xl bg-white text-black font-medium text-sm
              active:scale-95 transition-transform"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
