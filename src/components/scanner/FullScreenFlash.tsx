"use client";

import { useEffect, useState } from "react";

interface FullScreenFlashProps {
  status: "valid" | "invalid" | null;
}

export function FullScreenFlash({ status }: FullScreenFlashProps) {
  const [visible, setVisible] = useState(false);
  const [activeStatus, setActiveStatus] = useState<"valid" | "invalid" | null>(
    null
  );

  useEffect(() => {
    if (!status) return;
    setActiveStatus(status);
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 200);
    return () => clearTimeout(timer);
  }, [status]);

  if (!visible || !activeStatus) return null;

  const bg =
    activeStatus === "valid"
      ? "bg-[var(--success)]/30"
      : "bg-[var(--destructive)]/30";

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-50 ${bg} motion-safe:animate-[flash_200ms_ease-out_forwards] motion-reduce:hidden`}
      aria-hidden="true"
    />
  );
}
