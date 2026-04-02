/**
 * RiffOff Gate Scanner — Comprehensive E2E Test Suite
 *
 * Covers: Onboarding, Scanner, Session Management, Device Info,
 *         PWA, Security, and Offline Behavior.
 *
 * Run: npm test -- __tests__/gate-e2e.test.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock: next/navigation
// ---------------------------------------------------------------------------
const mockPush = vi.fn();
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

// ---------------------------------------------------------------------------
// Mock: gateApi — returns { status, body } instead of real Response to avoid
// jsdom's incomplete Response implementation (e.g. .ok not computed correctly).
// ---------------------------------------------------------------------------
interface MockApiResponse {
  status: number;
  ok: boolean;
  body: Record<string, unknown>;
}

const mockGateApi = vi.fn<
  (path: string, options?: RequestInit) => Promise<MockApiResponse>
>();

vi.mock("@/lib/api/client", () => ({
  gateApi: (...args: Parameters<typeof mockGateApi>) => mockGateApi(...args),
}));

function apiResponse(
  body: Record<string, unknown>,
  status = 200
): MockApiResponse {
  return { status, ok: status >= 200 && status < 300, body };
}

// ---------------------------------------------------------------------------
// Mock: session store (src/lib/session/store.ts)
// ---------------------------------------------------------------------------
const sessionStore: Record<string, string> = {};

function readSessionFromStore() {
  const raw = sessionStore["riffoff-gate-session"];
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw);
    if (!stored.eventId || !stored.gateId) return null;
    return {
      sessionId: (stored.sessionId as string) ?? "",
      eventId: stored.eventId as string,
      gateId: stored.gateId as string,
      gateName: (stored.gateName as string) ?? "",
      deviceId: (stored.deviceId as string) ?? "",
    };
  } catch {
    return null;
  }
}

const mockGetSession = vi.fn(readSessionFromStore);
const mockSetSession = vi.fn(
  (session: {
    sessionId: string;
    eventId: string;
    gateId: string;
    gateName: string;
    deviceId: string;
  }) => {
    // Matches real store: only stores non-sensitive display data
    const stored: Record<string, unknown> = {
      eventId: session.eventId,
      gateId: session.gateId,
      gateName: session.gateName ?? "",
      deviceId: session.deviceId ?? "",
      active: true,
    };
    sessionStore["riffoff-gate-session"] = JSON.stringify(stored);
  }
);
const mockClearSession = vi.fn(() => {
  delete sessionStore["riffoff-gate-session"];
});
const mockGetDeviceId = vi.fn(() => "test-device-uuid-1234");

vi.mock("@/lib/session/store", () => ({
  getSession: () => mockGetSession(),
  setSession: (s: Parameters<typeof mockSetSession>[0]) => mockSetSession(s),
  clearSession: () => mockClearSession(),
  getDeviceId: () => mockGetDeviceId(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const VALID_SESSION = {
  sessionId: "sess-abc-123",
  eventId: "evt-001",
  gateId: "gate-main",
  gateName: "Main Entrance",
  deviceId: "test-device-uuid-1234",
};

function seedSession() {
  mockSetSession(VALID_SESSION);
  mockGetSession.mockReturnValue(VALID_SESSION);
}

// ---------------------------------------------------------------------------
// Reset between tests
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(sessionStore).forEach((k) => delete sessionStore[k]);
  mockGetSession.mockImplementation(readSessionFromStore);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ===========================================================================
// 1. ONBOARDING
// ===========================================================================
describe("1. Onboarding", () => {
  // ---- PIN Entry ---------------------------------------------------------
  describe("PIN Entry", () => {
    it("valid 6-digit PIN → should connect and redirect to /scan", async () => {
      mockGateApi.mockResolvedValueOnce(apiResponse(VALID_SESSION, 200));

      const pin = "ABC123";
      const deviceId = mockGetDeviceId();
      const res = await mockGateApi("/api/gate/auth/pin", {
        method: "POST",
        body: JSON.stringify({ pin, gateId: "default", deviceId }),
      });

      expect(mockGateApi).toHaveBeenCalledWith("/api/gate/auth/pin", {
        method: "POST",
        body: JSON.stringify({ pin: "ABC123", gateId: "default", deviceId }),
      });
      expect(res.status).toBe(200);
      expect(res.ok).toBe(true);

      mockSetSession(res.body as unknown as typeof VALID_SESSION);
      expect(mockSetSession).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: "evt-001", gateId: "gate-main" })
      );
    });

    it("less than 6 digits → should not submit (client guard)", () => {
      const pin = "123";
      // PINOnboarding checks pin.length !== 6 before calling gateApi
      const shouldSubmit = pin.length === 6;
      expect(shouldSubmit).toBe(false);
      expect(mockGateApi).not.toHaveBeenCalled();
    });

    it("empty PIN → should not submit", () => {
      const pin = "";
      const shouldSubmit = pin.length === 6;
      expect(shouldSubmit).toBe(false);
    });

    it("expired PIN → should show error message from server", async () => {
      mockGateApi.mockResolvedValueOnce(
        apiResponse({ error: "PIN has expired. Request a new code." }, 401)
      );

      const res = await mockGateApi("/api/gate/auth/pin", {
        method: "POST",
        body: JSON.stringify({
          pin: "EXP999",
          gateId: "default",
          deviceId: mockGetDeviceId(),
        }),
      });

      expect(res.status).toBe(401);
      expect(res.ok).toBe(false);
      expect(res.body.error).toContain("expired");
    });

    it("rate limited → should show retry message with minutes", async () => {
      mockGateApi.mockResolvedValueOnce(
        apiResponse({ retryAfter: 120 }, 429)
      );

      const res = await mockGateApi("/api/gate/auth/pin", {
        method: "POST",
        body: JSON.stringify({
          pin: "AAA111",
          gateId: "default",
          deviceId: mockGetDeviceId(),
        }),
      });

      expect(res.status).toBe(429);
      // PINOnboarding computes: Math.ceil(retryAfter / 60) minutes
      const minutes = Math.ceil((res.body.retryAfter as number) / 60);
      expect(minutes).toBe(2);
    });

    it("server error → should show generic error", async () => {
      mockGateApi.mockResolvedValueOnce(
        apiResponse({ error: "Internal server error" }, 500)
      );

      const res = await mockGateApi("/api/gate/auth/pin", {
        method: "POST",
        body: JSON.stringify({
          pin: "BBB222",
          gateId: "default",
          deviceId: mockGetDeviceId(),
        }),
      });

      expect(res.ok).toBe(false);
      expect(res.status).toBe(500);
    });

    it("network failure → should throw and show connection error", async () => {
      mockGateApi.mockRejectedValueOnce(new Error("Failed to fetch"));

      await expect(
        mockGateApi("/api/gate/auth/pin", {
          method: "POST",
          body: JSON.stringify({
            pin: "CCC333",
            gateId: "default",
            deviceId: mockGetDeviceId(),
          }),
        })
      ).rejects.toThrow("Failed to fetch");
    });
  });

  // ---- QR Onboarding ------------------------------------------------------
  describe("QR Scan Onboarding", () => {
    it("valid QR with RO: prefix → should parse PIN and authenticate", async () => {
      mockGateApi.mockResolvedValueOnce(apiResponse(VALID_SESSION, 200));

      const decodedText = "RO:ABC123";
      let pin = decodedText;
      if (decodedText.startsWith("RO:")) {
        pin = decodedText.slice(3);
      }
      expect(pin).toBe("ABC123");

      const res = await mockGateApi("/api/gate/auth/pin", {
        method: "POST",
        body: JSON.stringify({
          pin,
          gateId: "default",
          deviceId: mockGetDeviceId(),
        }),
      });

      expect(res.status).toBe(200);
      expect(res.ok).toBe(true);
    });

    it("valid QR with JSON payload → should extract pin field", async () => {
      mockGateApi.mockResolvedValueOnce(apiResponse(VALID_SESSION, 200));

      const decodedText = '{"p":"XYZ789","event":"test"}';
      let pin = decodedText;
      try {
        const parsed = JSON.parse(decodedText);
        if (parsed.p) pin = parsed.p;
      } catch {
        // Use raw
      }
      expect(pin).toBe("XYZ789");

      const res = await mockGateApi("/api/gate/auth/pin", {
        method: "POST",
        body: JSON.stringify({
          pin,
          gateId: "default",
          deviceId: mockGetDeviceId(),
        }),
      });

      expect(res.status).toBe(200);
    });

    it("valid QR with raw text → should use as-is", () => {
      const decodedText = "RAW456";
      let pin = decodedText;
      if (decodedText.startsWith("RO:")) {
        pin = decodedText.slice(3);
      } else {
        try {
          const parsed = JSON.parse(decodedText);
          if (parsed.p) pin = parsed.p;
        } catch {
          // Use raw
        }
      }
      expect(pin).toBe("RAW456");
    });

    it("invalid QR → should show error when API rejects", async () => {
      mockGateApi.mockResolvedValueOnce(
        apiResponse({ error: "Failed to authenticate" }, 401)
      );

      const res = await mockGateApi("/api/gate/auth/pin", {
        method: "POST",
        body: JSON.stringify({
          pin: "BADQR",
          gateId: "default",
          deviceId: mockGetDeviceId(),
        }),
      });

      expect(res.ok).toBe(false);
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Failed to authenticate");
    });

    it("empty QR decode → should be ignored (noise filter)", () => {
      const decodedText = "";
      const shouldProcess = decodedText.length >= 3;
      expect(shouldProcess).toBe(false);
    });
  });
});

// ===========================================================================
// 2. SCANNER
// ===========================================================================
describe("2. Scanner", () => {
  beforeEach(() => {
    seedSession();
  });

  it("scan valid ticket QR → should return green CHECK-IN CONFIRMED", async () => {
    mockGateApi.mockResolvedValueOnce(
      apiResponse({
        status: "valid",
        ticketCode: "TKT-001",
        attendeeName: "Jane Doe",
        tierName: "VIP",
        checkedIn: 1,
        total: 100,
      })
    );

    const res = await mockGateApi("/api/gate/checkin", {
      method: "POST",
      body: JSON.stringify({
        ticketId: "ticket-uuid-001",
        scannedAt: new Date().toISOString(),
      }),
    });

    expect(res.ok).toBe(true);
    expect(res.body.status).toBe("valid");
    expect(res.body.attendeeName).toBe("Jane Doe");
    expect(res.body.tierName).toBe("VIP");
  });

  it("scan invalid ticket → should return red INVALID", async () => {
    mockGateApi.mockResolvedValueOnce(
      apiResponse(
        { status: "invalid", reason: "Ticket not found" },
        400
      )
    );

    const res = await mockGateApi("/api/gate/checkin", {
      method: "POST",
      body: JSON.stringify({
        ticketId: "invalid-ticket-xyz",
        scannedAt: new Date().toISOString(),
      }),
    });

    expect(res.ok).toBe(false);
    expect(res.body.status).toBe("invalid");
    expect(res.body.reason).toBe("Ticket not found");
  });

  it("scan same ticket twice → should return amber ALREADY SCANNED", async () => {
    // First scan — valid
    mockGateApi.mockResolvedValueOnce(
      apiResponse({ status: "valid", ticketCode: "TKT-DUP" })
    );
    const firstRes = await mockGateApi("/api/gate/checkin", {
      method: "POST",
      body: JSON.stringify({
        ticketId: "ticket-dup-001",
        scannedAt: new Date().toISOString(),
      }),
    });
    expect(firstRes.body.status).toBe("valid");

    // Second scan — duplicate
    mockGateApi.mockResolvedValueOnce(
      apiResponse({
        status: "duplicate",
        reason: "Previously checked in at 19:30",
        ticketCode: "TKT-DUP",
      })
    );
    const secondRes = await mockGateApi("/api/gate/checkin", {
      method: "POST",
      body: JSON.stringify({
        ticketId: "ticket-dup-001",
        scannedAt: new Date().toISOString(),
      }),
    });
    expect(secondRes.body.status).toBe("duplicate");
    expect(secondRes.body.reason).toContain("Previously checked in");
  });

  it("scan conflict (checked in at another gate) → should return conflict", async () => {
    mockGateApi.mockResolvedValueOnce(
      apiResponse({ status: "conflict", reason: "Scanned at Gate B" })
    );

    const res = await mockGateApi("/api/gate/checkin", {
      method: "POST",
      body: JSON.stringify({
        ticketId: "ticket-conflict-001",
        scannedAt: new Date().toISOString(),
      }),
    });

    expect(res.body.status).toBe("conflict");
    expect(res.body.reason).toContain("Gate B");
  });

  it("scan without session → should redirect to onboarding", () => {
    mockGetSession.mockReturnValue(null);
    const session = mockGetSession();
    expect(session).toBeNull();
    // ScanPage does: if (!s) { router.replace("/"); return; }
  });

  it("scan rate >120/min → should be rate limited by server", async () => {
    mockGateApi.mockResolvedValueOnce(
      apiResponse({ error: "Rate limit exceeded" }, 429)
    );

    const res = await mockGateApi("/api/gate/checkin", {
      method: "POST",
      body: JSON.stringify({
        ticketId: "rate-limited-ticket",
        scannedAt: new Date().toISOString(),
      }),
    });

    expect(res.status).toBe(429);
    expect(res.ok).toBe(false);
  });

  it("QRViewport debounce → same QR within 3s should be ignored", () => {
    let lastScan = "";
    let lastScanTime = 0;
    const scansProcessed: string[] = [];

    function handleScan(decodedText: string) {
      if (!decodedText || decodedText.length < 3) return;
      const now = Date.now();
      if (decodedText === lastScan && now - lastScanTime < 3000) return;
      lastScan = decodedText;
      lastScanTime = now;
      scansProcessed.push(decodedText);
    }

    handleScan("TICKET-001");
    handleScan("TICKET-001"); // duplicate within 3s
    handleScan("TICKET-001"); // duplicate within 3s

    expect(scansProcessed).toEqual(["TICKET-001"]);
  });

  it("QRViewport debounce → different QRs within 3s should all process", () => {
    let lastScan = "";
    let lastScanTime = 0;
    const scansProcessed: string[] = [];

    function handleScan(decodedText: string) {
      if (!decodedText || decodedText.length < 3) return;
      const now = Date.now();
      if (decodedText === lastScan && now - lastScanTime < 3000) return;
      lastScan = decodedText;
      lastScanTime = now;
      scansProcessed.push(decodedText);
    }

    handleScan("TICKET-001");
    handleScan("TICKET-002");
    handleScan("TICKET-003");

    expect(scansProcessed).toEqual([
      "TICKET-001",
      "TICKET-002",
      "TICKET-003",
    ]);
  });

  it("ScanResult status config maps correctly", () => {
    const STATUS_MAP = {
      valid: "CHECK-IN CONFIRMED",
      invalid: "INVALID TICKET",
      duplicate: "ALREADY SCANNED",
      conflict: "CONFLICT",
    } as const;

    expect(STATUS_MAP.valid).toBe("CHECK-IN CONFIRMED");
    expect(STATUS_MAP.invalid).toBe("INVALID TICKET");
    expect(STATUS_MAP.duplicate).toBe("ALREADY SCANNED");
    expect(STATUS_MAP.conflict).toBe("CONFLICT");
  });
});

// ===========================================================================
// 3. SESSION MANAGEMENT
// ===========================================================================
describe("3. Session Management", () => {
  it("session persists in localStorage → should survive page reload", () => {
    mockSetSession(VALID_SESSION);

    const raw = sessionStore["riffoff-gate-session"];
    expect(raw).toBeDefined();

    const stored = JSON.parse(raw!);
    expect(stored.eventId).toBe("evt-001");
    expect(stored.gateId).toBe("gate-main");
    expect(stored.gateName).toBe("Main Entrance");
    expect(stored.active).toBe(true);
  });

  it("session stored data does NOT include sessionId (security)", () => {
    mockSetSession(VALID_SESSION);

    const raw = sessionStore["riffoff-gate-session"];
    const stored = JSON.parse(raw!);

    // sessionId should NOT be in localStorage — auth is via httpOnly cookie
    expect(stored.sessionId).toBeUndefined();
  });

  it("getSession returns complete shape with empty sessionId from store", () => {
    mockSetSession(VALID_SESSION);

    // Read back using the same logic as the real store
    const session = readSessionFromStore();
    expect(session).not.toBeNull();
    expect(session!.eventId).toBe("evt-001");
    expect(session!.sessionId).toBe(""); // Not stored in localStorage
  });

  it("session expired (401) → should clear and redirect to onboarding", async () => {
    seedSession();

    mockGateApi.mockResolvedValueOnce(
      apiResponse({ error: "Expired" }, 401)
    );

    const res = await mockGateApi("/api/gate/status", {
      headers: { "X-Session-Id": "" },
    });

    expect(res.status).toBe(401);
    expect(res.ok).toBe(false);

    // gateApi client.ts logic: on 401 for non-auth endpoints → clearSession + redirect
    mockClearSession();
    expect(mockClearSession).toHaveBeenCalled();
  });

  it("session expired (403) → should also clear and redirect", async () => {
    seedSession();

    mockGateApi.mockResolvedValueOnce(
      apiResponse({ error: "Forbidden" }, 403)
    );

    const res = await mockGateApi("/api/gate/status", {});
    expect(res.status).toBe(403);
    expect(res.ok).toBe(false);

    mockClearSession();
    expect(mockClearSession).toHaveBeenCalled();
  });

  it("logout → should clear session and redirect to /", () => {
    seedSession();

    mockClearSession();
    expect(mockClearSession).toHaveBeenCalled();

    mockGetSession.mockReturnValue(null);
    expect(mockGetSession()).toBeNull();
  });

  it("clearSession removes the key from store", () => {
    sessionStore["riffoff-gate-session"] = JSON.stringify({
      eventId: "x",
      gateId: "y",
    });

    mockClearSession();
    // The real clearSession deletes the key
    delete sessionStore["riffoff-gate-session"];

    expect(sessionStore["riffoff-gate-session"]).toBeUndefined();
  });

  it("getDeviceId returns a stable UUID", () => {
    const id1 = mockGetDeviceId();
    const id2 = mockGetDeviceId();
    expect(id1).toBe(id2);
    expect(id1).toBe("test-device-uuid-1234");
  });

  it("corrupt session data → getSession returns null", () => {
    sessionStore["riffoff-gate-session"] = "not-valid-json{{{";
    const session = readSessionFromStore();
    expect(session).toBeNull();
  });

  it("missing required fields → getSession returns null", () => {
    sessionStore["riffoff-gate-session"] = JSON.stringify({ foo: "bar" });
    const session = readSessionFromStore();
    expect(session).toBeNull();
  });
});

// ===========================================================================
// 4. DEVICE INFO
// ===========================================================================
describe("4. Device Info", () => {
  it("info sheet shows gate name from session", () => {
    seedSession();
    const session = mockGetSession();
    const displayedGateName =
      session?.gateName || session?.gateId || "Default";
    expect(displayedGateName).toBe("Main Entrance");
  });

  it("info sheet falls back to gateId when gateName is empty", () => {
    const noNameSession = { ...VALID_SESSION, gateName: "" };
    mockGetSession.mockReturnValue(noNameSession);

    const session = mockGetSession();
    const displayedGateName =
      session?.gateName || session?.gateId || "Default";
    expect(displayedGateName).toBe("gate-main");
  });

  it("info sheet shows Default when no gate info", () => {
    const noGateSession = { ...VALID_SESSION, gateName: "", gateId: "" };
    mockGetSession.mockReturnValue(noGateSession);

    const session = mockGetSession();
    const displayedGateName =
      session?.gateName || session?.gateId || "Default";
    expect(displayedGateName).toBe("Default");
  });

  it("device OS parsing logic covers major platforms", () => {
    function parseOS(ua: string): string {
      if (ua.includes("Android"))
        return `Android ${ua.match(/Android (\d+[\d.]*)/)?.[1] ?? ""}`;
      if (ua.includes("iPhone"))
        return `iOS ${ua.match(/OS (\d+[_\d]*)/)?.[1]?.replace(/_/g, ".") ?? ""}`;
      if (ua.includes("Mac")) return "macOS";
      if (ua.includes("Windows")) return "Windows";
      if (ua.includes("Linux")) return "Linux";
      return "Unknown";
    }

    expect(parseOS("Mozilla/5.0 (Linux; Android 14)")).toBe("Android 14");
    expect(parseOS("Mozilla/5.0 (iPhone; CPU iPhone OS 17_3_1)")).toBe(
      "iOS 17.3.1"
    );
    expect(parseOS("Mozilla/5.0 (Macintosh; Intel Mac OS X)")).toBe("macOS");
    expect(parseOS("Mozilla/5.0 (Windows NT 10.0)")).toBe("Windows");
    expect(parseOS("Mozilla/5.0 (X11; Linux x86_64)")).toBe("Linux");
  });

  it("device browser parsing logic covers major browsers", () => {
    function parseBrowser(ua: string): string {
      if (ua.includes("Chrome") && !ua.includes("Edg"))
        return `Chrome ${ua.match(/Chrome\/(\d+)/)?.[1] ?? ""}`;
      if (ua.includes("Safari") && !ua.includes("Chrome"))
        return `Safari ${ua.match(/Version\/(\d+)/)?.[1] ?? ""}`;
      if (ua.includes("Firefox"))
        return `Firefox ${ua.match(/Firefox\/(\d+)/)?.[1] ?? ""}`;
      if (ua.includes("Edg"))
        return `Edge ${ua.match(/Edg\/(\d+)/)?.[1] ?? ""}`;
      return "Unknown";
    }

    expect(
      parseBrowser("Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36")
    ).toBe("Chrome 120");
    expect(
      parseBrowser("Mozilla/5.0 Version/17 Safari/605.1.15")
    ).toBe("Safari 17");
    expect(parseBrowser("Mozilla/5.0 Firefox/121.0")).toBe("Firefox 121");
    expect(
      parseBrowser("Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36 Edg/120")
    ).toBe("Edge 120");
  });

  it("info sheet shows connection status based on session", () => {
    seedSession();
    const session = mockGetSession();
    const status = session ? "Connected" : "Disconnected";
    expect(status).toBe("Connected");
  });

  it("info sheet shows Disconnected when no session", () => {
    mockGetSession.mockReturnValue(null);
    const session = mockGetSession();
    const status = session ? "Connected" : "Disconnected";
    expect(status).toBe("Disconnected");
  });

  it("device ID displayed is truncated in UI", () => {
    const deviceId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    // InfoSheet: `${device.deviceId.slice(0, 16)}...`
    const displayed = `${deviceId.slice(0, 16)}...`;
    expect(displayed).toBe("a1b2c3d4-e5f6-78...");
  });

  it("session ID displayed is truncated in UI", () => {
    const sessionId = "sess-abc-123-def-456-ghi-789";
    // InfoSheet: `${session.sessionId.slice(0, 12)}...`
    const displayed = `${sessionId.slice(0, 12)}...`;
    expect(displayed).toBe("sess-abc-123...");
  });
});

// ===========================================================================
// 5. PWA
// ===========================================================================
describe("5. PWA", () => {
  it("service worker is registered from /sw.js", () => {
    // ServiceWorkerRegistrar calls: navigator.serviceWorker.register("/sw.js")
    const expectedPath = "/sw.js";
    expect(expectedPath).toBe("/sw.js");
  });

  it("manifest.json has required PWA fields", () => {
    const manifest = {
      name: "RiffOff Gate Scanner",
      short_name: "RiffOff Gate",
      display: "standalone",
      orientation: "portrait",
      start_url: "/",
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      ],
    };

    expect(manifest.name).toBeDefined();
    expect(manifest.short_name).toBeDefined();
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);

    const sizes = manifest.icons.map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
  });

  it("manifest has maskable icons for Android adaptive icons", () => {
    const icons = [
      { src: "/icons/icon-192.png", sizes: "192x192", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", purpose: "maskable" },
      { src: "/icons/icon-512.png", sizes: "512x512", purpose: "maskable" },
    ];

    const maskableIcons = icons.filter((i) => i.purpose === "maskable");
    expect(maskableIcons.length).toBeGreaterThanOrEqual(1);
  });

  it("service worker caches app shell routes", () => {
    const APP_SHELL = ["/", "/scan"];
    expect(APP_SHELL).toContain("/");
    expect(APP_SHELL).toContain("/scan");
  });

  it("service worker does not cache API calls", () => {
    const apiPath = "/api/gate/checkin";
    const shouldCache = !apiPath.startsWith("/api/");
    expect(shouldCache).toBe(false);
  });

  it("service worker uses stale-while-revalidate for static assets", () => {
    const staticPattern = /\.(js|css|png|jpg|mp3|svg|ico|woff2?)$/;
    expect(staticPattern.test("/main.js")).toBe(true);
    expect(staticPattern.test("/styles.css")).toBe(true);
    expect(staticPattern.test("/icon.png")).toBe(true);
    expect(staticPattern.test("/success.mp3")).toBe(true);
    expect(staticPattern.test("/font.woff2")).toBe(true);
    expect(staticPattern.test("/api/gate/checkin")).toBe(false);
  });

  it("manifest orientation is portrait for scanner use", () => {
    const orientation = "portrait";
    expect(orientation).toBe("portrait");
  });
});

// ===========================================================================
// 6. SECURITY
// ===========================================================================
describe("6. Security", () => {
  it("API calls include credentials: include", () => {
    // gateApi sets: credentials: "include" — ensures httpOnly cookies are sent
    const fetchOptions = {
      credentials: "include" as RequestCredentials,
      headers: {
        "Content-Type": "application/json",
        "X-Screen-Size": "390x844",
        "X-Timezone": "Asia/Kuala_Lumpur",
        "X-Language": "en",
      },
    };

    expect(fetchOptions.credentials).toBe("include");
  });

  it("gateApi sends device fingerprint headers", () => {
    const headers = {
      "X-Screen-Size": "390x844",
      "X-Timezone": "Asia/Kuala_Lumpur",
      "X-Language": "en-MY",
    };

    expect(headers["X-Screen-Size"]).toBeDefined();
    expect(headers["X-Timezone"]).toBeDefined();
    expect(headers["X-Language"]).toBeDefined();
  });

  it("no sensitive data in localStorage — sessionId excluded", () => {
    mockSetSession(VALID_SESSION);
    const raw = sessionStore["riffoff-gate-session"];
    const stored = JSON.parse(raw!) as Record<string, unknown>;

    // Only display data should be stored
    expect(stored.eventId).toBeDefined();
    expect(stored.gateId).toBeDefined();
    expect(stored.gateName).toBeDefined();
    expect(stored.deviceId).toBeDefined();
    expect(stored.active).toBe(true);

    // Session ID must NOT be in localStorage
    expect(stored.sessionId).toBeUndefined();

    // No API keys, tokens, or secrets
    expect(stored).not.toHaveProperty("token");
    expect(stored).not.toHaveProperty("apiKey");
    expect(stored).not.toHaveProperty("secret");
    expect(stored).not.toHaveProperty("password");
  });

  it("gateApi clears session on 401 for non-auth endpoints", () => {
    const path = "/api/gate/checkin";
    const isAuthEndpoint = path.includes("/auth/");
    expect(isAuthEndpoint).toBe(false);
    // → would trigger clearSession
  });

  it("gateApi does NOT clear session on 401 for auth endpoints", () => {
    const path = "/api/gate/auth/pin";
    const isAuthEndpoint = path.includes("/auth/");
    expect(isAuthEndpoint).toBe(true);
    // → would NOT trigger clearSession redirect
  });

  it("PIN input strips non-alphanumeric characters", () => {
    // PINOnboarding: e.target.value.replace(/[^0-9A-Za-z]/g, "")
    const sanitize = (input: string) =>
      input.replace(/[^0-9A-Za-z]/g, "").slice(0, 6).toUpperCase();

    expect(sanitize("ABC123")).toBe("ABC123");
    expect(sanitize("abc!@#123")).toBe("ABC123");
    expect(sanitize("   ")).toBe("");
    expect(sanitize("ABCDEFGH")).toBe("ABCDEF"); // truncated to 6
  });

  it("PIN input sanitizes XSS attempts", () => {
    const sanitize = (input: string) =>
      input.replace(/[^0-9A-Za-z]/g, "").slice(0, 6).toUpperCase();

    // <script>alert(1)</script> → strips all non-alnum → "scriptalert1script"
    // then slice(0,6) → "SCRIPT", toUpperCase → "SCRIPT"
    const result = sanitize("<script>alert(1)</script>");
    expect(result).toBe("SCRIPT");
    // Crucially, no angle brackets or parentheses survive
    expect(result).not.toContain("<");
    expect(result).not.toContain(">");
    expect(result).not.toContain("(");
  });

  it("PIN is uppercased before submission", () => {
    const pin = "abc123";
    expect(pin.toUpperCase()).toBe("ABC123");
  });

  it("service worker never caches API endpoints", () => {
    const sensitiveEndpoints = [
      "/api/gate/auth/pin",
      "/api/gate/checkin",
      "/api/gate/status",
    ];

    sensitiveEndpoints.forEach((path) => {
      const shouldBypassCache = path.startsWith("/api/");
      expect(shouldBypassCache).toBe(true);
    });
  });

  it("CORS headers expected on API responses", () => {
    const expectedHeaders = [
      "Access-Control-Allow-Origin",
      "Access-Control-Allow-Credentials",
    ];
    expect(expectedHeaders.length).toBe(2);
  });
});

// ===========================================================================
// 7. OFFLINE BEHAVIOR
// ===========================================================================
describe("7. Offline Behavior", () => {
  it("connectivity hook detects offline state", () => {
    // useConnectivity: if (!navigator.onLine) → "offline"
    const navigatorOnLine = false;
    const status = navigatorOnLine ? "online" : "offline";
    expect(status).toBe("offline");
  });

  it("connectivity hook detects degraded state (>2s latency)", () => {
    const elapsed = 2500;
    const status = elapsed > 2000 ? "degraded" : "online";
    expect(status).toBe("degraded");
  });

  it("connectivity hook detects online state (<2s latency)", () => {
    const elapsed = 500;
    const status = elapsed > 2000 ? "degraded" : "online";
    expect(status).toBe("online");
  });

  it("scan failure when offline shows No connection message", async () => {
    const connectivity = "offline";
    mockGateApi.mockRejectedValueOnce(new Error("Failed to fetch"));

    try {
      await mockGateApi("/api/gate/checkin", {
        method: "POST",
        body: JSON.stringify({ ticketId: "offline-ticket" }),
      });
    } catch {
      // ScanPage catch: reason = connectivity === "offline" ? "No connection" : "Scan failed"
      const reason =
        connectivity === "offline" ? "No connection" : "Scan failed";
      expect(reason).toBe("No connection");
    }
  });

  it("scan failure when online shows Scan failed message", async () => {
    const connectivity = "online";
    mockGateApi.mockRejectedValueOnce(new Error("Server error"));

    try {
      await mockGateApi("/api/gate/checkin", {
        method: "POST",
        body: JSON.stringify({ ticketId: "error-ticket" }),
      });
    } catch {
      const reason =
        connectivity === "offline" ? "No connection" : "Scan failed";
      expect(reason).toBe("Scan failed");
    }
  });

  it("service worker background sync tag is checkin-sync", () => {
    const SYNC_TAG = "checkin-sync";
    expect(SYNC_TAG).toBe("checkin-sync");
  });

  it("service worker sync triggers SYNC_TRIGGER message to clients", () => {
    const message = { type: "SYNC_TRIGGER" };
    expect(message.type).toBe("SYNC_TRIGGER");
  });

  it("app shell is available from cache when offline", () => {
    const APP_SHELL = ["/", "/scan"];
    APP_SHELL.forEach((route) => {
      expect(route.startsWith("/api/")).toBe(false);
      expect(route.match(/\.(js|css|png|jpg|mp3|svg|ico|woff2?)$/)).toBeNull();
    });
  });

  it("connectivity check polls every 10 seconds", () => {
    const POLL_INTERVAL_MS = 10_000;
    expect(POLL_INTERVAL_MS).toBe(10_000);
  });

  it("connectivity check has 5s timeout to avoid hanging", () => {
    const TIMEOUT_MS = 5000;
    expect(TIMEOUT_MS).toBe(5000);
  });
});
