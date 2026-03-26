"use client";

import { useEffect, useState } from "react";
import {
  X,
  LogOut,
  Smartphone,
  Wifi,
  Signal,
  MapPin,
  Battery,
  Monitor,
  Globe,
  Clock,
  DoorOpen,
  Radio,
  Fingerprint,
  Cpu,
} from "lucide-react";
import type { GateSessionData } from "@/lib/session/store";
import { getDeviceId } from "@/lib/session/store";

interface InfoSheetProps {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
  session: GateSessionData | null;
}

interface DeviceInfo {
  deviceId: string;
  browser: string;
  os: string;
  screenSize: string;
  pixelRatio: string;
  timezone: string;
  language: string;
  online: boolean;
  connectionType: string;
  batteryLevel: string;
  batteryCharging: string;
  memory: string;
  cores: string;
  platform: string;
}

function getDeviceInfo(): DeviceInfo {
  const ua = navigator.userAgent;

  // Parse browser
  let browser = "Unknown";
  if (ua.includes("Chrome") && !ua.includes("Edg")) browser = `Chrome ${ua.match(/Chrome\/(\d+)/)?.[1] ?? ""}`;
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = `Safari ${ua.match(/Version\/(\d+)/)?.[1] ?? ""}`;
  else if (ua.includes("Firefox")) browser = `Firefox ${ua.match(/Firefox\/(\d+)/)?.[1] ?? ""}`;
  else if (ua.includes("Edg")) browser = `Edge ${ua.match(/Edg\/(\d+)/)?.[1] ?? ""}`;

  // Parse OS
  let os = "Unknown";
  if (ua.includes("Android")) os = `Android ${ua.match(/Android (\d+[\d.]*)/)?.[1] ?? ""}`;
  else if (ua.includes("iPhone")) os = `iOS ${ua.match(/OS (\d+[_\d]*)/)?.[1]?.replace(/_/g, ".") ?? ""}`;
  else if (ua.includes("iPad")) os = `iPadOS ${ua.match(/OS (\d+[_\d]*)/)?.[1]?.replace(/_/g, ".") ?? ""}`;
  else if (ua.includes("Mac")) os = "macOS";
  else if (ua.includes("Windows")) os = `Windows ${ua.match(/Windows NT (\d+\.\d+)/)?.[1] === "10.0" ? "10/11" : ""}`;
  else if (ua.includes("Linux")) os = "Linux";

  // Connection type
  let connectionType = "Unknown";
  const conn = (navigator as unknown as { connection?: { effectiveType?: string; type?: string } }).connection;
  if (conn) {
    connectionType = conn.effectiveType ?? conn.type ?? "Unknown";
    if (connectionType === "4g") connectionType = "4G / WiFi";
    else if (connectionType === "3g") connectionType = "3G";
    else if (connectionType === "2g") connectionType = "2G (Slow)";
    else connectionType = connectionType.toUpperCase();
  }

  return {
    deviceId: getDeviceId(),
    browser,
    os,
    screenSize: `${screen.width}×${screen.height}`,
    pixelRatio: `${window.devicePixelRatio}x`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    online: navigator.onLine,
    connectionType,
    batteryLevel: "—",
    batteryCharging: "—",
    memory: (navigator as unknown as { deviceMemory?: number }).deviceMemory
      ? `${(navigator as unknown as { deviceMemory: number }).deviceMemory} GB`
      : "—",
    cores: navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} cores` : "—",
    platform: navigator.platform || "—",
  };
}

export function InfoSheet({ open, onClose, onLogout, session }: InfoSheetProps) {
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [batteryInfo, setBatteryInfo] = useState({ level: "—", charging: "—" });

  useEffect(() => {
    if (open && typeof window !== "undefined") {
      setDevice(getDeviceInfo());

      // Battery API (async)
      const nav = navigator as unknown as { getBattery?: () => Promise<{ level: number; charging: boolean }> };
      if (nav.getBattery) {
        nav.getBattery().then((bat) => {
          setBatteryInfo({
            level: `${Math.round(bat.level * 100)}%`,
            charging: bat.charging ? "Charging" : "On battery",
          });
        }).catch(() => {});
      }
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-30 flex flex-col">
      {/* Backdrop */}
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      {/* Sheet */}
      <div className="max-h-[85vh] overflow-y-auto rounded-t-2xl bg-[var(--card)] motion-safe:animate-[slideUp_200ms_ease-out]">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-5 py-3.5">
          <h2 className="text-base font-bold text-[var(--foreground)]">
            Device & Session Info
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)]"
            aria-label="Close info"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Gate / Session Section */}
        <div className="px-5 pt-4 pb-2">
          <SectionLabel icon={DoorOpen} label="Gate Connection" />
          <div className="mt-2 rounded-xl bg-[var(--muted)] p-3.5 space-y-2.5">
            <InfoRow icon={Radio} label="Event" value={session?.eventId ? `...${session.eventId.slice(-8)}` : "—"} />
            <InfoRow icon={DoorOpen} label="Gate" value={session?.gateName || session?.gateId || "Default"} />
            <InfoRow icon={Fingerprint} label="Session" value={session?.sessionId ? `${session.sessionId.slice(0, 12)}...` : "—"} />
            <InfoRow
              icon={Wifi}
              label="Status"
              value={session ? "Connected" : "Disconnected"}
              valueColor={session ? "text-emerald-400" : "text-red-400"}
            />
          </div>
        </div>

        {/* Device Section */}
        <div className="px-5 pt-4 pb-2">
          <SectionLabel icon={Smartphone} label="Device" />
          <div className="mt-2 rounded-xl bg-[var(--muted)] p-3.5 space-y-2.5">
            <InfoRow icon={Cpu} label="OS" value={device?.os ?? "—"} />
            <InfoRow icon={Globe} label="Browser" value={device?.browser ?? "—"} />
            <InfoRow icon={Monitor} label="Screen" value={device ? `${device.screenSize} @${device.pixelRatio}` : "—"} />
            <InfoRow icon={Cpu} label="CPU" value={device?.cores ?? "—"} />
            <InfoRow icon={Cpu} label="RAM" value={device?.memory ?? "—"} />
          </div>
        </div>

        {/* Network Section */}
        <div className="px-5 pt-4 pb-2">
          <SectionLabel icon={Signal} label="Network" />
          <div className="mt-2 rounded-xl bg-[var(--muted)] p-3.5 space-y-2.5">
            <InfoRow
              icon={Wifi}
              label="Online"
              value={device?.online ? "Yes" : "No"}
              valueColor={device?.online ? "text-emerald-400" : "text-red-400"}
            />
            <InfoRow icon={Signal} label="Connection" value={device?.connectionType ?? "—"} />
            <InfoRow icon={Battery} label="Battery" value={batteryInfo.level} />
            <InfoRow icon={Battery} label="Power" value={batteryInfo.charging} />
          </div>
        </div>

        {/* Locale Section */}
        <div className="px-5 pt-4 pb-2">
          <SectionLabel icon={Globe} label="Locale" />
          <div className="mt-2 rounded-xl bg-[var(--muted)] p-3.5 space-y-2.5">
            <InfoRow icon={Clock} label="Timezone" value={device?.timezone ?? "—"} />
            <InfoRow icon={MapPin} label="Language" value={device?.language ?? "—"} />
            <InfoRow icon={Fingerprint} label="Device ID" value={device?.deviceId ? `${device.deviceId.slice(0, 16)}...` : "—"} mono />
          </div>
        </div>

        {/* Logout */}
        <div className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <button
            onClick={onLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500/10 py-3.5 text-base font-bold text-red-400 transition-colors active:bg-red-500/20"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Disconnect & Log Out
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ icon: Icon, label }: { icon: typeof Smartphone; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-3.5 text-[var(--coral)]" />
      <span className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--muted-foreground)]">
        {label}
      </span>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  valueColor,
  mono,
}: {
  icon: typeof Smartphone;
  label: string;
  value: string;
  valueColor?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
        <Icon className="size-3.5 opacity-50" />
        {label}
      </span>
      <span
        className={`text-sm font-medium ${valueColor ?? "text-[var(--foreground)]"} ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
