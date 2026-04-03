import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock session store
let mockToken: string | null = "test-session-token";
vi.mock("@/lib/session/store", () => ({
  getSessionToken: () => mockToken,
}));

// Mock EventSource
type EventHandler = (e?: MessageEvent) => void;

class MockEventSource {
  static instances: MockEventSource[] = [];

  url: string;
  listeners: Record<string, EventHandler[]> = {};
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, handler: EventHandler) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(handler);
  }

  close() {
    this.closed = true;
  }

  // Test helpers
  emit(type: string, data?: string) {
    const event = data !== undefined ? ({ data } as MessageEvent) : undefined;
    for (const handler of this.listeners[type] ?? []) {
      handler(event!);
    }
  }

  triggerOpen() {
    this.onopen?.();
  }

  triggerError() {
    this.onerror?.();
  }
}

vi.stubGlobal("EventSource", MockEventSource);

// Suppress navigator.vibrate
vi.stubGlobal("navigator", { ...navigator, vibrate: vi.fn() });

let useGateSSE: typeof import("../use-gate-sse").useGateSSE;

beforeEach(async () => {
  MockEventSource.instances = [];
  mockToken = "test-session-token";
  vi.useFakeTimers();
  vi.resetModules();
  const mod = await import("../use-gate-sse");
  useGateSSE = mod.useGateSSE;
});

afterEach(() => {
  vi.useRealTimers();
});

function getLastES(): MockEventSource {
  return MockEventSource.instances[MockEventSource.instances.length - 1];
}

describe("useGateSSE — connection", () => {
  it("returns disconnected when no session token", () => {
    mockToken = null;
    const { result } = renderHook(() => useGateSSE());
    expect(result.current.connectionState).toBe("disconnected");
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it("opens EventSource with correct URL and token", () => {
    renderHook(() => useGateSSE());
    expect(MockEventSource.instances).toHaveLength(1);
    expect(getLastES().url).toContain("/api/gate/stream?token=test-session-token&role=scanner");
  });

  it("sets connected on 'connected' event", () => {
    const { result } = renderHook(() => useGateSSE());
    act(() => getLastES().emit("connected"));
    expect(result.current.connectionState).toBe("connected");
  });
});

describe("useGateSSE — stats", () => {
  it("parses stats from 'stats' event", () => {
    const { result } = renderHook(() => useGateSSE());
    const stats = { total: { checkedIn: 42, totalTickets: 100 }, gates: [] };
    act(() => getLastES().emit("stats", JSON.stringify(stats)));
    expect(result.current.stats).toEqual(stats);
  });

  it("ignores malformed stats data", () => {
    const { result } = renderHook(() => useGateSSE());
    act(() => getLastES().emit("stats", "not-json"));
    expect(result.current.stats).toBeNull();
  });
});

describe("useGateSSE — broadcasts", () => {
  it("deduplicates broadcast messages with same ID", () => {
    const { result } = renderHook(() => useGateSSE());
    const msg = JSON.stringify({ id: "b1", message: "Test", gateId: null, createdAt: "2026-01-01" });

    act(() => getLastES().emit("broadcast", msg));
    act(() => getLastES().emit("broadcast", msg));

    expect(result.current.broadcasts).toHaveLength(1);
  });

  it("limits broadcasts to 20 max", () => {
    const { result } = renderHook(() => useGateSSE());

    act(() => {
      for (let i = 0; i < 25; i++) {
        getLastES().emit("broadcast", JSON.stringify({
          id: `b${i}`, message: `Msg ${i}`, gateId: null, createdAt: "2026-01-01",
        }));
      }
    });

    expect(result.current.broadcasts.length).toBeLessThanOrEqual(20);
  });

  it("dismissBroadcast filters from visible list", () => {
    const { result } = renderHook(() => useGateSSE());
    act(() => {
      getLastES().emit("broadcast", JSON.stringify({
        id: "b1", message: "Test", gateId: null, createdAt: "2026-01-01",
      }));
    });

    expect(result.current.broadcasts).toHaveLength(1);
    act(() => result.current.dismissBroadcast("b1"));
    expect(result.current.broadcasts).toHaveLength(0);
  });
});

describe("useGateSSE — revocation", () => {
  it("sets revoked and disconnected on 'revoked' event", () => {
    const { result } = renderHook(() => useGateSSE());
    const es = getLastES();
    const closeSpy = vi.spyOn(es, "close");
    act(() => es.emit("revoked"));

    expect(result.current.revoked).toBe(true);
    expect(result.current.connectionState).toBe("disconnected");
    expect(closeSpy).toHaveBeenCalled();
  });
});

describe("useGateSSE — heartbeat", () => {
  it("parses serverTime from heartbeat event", () => {
    const { result } = renderHook(() => useGateSSE());
    act(() => getLastES().emit("heartbeat", JSON.stringify({ serverTime: "2026-01-01T00:00:00Z" })));
    expect(result.current.serverTime).toBe("2026-01-01T00:00:00Z");
  });
});

describe("useGateSSE — reconnection", () => {
  it("reconnects with backoff on error", () => {
    renderHook(() => useGateSSE());
    const initialCount = MockEventSource.instances.length;

    act(() => getLastES().triggerError());

    // Should be in reconnecting state, timer scheduled
    expect(MockEventSource.instances.length).toBe(initialCount); // not yet reconnected

    // Advance past first retry delay (1s base + jitter)
    act(() => vi.advanceTimersByTime(2000));

    expect(MockEventSource.instances.length).toBe(initialCount + 1); // reconnected
  });
});

describe("useGateSSE — cleanup", () => {
  it("closes EventSource and clears timers on unmount", () => {
    const { unmount } = renderHook(() => useGateSSE());
    const es = getLastES();
    expect(es.closed).toBe(false);

    unmount();
    expect(es.closed).toBe(true);
  });
});
