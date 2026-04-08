import { openDB } from "idb";

const DB_NAME = "syncQueueDB";
const STORE_NAME = "actions";
const DB_VERSION = 1;

export type SyncAction = {
  id?: number;
  action: "fav_toggle" | "mark_viewed";
  lectureId: string;
  timestamp: number;
};

const getDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
      }
    },
  });
};

class SyncQueue {
  async push(action: Omit<SyncAction, "id" | "timestamp">): Promise<void> {
    const db = await getDB();
    await db.add(STORE_NAME, {
      ...action,
      timestamp: Date.now(),
    });
  }

  async drain(): Promise<SyncAction[]> {
    const db = await getDB();
    const all = await db.getAll(STORE_NAME);
    return all;
  }

  async clear(): Promise<void> {
    const db = await getDB();
    await db.clear(STORE_NAME);
  }

  /** TODO: вызывается из SW при sync event, когда бэкенд будет готов */
  async processSyncQueue(): Promise<void> {
    const actions = await this.drain();
    if (actions.length === 0) return;

    // TODO: POST actions to backend
    // await fetch(`${API_URL}/sync`, { method: 'POST', body: JSON.stringify(actions) });
    // await this.clear();
  }
}

export const syncQueue = new SyncQueue();
