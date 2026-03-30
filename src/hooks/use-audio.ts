"use client";

import { useRef, useCallback } from "react";

/**
 * Web Audio API oscillator-based sound effects.
 * Eliminates MP3 dependencies — works reliably on all mobile browsers.
 */
export function useAudio() {
  const ctxRef = useRef<AudioContext | null>(null);
  const emergencyRef = useRef<{ stop: () => void } | null>(null);

  const getCtx = useCallback(() => {
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      ctxRef.current = new AudioContext();
    }
    // Resume if suspended (mobile browsers require user gesture)
    if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume().catch(() => {});
    }
    return ctxRef.current;
  }, []);

  const playTone = useCallback(
    (
      freq: number,
      duration: number,
      type: OscillatorType = "sine",
      gain = 0.3,
      startOffset = 0
    ) => {
      const ctx = getCtx();
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.value = gain;

      // Fade out to avoid click/pop artifacts
      const start = ctx.currentTime + startOffset / 1000;
      const end = start + duration / 1000;
      g.gain.setValueAtTime(gain, start);
      g.gain.exponentialRampToValueAtTime(0.001, end);

      osc.connect(g).connect(ctx.destination);
      osc.start(start);
      osc.stop(end + 0.01);
    },
    [getCtx]
  );

  /** Rising two-tone chime: C5 → E5. Sine wave. */
  const playSuccess = useCallback(() => {
    playTone(523, 75, "sine", 0.3, 0); // C5
    playTone(659, 75, "sine", 0.3, 75); // E5
  }, [playTone]);

  /** Low buzz: A3 for 200ms. Square wave. */
  const playDenied = useCallback(() => {
    playTone(220, 200, "square", 0.2);
  }, [playTone]);

  /** Double beep: D4, 50ms gap, D4. Sine wave. */
  const playDuplicate = useCallback(() => {
    playTone(294, 100, "sine", 0.25, 0); // First D4
    playTone(294, 100, "sine", 0.25, 150); // Second D4 (100ms + 50ms gap)
  }, [playTone]);

  /** Alert tone: F4 for 300ms. Triangle wave. */
  const playWarning = useCallback(() => {
    playTone(349, 300, "triangle", 0.3);
  }, [playTone]);

  /** Repeating alarm: alternates A4 (440Hz) and E4 (330Hz), 200ms each, loops. */
  const playEmergency = useCallback(() => {
    // Stop any existing emergency alarm
    if (emergencyRef.current) {
      emergencyRef.current.stop();
    }

    let active = true;
    let toggle = false;

    const loop = () => {
      if (!active) return;
      const freq = toggle ? 330 : 440; // E4 / A4
      playTone(freq, 200, "sine", 0.35);
      toggle = !toggle;
    };

    // Play first tone immediately
    loop();
    const id = setInterval(loop, 250); // 200ms tone + 50ms gap

    const stop = () => {
      active = false;
      clearInterval(id);
      emergencyRef.current = null;
    };

    emergencyRef.current = { stop };
  }, [playTone]);

  /** Stops the emergency alarm loop if active. */
  const stopEmergency = useCallback(() => {
    if (emergencyRef.current) {
      emergencyRef.current.stop();
    }
  }, []);

  return {
    playSuccess,
    playDenied,
    playDuplicate,
    playWarning,
    playEmergency,
    stopEmergency,
  };
}
