// src/services/offline/store/images.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { cacheImage, hasCachedImage, matchCachedImage } from "./images";

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

beforeEach(() => {
  const cache = new FakeCache();
  vi.stubGlobal("caches", { open: vi.fn().mockResolvedValue(cache) });
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
});
