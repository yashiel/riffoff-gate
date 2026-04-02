import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getSession,
  setSession,
  clearSession,
  getSessionToken,
  setSessionToken,
  getDeviceId,
} from "../store";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

// Mock crypto.randomUUID
vi.stubGlobal("crypto", { randomUUID: () => "test-uuid-1234" });

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
});

describe("getSession", () => {
  it("returns null when no session stored", () => {
    expect(getSession()).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    localStorageMock.setItem("riffoff-gate-session", "not-json");
    expect(getSession()).toBeNull();
  });

  it("returns null when eventId is missing", () => {
    localStorageMock.setItem(
      "riffoff-gate-session",
      JSON.stringify({ gateId: "g1", gateName: "Gate A", deviceId: "d1", active: true }),
    );
    expect(getSession()).toBeNull();
  });

  it("returns null when gateId is missing", () => {
    localStorageMock.setItem(
      "riffoff-gate-session",
      JSON.stringify({ eventId: "e1", gateName: "Gate A", deviceId: "d1", active: true }),
    );
    expect(getSession()).toBeNull();
  });

  it("returns session data with defaults for missing optional fields", () => {
    localStorageMock.setItem(
      "riffoff-gate-session",
      JSON.stringify({ eventId: "e1", gateId: "g1", active: true }),
    );
    const session = getSession();
    expect(session).toEqual({
      sessionId: "",
      eventId: "e1",
      gateId: "g1",
      gateName: "",
      deviceId: "",
    });
  });

  it("returns full session data", () => {
    localStorageMock.setItem(
      "riffoff-gate-session",
      JSON.stringify({
        eventId: "e1",
        gateId: "g1",
        gateName: "Main Gate",
        deviceId: "d1",
        active: true,
      }),
    );
    const session = getSession();
    expect(session).toEqual({
      sessionId: "",
      eventId: "e1",
      gateId: "g1",
      gateName: "Main Gate",
      deviceId: "d1",
    });
  });
});

describe("setSession", () => {
  it("stores session data without sessionId", () => {
    setSession({
      sessionId: "secret-token",
      eventId: "e1",
      gateId: "g1",
      gateName: "VIP Gate",
      deviceId: "d1",
    });

    const stored = JSON.parse(localStorageMock.getItem("riffoff-gate-session")!);
    expect(stored.sessionId).toBeUndefined();
    expect(stored.eventId).toBe("e1");
    expect(stored.gateName).toBe("VIP Gate");
    expect(stored.active).toBe(true);
  });

  it("stores sessionId as auth token separately", () => {
    setSession({
      sessionId: "secret-token",
      eventId: "e1",
      gateId: "g1",
      gateName: "",
      deviceId: "",
    });

    expect(localStorageMock.getItem("riffoff-gate-token")).toBe("secret-token");
  });

  it("does not store empty sessionId as token", () => {
    setSession({
      sessionId: "",
      eventId: "e1",
      gateId: "g1",
      gateName: "",
      deviceId: "",
    });

    expect(localStorageMock.setItem).not.toHaveBeenCalledWith(
      "riffoff-gate-token",
      expect.anything(),
    );
  });
});

describe("clearSession", () => {
  it("removes both session and token", () => {
    setSession({
      sessionId: "tok",
      eventId: "e1",
      gateId: "g1",
      gateName: "",
      deviceId: "",
    });

    clearSession();

    expect(localStorageMock.removeItem).toHaveBeenCalledWith("riffoff-gate-session");
    expect(localStorageMock.removeItem).toHaveBeenCalledWith("riffoff-gate-token");
  });
});

describe("getSessionToken / setSessionToken", () => {
  it("returns null when no token stored", () => {
    expect(getSessionToken()).toBeNull();
  });

  it("stores and retrieves token", () => {
    setSessionToken("my-token");
    expect(localStorageMock.getItem("riffoff-gate-token")).toBe("my-token");
  });
});

describe("getDeviceId", () => {
  it("generates and stores a UUID on first call", () => {
    const id = getDeviceId();
    expect(id).toBe("test-uuid-1234");
    expect(localStorageMock.setItem).toHaveBeenCalledWith("riffoff-gate-device-id", "test-uuid-1234");
  });

  it("returns existing device ID on subsequent calls", () => {
    localStorageMock.setItem("riffoff-gate-device-id", "existing-id");
    vi.clearAllMocks();

    const id = getDeviceId();
    expect(id).toBe("existing-id");
  });
});
