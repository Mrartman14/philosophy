// src/services/offline/store/saved-bundles.test.ts
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, it, expect, beforeEach } from "vitest";

import {
  putSavedBundle,
  getSavedBundle,
  listSavedBundles,
  listSavedBundlesByEntity,
  listSavedBundlesByStatus,
  updateSavedBundle,
  deleteSavedBundle,
} from "./saved-bundles";
import type { SavedBundleRecord } from "../contract/storage";

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

function makeInput(
  entity: string,
  id: string,
): Omit<SavedBundleRecord, "key"> {
  return {
    entity,
    id,
    savedAt: "2026-06-14T00:00:00.000Z",
    schemaVersion: 1,
    status: "saving",
    snapshot: { hello: "world" },
    imageKeys: [],
  };
}

describe("saved-bundles store", () => {
  it("put выводит key из entity+id; get возвращает запись", async () => {
    await putSavedBundle(makeInput("lectures", "l1"));
    const got = await getSavedBundle("lectures", "l1");
    expect(got?.key).toBe("lectures:l1");
    expect(got?.status).toBe("saving");
  });

  it("get несуществующей → undefined", async () => {
    expect(await getSavedBundle("lectures", "nope")).toBeUndefined();
  });

  it("list возвращает все; listByEntity фильтрует", async () => {
    await putSavedBundle(makeInput("lectures", "l1"));
    await putSavedBundle(makeInput("lectures", "l2"));
    await putSavedBundle(makeInput("documents", "d1"));
    expect((await listSavedBundles()).length).toBe(3);
    const lectures = await listSavedBundlesByEntity("lectures");
    expect(lectures.map((r) => r.id).sort()).toEqual(["l1", "l2"]);
  });

  it("listByStatus фильтрует по статусу (recovery зависших saving)", async () => {
    await putSavedBundle(makeInput("lectures", "l1")); // saving
    await putSavedBundle({ ...makeInput("lectures", "l2"), status: "complete" });
    expect((await listSavedBundlesByStatus("saving")).map((r) => r.id)).toEqual([
      "l1",
    ]);
    expect(
      (await listSavedBundlesByStatus("complete")).map((r) => r.id),
    ).toEqual(["l2"]);
  });

  it("delete удаляет по entity+id", async () => {
    await putSavedBundle(makeInput("lectures", "l1"));
    await deleteSavedBundle("lectures", "l1");
    expect(await getSavedBundle("lectures", "l1")).toBeUndefined();
  });

  it("update мёржит patch (status, error, snapshot — для reconcile)", async () => {
    await putSavedBundle(makeInput("lectures", "l1"));
    await updateSavedBundle("lectures", "l1", {
      status: "error",
      error: "boom",
      snapshot: { reconciled: true },
    });
    const got = await getSavedBundle("lectures", "l1");
    expect(got?.status).toBe("error");
    expect(got?.error).toBe("boom");
    expect(got?.snapshot).toEqual({ reconciled: true });
  });

  it("update на несуществующей — no-op", async () => {
    await updateSavedBundle("lectures", "nope", { status: "complete" });
    expect(await getSavedBundle("lectures", "nope")).toBeUndefined();
  });
});
