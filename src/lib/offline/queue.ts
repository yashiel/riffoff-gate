import { openDB, type IDBPDatabase } from "idb";

export interface PendingCheckIn {
  id?: number;
  ticketId: string;
  scannedAt: string;
  addedAt: number;
}

const DB_NAME = "riffoff-gate-offline";
const DB_VERSION = 1;
const STORE_NAME = "pending-checkins";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
        }
      },
    });
  }
  return dbPromise;
}

/** Add a failed/offline scan to the queue */
export async function enqueueCheckIn(ticketId: string, scannedAt: string): Promise<void> {
  const db = await getDb();
  await db.add(STORE_NAME, { ticketId, scannedAt, addedAt: Date.now() } satisfies Omit<PendingCheckIn, "id">);
}

/** Get count of pending check-ins */
export async function getPendingCount(): Promise<number> {
  const db = await getDb();
  return db.count(STORE_NAME);
}

/** Flush the queue by sending a batch to the server. Returns count synced. */
export async function flushQueue(
  apiCall: (checkIns: Array<{ ticketId: string; scannedAt: string }>) => Promise<Response>,
): Promise<number> {
  const db = await getDb();
  const pending = await db.getAll(STORE_NAME);
  if (pending.length === 0) return 0;

  const BATCH_SIZE = 500;
  let totalSynced = 0;

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const payload = batch.map(({ ticketId, scannedAt }) => ({ ticketId, scannedAt }));

    try {
      const res = await apiCall(payload);
      if (res.ok) {
        const tx = db.transaction(STORE_NAME, "readwrite");
        await Promise.all(batch.map((item) => tx.store.delete(item.id!)));
        await tx.done;
        totalSynced += batch.length;
      }
    } catch {
      break; // Network still down — stop, retry later
    }
  }

  return totalSynced;
}
