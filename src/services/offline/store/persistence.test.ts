// src/services/offline/store/persistence.test.ts
import { describe, it, expect, afterEach, vi } from "vitest";

import {
  requestPersistentStorage,
  isStoragePersisted,
  getStorageEstimate,
} from "./persistence";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("persistence", () => {
  it("requestPersistentStorage проксирует navigator.storage.persist", async () => {
    vi.stubGlobal("navigator", {
      storage: { persist: vi.fn().mockResolvedValue(true) },
    });
    expect(await requestPersistentStorage()).toBe(true);
  });

  it("requestPersistentStorage → false если API недоступен", async () => {
    vi.stubGlobal("navigator", { storage: {} });
    expect(await requestPersistentStorage()).toBe(false);
  });

  it("isStoragePersisted проксирует navigator.storage.persisted", async () => {
    vi.stubGlobal("navigator", {
      storage: { persisted: vi.fn().mockResolvedValue(true) },
    });
    expect(await isStoragePersisted()).toBe(true);
  });

  it("getStorageEstimate нормализует usage/quota (undefined → 0)", async () => {
    vi.stubGlobal("navigator", {
      storage: { estimate: vi.fn().mockResolvedValue({ usage: 1024 }) },
    });
    expect(await getStorageEstimate()).toEqual({ usage: 1024, quota: 0 });
  });

  it("getStorageEstimate → нули если API недоступен", async () => {
    vi.stubGlobal("navigator", { storage: {} });
    expect(await getStorageEstimate()).toEqual({ usage: 0, quota: 0 });
  });
});
