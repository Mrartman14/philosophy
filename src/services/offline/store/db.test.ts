// src/services/offline/store/db.test.ts
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, it, expect, beforeEach } from "vitest";

import { openOfflineDb } from "./db";

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe("openOfflineDb", () => {
  it("создаёт сторы saved-bundles и outbox", async () => {
    const db = await openOfflineDb();
    expect(Array.from(db.objectStoreNames).sort()).toEqual([
      "outbox",
      "saved-bundles",
    ]);
    db.close();
  });

  it("создаёт индексы by-entity и by-status на saved-bundles", async () => {
    const db = await openOfflineDb();
    const tx = db.transaction("saved-bundles", "readonly");
    expect(Array.from(tx.store.indexNames).sort()).toEqual([
      "by-entity",
      "by-status",
    ]);
    db.close();
  });

  it("создаёт индексы by-entity и by-status на outbox", async () => {
    const db = await openOfflineDb();
    const tx = db.transaction("outbox", "readonly");
    expect(Array.from(tx.store.indexNames).sort()).toEqual([
      "by-entity",
      "by-status",
    ]);
    db.close();
  });
});
