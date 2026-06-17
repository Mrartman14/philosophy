// src/services/offline/store/images.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { histogram, increment, capture } = vi.hoisted(() => ({
  histogram: vi.fn(),
  increment: vi.fn(),
  capture: vi.fn(),
}));

vi.mock("@/services/observability/client", async () => {
  const { M } = await import("@/services/observability/core/names");
  return {
    metrics: {
      histogram,
      increment,
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      startTimer: () => () => {},
    },
    errors: { capture },
    M,
  };
});

import { M } from "@/services/observability/core/names";

import { OFFLINE_IMAGE_CACHE } from "../contract/storage";

import {
  cacheImage,
  hasCachedImage,
  matchCachedImage,
  clearImageCache,
  clearBrowsedImageCaches,
  clearApiCaches,
} from "./images";

class FakeCache {
  store = new Map<string, Response>();
  put(url: string, res: Response): Promise<void> {
    this.store.set(url, res);
    return Promise.resolve();
  }
  match(url: string): Promise<Response | undefined> {
    return Promise.resolve(this.store.get(url));
  }
}

const cachesDelete = vi.fn().mockResolvedValue(true);
const cachesKeys = vi.fn().mockResolvedValue([]);

beforeEach(() => {
  const cache = new FakeCache();
  cachesDelete.mockClear();
  cachesKeys.mockReset().mockResolvedValue([]);
  vi.stubGlobal("caches", {
    open: vi.fn().mockResolvedValue(cache),
    delete: cachesDelete,
    keys: cachesKeys,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("images cache", () => {
  it("cacheImage кладёт ответ в кэш при 200 → true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("img-bytes", { status: 200 })),
    );
    expect(await cacheImage("/static/files/abc")).toBe(true);
    expect(await hasCachedImage("/static/files/abc")).toBe(true);
  });

  it("cacheImage НЕ кэширует при не-ok → false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("nope", { status: 404 })),
    );
    expect(await cacheImage("/static/files/missing")).toBe(false);
    expect(await hasCachedImage("/static/files/missing")).toBe(false);
  });

  it("matchCachedImage возвращает Response из кэша", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("img-bytes", { status: 200 })),
    );
    await cacheImage("/static/files/abc");
    const res = await matchCachedImage("/static/files/abc");
    expect(res).toBeInstanceOf(Response);
    if (!res) throw new Error("ожидали Response из кэша");
    expect(await res.text()).toBe("img-bytes");
  });

  it("clearImageCache удаляет кэш картинок целиком", async () => {
    await clearImageCache();
    expect(cachesDelete).toHaveBeenCalledWith(OFFLINE_IMAGE_CACHE);
  });

  it("clearBrowsedImageCaches удаляет кэш просмотренных картинок (flbz-images + легаси flbz-images-*), не трогая чужие", async () => {
    cachesKeys.mockResolvedValueOnce([
      "flbz-images", // неверсионируемый (текущий)
      "flbz-images-abc123", // легаси версионированный
      "flbz-images-def456",
      "flbz-offline-images",
      "flbz-static-abc123",
      "flbz-shell",
    ]);
    await clearBrowsedImageCaches();
    expect(cachesDelete).toHaveBeenCalledWith("flbz-images");
    expect(cachesDelete).toHaveBeenCalledWith("flbz-images-abc123");
    expect(cachesDelete).toHaveBeenCalledWith("flbz-images-def456");
    expect(cachesDelete).not.toHaveBeenCalledWith("flbz-offline-images");
    expect(cachesDelete).not.toHaveBeenCalledWith("flbz-static-abc123");
    expect(cachesDelete).not.toHaveBeenCalledWith("flbz-shell");
  });

  it("clearBrowsedImageCaches без подходящих кэшей ничего не удаляет", async () => {
    cachesKeys.mockResolvedValueOnce(["flbz-offline-images", "flbz-shell"]);
    await clearBrowsedImageCaches();
    expect(cachesDelete).not.toHaveBeenCalled();
  });

  it("clearApiCaches удаляет только версионированные API-кэши (flbz-api-*), не трогая чужие", async () => {
    cachesKeys.mockResolvedValueOnce([
      "flbz-api-abc123",
      "flbz-api-def456",
      "flbz-offline-images",
      "flbz-images-abc123",
      "flbz-shell",
    ]);
    await clearApiCaches();
    expect(cachesDelete).toHaveBeenCalledWith("flbz-api-abc123");
    expect(cachesDelete).toHaveBeenCalledWith("flbz-api-def456");
    expect(cachesDelete).not.toHaveBeenCalledWith("flbz-offline-images");
    expect(cachesDelete).not.toHaveBeenCalledWith("flbz-images-abc123");
    expect(cachesDelete).not.toHaveBeenCalledWith("flbz-shell");
  });
});

describe("cacheImage observability", () => {
  beforeEach(() => {
    histogram.mockClear();
    increment.mockClear();
    capture.mockClear();
    vi.stubGlobal("caches", {
      open: vi.fn().mockResolvedValue({ put: vi.fn().mockResolvedValue(undefined) }),
    });
  });

  it("records api.duration on cached fetch", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("img", { status: 200 })));
    const ok = await cacheImage("/static/files/a.png");
    expect(ok).toBe(true);
    expect(histogram).toHaveBeenCalledWith(
      M.apiRequestDuration,
      expect.any(Number),
      { transport: "fetch", surface: "offline.image", status: 200 },
    );
  });

  it("records api.error and rethrows on network throw", async () => {
    const boom = new TypeError("fetch failed");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(boom));
    await expect(cacheImage("/static/files/a.png")).rejects.toBe(boom);
    expect(increment).toHaveBeenCalledWith(
      M.apiRequestError,
      { transport: "fetch", surface: "offline.image", errorClass: "network" },
    );
    expect(capture).toHaveBeenCalledWith(boom, { errorClass: "network", handled: false, attributes: { surface: "offline.image" } });
  });
});
