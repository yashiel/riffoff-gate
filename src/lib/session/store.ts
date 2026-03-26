export interface GateSessionData {
  sessionId: string;
  eventId: string;
  gateId: string;
  gateName: string;
  deviceId: string;
}

/** Data stored in localStorage — excludes sessionId for security (httpOnly cookie handles auth) */
interface StoredSessionData {
  eventId: string;
  gateId: string;
  gateName: string;
  deviceId: string;
  active: boolean;
}

const SESSION_KEY = "riffoff-gate-session";
const SESSION_TOKEN_KEY = "riffoff-gate-token";
const DEVICE_ID_KEY = "riffoff-gate-device-id";

export function getSession(): GateSessionData | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as StoredSessionData | GateSessionData;
    if (!stored.eventId || !stored.gateId) return null;
    // Return with sessionId as empty — auth is via httpOnly cookie, not localStorage
    return {
      sessionId: (stored as GateSessionData).sessionId ?? "",
      eventId: stored.eventId,
      gateId: stored.gateId,
      gateName: stored.gateName ?? "",
      deviceId: stored.deviceId ?? "",
    };
  } catch {
    return null;
  }
}

export function setSession(session: GateSessionData): void {
  const stored: StoredSessionData = {
    eventId: session.eventId,
    gateId: session.gateId,
    gateName: session.gateName ?? "",
    deviceId: session.deviceId ?? "",
    active: true,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(stored));
  // Also store session ID as auth token (for cross-origin header auth)
  if (session.sessionId) {
    localStorage.setItem(SESSION_TOKEN_KEY, session.sessionId);
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_TOKEN_KEY);
}

/** Get session token for Authorization header */
export function getSessionToken(): string | null {
  return localStorage.getItem(SESSION_TOKEN_KEY);
}

/** Set session token from server response */
export function setSessionToken(token: string): void {
  localStorage.setItem(SESSION_TOKEN_KEY, token);
}

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}
