// src/services/offline/repository.test.ts
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, it, expect, beforeEach } from "vitest";

import type { OfflineDescriptor } from "./contract/descriptor";
import {
  createServerRepository,
  createIndexedDbRepository,
  type OfflineRepository,
} from "./repository";
import { putSavedBundle } from "./store/saved-bundles";

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

const SNAPSHOT = { title: "Lecture 1", blocks: [], imageKeys: ["sha-a"] };

// Каждая фабрика строит репозиторий, предзаполненный SNAPSHOT для ("lectures","l1").
const factories: { name: string; build: () => Promise<OfflineRepository> }[] = [
  {
    name: "server adapter",
    build: () => {
      const descriptor: OfflineDescriptor = {
        entity: "lectures",
        pathSegment: "lectures",
        assemble: (id) => Promise.resolve(id === "l1" ? SNAPSHOT : null),
        extractImageKeys: () => [],
      };
      return Promise.resolve(
        createServerRepository((entity) =>
          entity === "lectures" ? descriptor : undefined,
        ),
      );
    },
  },
  {
    name: "indexeddb adapter",
    build: async () => {
      await putSavedBundle({
        entity: "lectures",
        id: "l1",
        savedAt: "2026-06-14T00:00:00.000Z",
        schemaVersion: 1,
        status: "complete",
        snapshot: SNAPSHOT,
        imageKeys: ["sha-a"],
      });
      return createIndexedDbRepository();
    },
  },
];

describe.each(factories)("OfflineRepository contract — $name", ({ build }) => {
  it("возвращает снимок для существующих entity+id", async () => {
    const repo = await build();
    expect(await repo.getSnapshot("lectures", "l1")).toEqual(SNAPSHOT);
  });

  it("возвращает null для несуществующего id", async () => {
    const repo = await build();
    expect(await repo.getSnapshot("lectures", "missing")).toBeNull();
  });

  it("возвращает null для неизвестной сущности", async () => {
    const repo = await build();
    expect(await repo.getSnapshot("unknown", "l1")).toBeNull();
  });
});
