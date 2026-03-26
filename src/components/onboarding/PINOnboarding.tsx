"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight } from "lucide-react";
import { setSession, getDeviceId } from "@/lib/session/store";
import { gateApi } from "@/lib/api/client";

export function PINOnboarding() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (pin.length !== 6) {
      setError("Please enter a 6-digit PIN");
      return;
    }

    setIsLoading(true);
    setError("");
    setRetryAfter(null);

    try {
      const deviceId = getDeviceId();
      const res = await gateApi("/api/gate/auth/pin", {
        method: "POST",
        body: JSON.stringify({
          pin: pin.toUpperCase(),
          gateId: "default",
          deviceId,
        }),
      });

      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        const seconds = (data as { retryAfter?: number }).retryAfter ?? 60;
        const minutes = Math.ceil(seconds / 60);
        setRetryAfter(minutes);
        setError(`Too many attempts. Try again in ${minutes} minute${minutes > 1 ? "s" : ""}.`);
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error || "Invalid PIN. Please try again."
        );
      }

      const session = await res.json();
      setSession(session);
      router.push("/scan");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Connection failed. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  }

  const filled = pin.length;
  const progressPercent = (filled / 6) * 100;

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="flex flex-col items-center gap-5 w-full"
    >
      {/* PIN Input Section */}
      <div className="w-full flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor="gate-pin"
            className="text-sm font-semibold uppercase tracking-[0.15em] text-[var(--muted-foreground)]"
          >
            Access Code
          </label>
          <span className="text-[13px] font-mono tabular-nums text-[var(--muted-foreground)]">
            {filled}/6
          </span>
        </div>

        {/* Input with progress bar */}
        <div className="relative">
          <input
            id="gate-pin"
            type="text"
            inputMode="numeric"
            pattern="[0-9A-Za-z]{6}"
            maxLength={6}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="● ● ● ● ● ●"
            value={pin}
            onChange={(e) => {
              const value = e.target.value.replace(/[^0-9A-Za-z]/g, "");
              setPin(value.slice(0, 6).toUpperCase());
              if (error) setError("");
            }}
            disabled={isLoading}
            className="pin-input h-[52px] w-full rounded-xl
              px-4 text-center text-xl font-mono font-bold tracking-[0.4em] text-[var(--foreground)]
              disabled:opacity-40 disabled:cursor-not-allowed"
            aria-describedby={error ? "pin-error" : "pin-hint"}
            aria-invalid={!!error}
            required
          />
          {/* Progress indicator at bottom of input */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/5 rounded-b-xl overflow-hidden">
            <div
              className="h-full bg-[var(--coral)] transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <p
          id="pin-hint"
          className="text-sm text-[var(--muted-foreground)] transition-colors"
        >
          {pin.length > 0 && pin.length < 6
            ? `${6 - pin.length} more character${6 - pin.length > 1 ? "s" : ""} needed`
            : "Enter the 6-character code from your organiser"}
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div
          id="pin-error"
          role="alert"
          className={`w-full rounded-lg px-3 py-2.5 text-[15px] text-center ${
            retryAfter
              ? "bg-[var(--warning)]/10 border border-[var(--warning)]/20 text-[var(--warning)]"
              : "bg-[var(--destructive)]/10 border border-[var(--destructive)]/20 text-[var(--destructive)]"
          }`}
        >
          {error}
        </div>
      )}

      {/* Connect button */}
      <button
        type="submit"
        disabled={isLoading || pin.length !== 6}
        className="btn-connect min-h-[48px] w-full rounded-xl text-[15px]
          flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            Connect
            <ArrowRight className="size-4" />
          </>
        )}
      </button>
    </form>
  );
}
