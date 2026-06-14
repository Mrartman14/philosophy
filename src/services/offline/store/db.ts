// src/services/offline/store/db.ts
// Browser-only: открывает IndexedDB-базу офлайна (глобальный indexedDB).
// Импортировать только из клиентского кода.
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import {
  OFFLINE_DB_NAME,
  OFFLINE_DB_VERSION,
  type SavedBundleRecord,
  type SavedBundleStatus,
  type OutboxCommand,
  type OutboxStatus,
} from "../contract/storage";

export interface OfflineDB extends DBSchema {
  "saved-bundles": {
    key: string;
    value: SavedBundleRecord;
    indexes: { "by-entity": string; "by-status": SavedBundleStatus };
  };
  outbox: {
    key: string;
    value: OutboxCommand;
    indexes: { "by-status": OutboxStatus; "by-entity": string };
  };
}

export function openOfflineDb(): Promise<IDBPDatabase<OfflineDB>> {
  return openDB<OfflineDB>(OFFLINE_DB_NAME, OFFLINE_DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("saved-bundles")) {
        const bundles = db.createObjectStore("saved-bundles", {
          keyPath: "key",
        });
        bundles.createIndex("by-entity", "entity");
        bundles.createIndex("by-status", "status");
      }
      if (!db.objectStoreNames.contains("outbox")) {
        const outbox = db.createObjectStore("outbox", { keyPath: "clientId" });
        outbox.createIndex("by-status", "status");
        outbox.createIndex("by-entity", "entity");
      }
    },
  });
}
