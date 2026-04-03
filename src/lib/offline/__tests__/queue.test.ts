import { describe, it, expect, beforeEach, vi } from "vitest";

// In-memory fake IndexedDB store
let fakeStore: Array<{ id: number; ticketId: string; scannedAt: string; addedAt: number }> = [];
let nextId = 1;

const fakeDb = {
  add: vi.fn((storeName: string, value: Record<string, unknown>) => {
    const item = { ...value, id: nextId++ } as (typeof fakeStore)[0];
    fakeStore.push(item);
    return Promise.resolve(item.id);
  }),
  count: vi.fn(() => Promise.resolve(fakeStore.length)),
  getAll: vi.fn(() => Promise.resolve([...fakeStore])),
  transaction: vi.fn(() => ({
    store: {
      delete: vi.fn((id: number) => {
        fakeStore = fakeStore.filter((item) => item.id !== id);
        return Promise.resolve();
      }),
    },
    done: Promise.resolve(),
  })),
};

vi.mock("idb", () => ({
  openDB: vi.fn(() => Promise.resolve(fakeDb)),
}));

let enqueueCheckIn: typeof import("../queue").enqueueCheckIn;
let getPendingCount: typeof import("../queue").getPendingCount;
let flushQueue: typeof import("../queue").flushQueue;

beforeEach(async () => {
  fakeStore = [];
  nextId = 1;
  vi.clearAllMocks();

  vi.resetModules();
  const mod = await import("../queue");
  enqueueCheckIn = mod.enqueueCheckIn;
  getPendingCount = mod.getPendingCount;
  flushQueue = mod.flushQueue;
});

describe("enqueueCheckIn", () => {
  it("adds item with ticketId, scannedAt, and addedAt", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);
    await enqueueCheckIn("ticket-1", "2026-01-01T00:00:00Z");

    expect(fakeDb.add).toHaveBeenCalledWith(
      "pending-checkins",
      expect.objectContaining({
        ticketId: "ticket-1",
        scannedAt: "2026-01-01T00:00:00Z",
        addedAt: 1000,
      }),
    );
    vi.restoreAllMocks();
  });
});

describe("getPendingCount", () => {
  it("returns 0 when empty", async () => {
    expect(await getPendingCount()).toBe(0);
  });

  it("returns correct count after enqueuing", async () => {
    await enqueueCheckIn("t1", "2026-01-01T00:00:00Z");
    await enqueueCheckIn("t2", "2026-01-01T00:01:00Z");
    expect(await getPendingCount()).toBe(2);
  });
});

describe("flushQueue", () => {
  it("returns 0 when queue is empty", async () => {
    const apiCall = vi.fn();
    const synced = await flushQueue(apiCall);
    expect(synced).toBe(0);
    expect(apiCall).not.toHaveBeenCalled();
  });

  it("calls apiCall with correct payload", async () => {
    await enqueueCheckIn("t1", "2026-01-01T00:00:00Z");
    await enqueueCheckIn("t2", "2026-01-01T00:01:00Z");

    const apiCall = vi.fn(() => Promise.resolve({ ok: true } as Response));
    await flushQueue(apiCall);

    expect(apiCall).toHaveBeenCalledWith([
      { ticketId: "t1", scannedAt: "2026-01-01T00:00:00Z" },
      { ticketId: "t2", scannedAt: "2026-01-01T00:01:00Z" },
    ]);
  });

  it("removes items after successful sync", async () => {
    await enqueueCheckIn("t1", "2026-01-01T00:00:00Z");
    const apiCall = vi.fn(() => Promise.resolve({ ok: true } as Response));

    const synced = await flushQueue(apiCall);
    expect(synced).toBe(1);
  });

  it("stops on network error and returns partial count", async () => {
    await enqueueCheckIn("t1", "2026-01-01T00:00:00Z");
    await enqueueCheckIn("t2", "2026-01-01T00:01:00Z");

    const apiCall = vi.fn(() => Promise.reject(new Error("Network error")));
    const synced = await flushQueue(apiCall);

    expect(synced).toBe(0);
    expect(apiCall).toHaveBeenCalledTimes(1);
  });

  it("does not remove items when apiCall returns non-ok", async () => {
    await enqueueCheckIn("t1", "2026-01-01T00:00:00Z");
    const apiCall = vi.fn(() => Promise.resolve({ ok: false } as Response));

    const synced = await flushQueue(apiCall);
    expect(synced).toBe(0);
    // Items should still be in queue
    expect(await getPendingCount()).toBe(1);
  });
});
