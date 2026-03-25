export interface GateSessionData {
  sessionId: string;
  eventId: string;
  gateId: string;
  gateName: string;
  deviceId: string;
}

const SESSION_KEY = "riffoff-gate-session";
const DEVICE_ID_KEY = "riffoff-gate-device-id";

export function getSession(): GateSessionData | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GateSessionData;
  } catch {
    return null;
  }
}

export function setSession(session: GateSessionData): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}
