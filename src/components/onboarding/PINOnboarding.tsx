"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
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
      if (!error) {
        setError(
          err instanceof Error ? err.message : "Connection failed. Please try again."
        );
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="flex flex-col items-center gap-6 w-full max-w-[320px]"
    >
      <div className="w-full flex flex-col gap-2">
        <label
          htmlFor="gate-pin"
          className="text-sm font-medium text-neutral-300"
        >
          Gate PIN
        </label>
        <input
          id="gate-pin"
          type="text"
          inputMode="numeric"
          pattern="[0-9A-Za-z]{6}"
          maxLength={6}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="000000"
          value={pin}
          onChange={(e) => {
            const value = e.target.value.replace(/[^0-9A-Za-z]/g, "");
            setPin(value.slice(0, 6).toUpperCase());
            if (error) setError("");
          }}
          disabled={isLoading}
          className="h-[44px] w-full rounded-xl border border-neutral-700 bg-neutral-900
            px-4 text-center text-lg font-mono tracking-[0.3em] text-white
            placeholder:text-neutral-600
            focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors"
          aria-describedby={error ? "pin-error" : undefined}
          aria-invalid={!!error}
        />
      </div>

      {error && (
        <p
          id="pin-error"
          role="alert"
          className={`text-sm text-center ${retryAfter ? "text-amber-400" : "text-red-400"}`}
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isLoading || pin.length !== 6}
        className="h-[44px] w-full rounded-xl bg-white text-black font-medium text-sm
          disabled:opacity-40 disabled:cursor-not-allowed
          active:scale-[0.97] transition-all
          flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <div className="size-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            Connecting...
          </>
        ) : (
          "Connect"
        )}
      </button>
    </form>
  );
}
