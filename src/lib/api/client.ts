import { clearSession, getSessionToken, setSessionToken } from "@/lib/session/store";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

/**
 * Gate API client — sends requests to the main app's API.
 *
 * Uses Authorization header with session token instead of cookies because
 * cross-origin cookies are blocked by third-party cookie restrictions
 * in Safari/iOS and upcoming Chrome changes.
 */
export async function gateApi(
  path: string,
  options?: RequestInit
): Promise<Response> {
  const token = getSessionToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Screen-Size":
      typeof window !== "undefined"
        ? `${screen.width}x${screen.height}`
        : "",
    "X-Timezone": Intl.DateTimeFormat().resolvedOptions().timeZone,
    "X-Language":
      typeof navigator !== "undefined" ? navigator.language : "en",
    ...((options?.headers as Record<string, string>) ?? {}),
  };

  // Send session token via Authorization header (cross-origin safe)
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include", // Still try cookies as fallback
  });

  // Save session token from response header (set by auth endpoints)
  const newToken = res.headers.get("X-Gate-Session");
  if (newToken) {
    setSessionToken(newToken);
  }

  // Only redirect on auth failure for session-protected endpoints, not auth endpoints
  const isAuthEndpoint = path.includes("/auth/");
  if ((res.status === 401 || res.status === 403) && !isAuthEndpoint) {
    clearSession();
    if (typeof window !== "undefined") window.location.href = "/";
    throw new Error("Session expired");
  }

  return res;
}
