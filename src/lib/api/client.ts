import { clearSession, getSessionToken, setSessionToken } from "@/lib/session/store";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

/** Default request timeout in milliseconds */
const REQUEST_TIMEOUT_MS = 10_000;

/** Paths eligible for automatic retry on network failure */
const RETRYABLE_PATHS = ["/api/gate/checkin", "/api/gate/status"];
const MAX_RETRIES = 2;
const RETRY_DELAYS = [1000, 2000];

/**
 * Gate API client — sends requests to the main app's API.
 *
 * Uses Authorization header with session token instead of cookies because
 * cross-origin cookies are blocked by third-party cookie restrictions
 * in Safari/iOS and upcoming Chrome changes.
 *
 * Features:
 * - 10-second request timeout (prevents frozen UI)
 * - Automatic retry with backoff for check-in and status endpoints
 */
export async function gateApi(
  path: string,
  options?: RequestInit
): Promise<Response> {
  const isRetryable = RETRYABLE_PATHS.some((p) => path.startsWith(p));
  const retries = isRetryable ? MAX_RETRIES : 0;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await gateApiFetch(path, options);
      return res;
    } catch (err) {
      lastError = err;
      // Don't retry auth failures or aborts (timeout)
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new Error("Request timed out");
      }
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
        continue;
      }
    }
  }

  throw lastError;
}

async function gateApiFetch(
  path: string,
  options?: RequestInit,
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

  // Timeout: abort after 10 seconds to prevent frozen scanner UI
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: "include", // Still try cookies as fallback
      signal: options?.signal ?? controller.signal,
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
  } finally {
    clearTimeout(timeoutId);
  }
}
