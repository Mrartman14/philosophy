import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./store/db", () => ({ wipeOfflineDb: vi.fn() }));
vi.mock("./store/images", () => ({
  clearImageCache: vi.fn(),
  clearBrowsedImageCaches: vi.fn(),
}));

import { wipeOfflineDb } from "./store/db";
import { clearImageCache, clearBrowsedImageCaches } from "./store/images";
import { wipeOfflineData } from "./wipe";

beforeEach(() => {
  vi.mocked(wipeOfflineDb).mockReset().mockResolvedValue();
  vi.mocked(clearImageCache).mockReset().mockResolvedValue();
  vi.mocked(clearBrowsedImageCaches).mockReset().mockResolvedValue();
});

describe("wipeOfflineData", () => {
  it("чистит IndexedDB-сторы, офлайн-картинки и LRU-кэши картинок", async () => {
    await wipeOfflineData();
    expect(wipeOfflineDb).toHaveBeenCalledOnce();
    expect(clearImageCache).toHaveBeenCalledOnce();
    expect(clearBrowsedImageCaches).toHaveBeenCalledOnce();
  });

  it("возвращает true, когда все три подсистемы отработали без сбоя", async () => {
    await expect(wipeOfflineData()).resolves.toBe(true);
  });

  it("best-effort: сбой IndexedDB не мешает чистке кэшей, не бросает, возвращает false", async () => {
    vi.mocked(wipeOfflineDb).mockRejectedValue(new Error("idb fail"));
    await expect(wipeOfflineData()).resolves.toBe(false);
    expect(clearImageCache).toHaveBeenCalledOnce();
    expect(clearBrowsedImageCaches).toHaveBeenCalledOnce();
  });

  it("best-effort: сбой кэша не мешает чистке IndexedDB, не бросает, возвращает false", async () => {
    vi.mocked(clearImageCache).mockRejectedValue(new Error("cache fail"));
    await expect(wipeOfflineData()).resolves.toBe(false);
    expect(wipeOfflineDb).toHaveBeenCalledOnce();
    expect(clearBrowsedImageCaches).toHaveBeenCalledOnce();
  });
});
