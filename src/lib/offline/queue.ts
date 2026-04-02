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

/** Get all pending check-ins */
export async function getPendingCheckIns(): Promise<PendingCheckIn[]> {
  const db = await getDb();
  return db.getAll(STORE_NAME);
}

/** Get count of pending check-ins */
export async function getPendingCount(): Promise<number> {
  const db = await getDb();
  return db.count(STORE_NAME);
}

/** Remove successfully synced check-ins by their IDs */
export async function removeSynced(ids: number[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  await Promise.all(ids.map((id) => tx.store.delete(id)));
  await tx.done;
}

/** Flush the queue by sending a batch to the server. Returns count synced. */
export async function flushQueue(
  apiCall: (checkIns: Array<{ ticketId: string; scannedAt: string }>) => Promise<Response>,
): Promise<number> {
  const pending = await getPendingCheckIns();
  if (pending.length === 0) return 0;

  // Send in batches of 500 (server limit)
  const BATCH_SIZE = 500;
  let totalSynced = 0;

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const payload = batch.map(({ ticketId, scannedAt }) => ({ ticketId, scannedAt }));

    try {
      const res = await apiCall(payload);
      if (res.ok) {
        const ids = batch.map((item) => item.id!).filter(Boolean);
        await removeSynced(ids);
        totalSynced += batch.length;
      }
    } catch {
      // Network still down — stop flushing, retry later
      break;
    }
  }

  return totalSynced;
}
