"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";

interface FullScreenFlashProps {
  status: "valid" | "invalid" | null;
}

export function FullScreenFlash({ status }: FullScreenFlashProps) {
  const [visible, setVisible] = useState(false);
  const [activeStatus, setActiveStatus] = useState<"valid" | "invalid" | null>(null);

  useEffect(() => {
    if (!status) return;
    setActiveStatus(status);
    setVisible(true);

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(status === "valid" ? [50] : [50, 50, 50]);
    }

    const timer = setTimeout(() => setVisible(false), 300);
    return () => clearTimeout(timer);
  }, [status]);

  if (!visible || !activeStatus) return null;

  const isValid = activeStatus === "valid";

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-50 flex items-center justify-center motion-reduce:hidden`}
      aria-hidden="true"
    >
      {/* Color overlay */}
      <div
        className={`absolute inset-0 ${
          isValid ? "bg-emerald-500/25" : "bg-red-500/25"
        } motion-safe:animate-[flash_300ms_ease-out_forwards]`}
      />

      {/* Center icon burst */}
      <div
        className={`relative z-10 flex size-20 items-center justify-center rounded-full ${
          isValid ? "bg-emerald-500/40" : "bg-red-500/40"
        } motion-safe:animate-[scaleBurst_300ms_ease-out_forwards]`}
      >
        {isValid ? (
          <Check className="size-10 text-white" strokeWidth={3} />
        ) : (
          <X className="size-10 text-white" strokeWidth={3} />
        )}
      </div>
    </div>
  );
}
