// src/services/offline/store/db.test.ts
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, it, expect, beforeEach } from "vitest";

import { openOfflineDb, wipeOfflineDb } from "./db";

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

describe("wipeOfflineDb", () => {
  it("очищает оба стора (saved-bundles и outbox)", async () => {
    const db = await openOfflineDb();
    await db.put("saved-bundles", {
      key: "lectures:1",
      entity: "lectures",
      id: "1",
      savedAt: "2026-01-01T00:00:00.000Z",
      schemaVersion: 1,
      status: "complete",
      snapshot: {},
      imageKeys: [],
    });
    await db.put("outbox", {
      clientId: "c1",
      entity: "annotations",
      op: "create",
      payload: {},
      createdAt: "2026-01-01T00:00:00.000Z",
      status: "pending",
      attempts: 0,
    });
    db.close();

    await wipeOfflineDb();

    const db2 = await openOfflineDb();
    expect(await db2.getAll("saved-bundles")).toEqual([]);
    expect(await db2.getAll("outbox")).toEqual([]);
    db2.close();
  });
});
