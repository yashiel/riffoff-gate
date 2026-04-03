import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock session store
const mockGetSessionToken = vi.fn(() => "test-token");
const mockClearSession = vi.fn();
const mockSetSessionToken = vi.fn();

vi.mock("@/lib/session/store", () => ({
  getSessionToken: () => mockGetSessionToken(),
  clearSession: () => mockClearSession(),
  setSessionToken: (t: string) => mockSetSessionToken(t),
}));

// Mock globals for device headers
vi.stubGlobal("screen", { width: 390, height: 844 });

// Helper to create mock Response
function mockResponse(status: number, body = {}, headers: Record<string, string> = {}): Response {
  const h = new Headers(headers);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: h,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

// Track fetch calls
let fetchCalls: Array<{ url: string; init: RequestInit }> = [];
let fetchImpl: (url: string, init: RequestInit) => Promise<Response>;

vi.stubGlobal("fetch", (url: string | URL | Request, init?: RequestInit) => {
  const urlStr = typeof url === "string" ? url : url.toString();
  fetchCalls.push({ url: urlStr, init: init ?? {} });
  return fetchImpl(urlStr, init ?? {});
});

// Prevent actual redirects
Object.defineProperty(window, "location", {
  value: { href: "/" },
  writable: true,
});

let gateApi: typeof import("../client").gateApi;

beforeEach(async () => {
  fetchCalls = [];
  fetchImpl = () => Promise.resolve(mockResponse(200));
  mockGetSessionToken.mockReturnValue("test-token");
  mockClearSession.mockClear();
  mockSetSessionToken.mockClear();
  window.location.href = "/";

  // Re-import to get fresh module
  vi.resetModules();
  const mod = await import("../client");
  gateApi = mod.gateApi;
});

describe("gateApi — headers", () => {
  it("sends Authorization header with token", async () => {
    await gateApi("/api/gate/status");
    const headers = fetchCalls[0].init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer test-token");
  });

  it("sends device headers", async () => {
    await gateApi("/api/gate/status");
    const headers = fetchCalls[0].init.headers as Record<string, string>;
    expect(headers["X-Screen-Size"]).toBe("390x844");
    expect(headers["X-Timezone"]).toBeTruthy();
    expect(headers["X-Language"]).toBeTruthy();
  });

  it("does not send Authorization when no token", async () => {
    mockGetSessionToken.mockReturnValue(null);
    await gateApi("/api/gate/status");
    const headers = fetchCalls[0].init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();
  });
});

describe("gateApi — session token extraction", () => {
  it("saves token from X-Gate-Session header", async () => {
    fetchImpl = () => Promise.resolve(mockResponse(200, {}, { "X-Gate-Session": "new-token-123" }));
    await gateApi("/api/gate/auth/pin", { method: "POST" });
    expect(mockSetSessionToken).toHaveBeenCalledWith("new-token-123");
  });

  it("does not call setSessionToken when header absent", async () => {
    await gateApi("/api/gate/status");
    expect(mockSetSessionToken).not.toHaveBeenCalled();
  });
});

describe("gateApi — auth failure handling", () => {
  it("calls clearSession on 401 for regular paths", async () => {
    fetchImpl = () => Promise.resolve(mockResponse(401));
    await expect(gateApi("/api/gate/checkin", { method: "POST" })).rejects.toThrow("Session expired");
    expect(mockClearSession).toHaveBeenCalled();
  });

  it("does NOT call clearSession for auth endpoints (401)", async () => {
    fetchImpl = () => Promise.resolve(mockResponse(401));
    const res = await gateApi("/api/gate/auth/pin", { method: "POST" });
    expect(res.status).toBe(401);
    expect(mockClearSession).not.toHaveBeenCalled();
  });

  it("does NOT call clearSession for NO_LOGOUT_PATHS (401)", async () => {
    fetchImpl = () => Promise.resolve(mockResponse(401));
    const res = await gateApi("/api/gate/status");
    expect(res.status).toBe(401);
    expect(mockClearSession).not.toHaveBeenCalled();
  });

  it("does NOT call clearSession for 403 on status path", async () => {
    fetchImpl = () => Promise.resolve(mockResponse(403));
    const res = await gateApi("/api/gate/status");
    expect(res.status).toBe(403);
    expect(mockClearSession).not.toHaveBeenCalled();
  });
});

describe("gateApi — retry logic", () => {
  it("retries 2x on network error for retryable paths", async () => {
    let callCount = 0;
    fetchImpl = () => {
      callCount++;
      if (callCount < 3) throw new Error("Network error");
      return Promise.resolve(mockResponse(200));
    };

    const res = await gateApi("/api/gate/checkin", { method: "POST" });
    expect(res.status).toBe(200);
    expect(callCount).toBe(3); // 1 initial + 2 retries
  });

  it("does NOT retry for non-retryable paths", async () => {
    let callCount = 0;
    fetchImpl = () => {
      callCount++;
      throw new Error("Network error");
    };

    await expect(gateApi("/api/gate/auth/pin", { method: "POST" })).rejects.toThrow("Network error");
    expect(callCount).toBe(1);
  });

  it("does NOT retry on Session expired", async () => {
    fetchImpl = () => Promise.resolve(mockResponse(401));
    let callCount = 0;
    const origImpl = fetchImpl;
    fetchImpl = (...args) => {
      callCount++;
      return origImpl(...args);
    };

    await expect(gateApi("/api/gate/checkin", { method: "POST" })).rejects.toThrow("Session expired");
    expect(callCount).toBe(1);
  });

  it("retries for /api/gate/status on network error", async () => {
    let callCount = 0;
    fetchImpl = () => {
      callCount++;
      if (callCount < 3) throw new Error("Failed to fetch");
      return Promise.resolve(mockResponse(200));
    };

    const res = await gateApi("/api/gate/status");
    expect(res.status).toBe(200);
    expect(callCount).toBe(3);
  });
});

describe("gateApi — timeout", () => {
  it("throws on abort (simulated timeout)", async () => {
    fetchImpl = () => {
      const err = new DOMException("The operation was aborted.", "AbortError");
      return Promise.reject(err);
    };

    await expect(gateApi("/api/gate/auth/pin", { method: "POST" })).rejects.toThrow("Request timed out");
  });
});
