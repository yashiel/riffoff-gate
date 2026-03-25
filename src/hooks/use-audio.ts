"use client";

import { useRef, useCallback, useEffect } from "react";

export function useAudio() {
  const successRef = useRef<HTMLAudioElement | null>(null);
  const errorRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    successRef.current = new Audio("/sounds/success.mp3");
    errorRef.current = new Audio("/sounds/error.mp3");
    successRef.current.load();
    errorRef.current.load();
  }, []);

  const playSuccess = useCallback(() => {
    successRef.current?.play().catch(() => {});
    if (navigator.vibrate) navigator.vibrate(100);
  }, []);

  const playError = useCallback(() => {
    errorRef.current?.play().catch(() => {});
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  }, []);

  return { playSuccess, playError };
}
