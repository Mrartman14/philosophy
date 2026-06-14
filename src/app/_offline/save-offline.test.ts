// src/app/_offline/save-offline.test.ts
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, it, expect, beforeEach, vi } from "vitest";

// vi.hoisted: фабрика vi.mock хойстится выше const'ов; мок, разыменованный
// СРАЗУ в возвращаемом объекте фабрики, обязан быть создан через vi.hoisted,
// иначе TDZ «Cannot access before initialization» (проверено эмпирически).
const assembleMock = vi.hoisted(() => vi.fn());
vi.mock("./save-offline-action", () => ({
  assembleOfflineBundle: assembleMock,
}));

const cacheImageMock = vi.hoisted(() => vi.fn());
vi.mock("@/services/offline/store/images", () => ({
  cacheImage: cacheImageMock,
}));

vi.mock("@/services/offline/store/persistence", () => ({
  requestPersistentStorage: () => Promise.resolve(true),
}));

import { getSavedBundle } from "@/services/offline/store/saved-bundles";
import { resolveStorageUrl } from "@/utils/storage-url";

import { saveOffline } from "./save-offline";

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  assembleMock.mockReset();
  cacheImageMock.mockReset();
});

describe("saveOffline", () => {
  it("успех: снимок в IDB, картинки в кэш, статус complete", async () => {
    assembleMock.mockResolvedValue({
      success: true,
      data: { snapshot: { t: 1 }, imageKeys: ["a", "b"] },
    });
    cacheImageMock.mockResolvedValue(true);

    const res = await saveOffline("lectures", "l1");

    expect(res).toEqual({ ok: true });
    expect(cacheImageMock).toHaveBeenCalledTimes(2);
    expect(cacheImageMock).toHaveBeenCalledWith(resolveStorageUrl("a"));
    const rec = await getSavedBundle("lectures", "l1");
    expect(rec?.status).toBe("complete");
    expect(rec?.snapshot).toEqual({ t: 1 });
  });

  it("частичный сбой картинок → статус error, ok:false", async () => {
    assembleMock.mockResolvedValue({
      success: true,
      data: { snapshot: {}, imageKeys: ["a", "b"] },
    });
    cacheImageMock.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const res = await saveOffline("lectures", "l1");

    expect(res.ok).toBe(false);
    expect((await getSavedBundle("lectures", "l1"))?.status).toBe("error");
  });

  it("сущность недоступна (data=null) → ok:false, ничего не пишем", async () => {
    assembleMock.mockResolvedValue({ success: true, data: null });

    const res = await saveOffline("lectures", "l1");

    expect(res.ok).toBe(false);
    expect(await getSavedBundle("lectures", "l1")).toBeUndefined();
  });

  it("ошибка экшена → ok:false с текстом ошибки", async () => {
    assembleMock.mockResolvedValue({ success: false, error: "boom" });

    const res = await saveOffline("lectures", "l1");

    expect(res).toEqual({ ok: false, error: "boom" });
  });
});
