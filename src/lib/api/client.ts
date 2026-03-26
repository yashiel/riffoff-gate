import { clearSession } from "@/lib/session/store";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export async function gateApi(
  path: string,
  options?: RequestInit
): Promise<Response> {
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

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  // Only redirect on auth failure for session-protected endpoints, not auth endpoints
  const isAuthEndpoint = path.includes("/auth/");
  if ((res.status === 401 || res.status === 403) && !isAuthEndpoint) {
    clearSession();
    if (typeof window !== "undefined") window.location.href = "/";
    throw new Error("Session expired");
  }

  return res;
}
