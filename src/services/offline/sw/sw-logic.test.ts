// src/services/offline/sw/sw-logic.test.ts
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, it, expect } from "vitest";

import { OFFLINE_IMAGE_CACHE as STORAGE_OFFLINE_IMAGE_CACHE } from "../contract/storage";

import {
  OFFLINE_IMAGE_CACHE,
  SAVED_SHELL_CACHE,
  PRESERVED_CACHES,
  selectCachesToDelete,
  isOfflineFileRequest,
  isSavedShellNavigation,
} from "./sw-logic";

describe("sw-logic: имена кэшей", () => {
  it("OFFLINE_IMAGE_CACHE совпадает с источником истины contract/storage.ts (защита от дрейфа)", () => {
    expect(OFFLINE_IMAGE_CACHE).toBe(STORAGE_OFFLINE_IMAGE_CACHE);
  });

  it("preserved-набор включает офлайн-бакет картинок и shell", () => {
    expect(PRESERVED_CACHES).toContain(OFFLINE_IMAGE_CACHE);
    expect(PRESERVED_CACHES).toContain(SAVED_SHELL_CACHE);
  });
});

describe("sw-logic: инлайн-инвариант", () => {
  it("sw-logic.ts не содержит top-level import (генератор срезает import-строки → висячая ссылка = ReferenceError в SW, который node --check не ловит)", () => {
    // Путь резолвим через dirname(import.meta.url), а не через `new URL(rel, base)`:
    // под jsdom-окружением vitest глобальный `URL` резолвит относительный путь против
    // http://localhost (document base) → fileURLToPath бросает ERR_INVALID_URL_SCHEME.
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, "sw-logic.ts"), "utf-8");
    expect(/^\s*import\b/m.test(src)).toBe(false);
  });
});

describe("selectCachesToDelete", () => {
  const active = ["flbz-static-v2", "flbz-next-v2", "flbz-api-v2", "flbz-images-v2"];

  it("удаляет устаревшие версионированные flbz-кэши", () => {
    const existing = [...active, "flbz-static-v1", "flbz-images-v1"];
    expect(selectCachesToDelete(existing, active)).toEqual([
      "flbz-static-v1",
      "flbz-images-v1",
    ]);
  });

  it("НЕ удаляет офлайн-бакет картинок (переживает обновление SW)", () => {
    const existing = [...active, OFFLINE_IMAGE_CACHE];
    expect(selectCachesToDelete(existing, active)).toEqual([]);
  });

  it("НЕ удаляет shell-кэш", () => {
    const existing = [...active, SAVED_SHELL_CACHE];
    expect(selectCachesToDelete(existing, active)).toEqual([]);
  });

  it("не трогает чужие кэши без префикса flbz", () => {
    const existing = [...active, "workbox-precache", "other-cache"];
    expect(selectCachesToDelete(existing, active)).toEqual([]);
  });

  it("сохраняет активный набор", () => {
    expect(selectCachesToDelete(active, active)).toEqual([]);
  });
});

describe("isOfflineFileRequest", () => {
  it("матчит /static/files/{key} (без расширения)", () => {
    expect(isOfflineFileRequest("/static/files/abc123")).toBe(true);
  });
  it("не матчит /_next/static/...", () => {
    expect(isOfflineFileRequest("/_next/static/chunk.js")).toBe(false);
  });
  it("не матчит произвольный путь", () => {
    expect(isOfflineFileRequest("/lectures/1")).toBe(false);
  });
});

describe("isSavedShellNavigation", () => {
  it("матчит navigate на /saved", () => {
    expect(isSavedShellNavigation("navigate", "/saved")).toBe(true);
  });
  it("матчит navigate на /saved/{id}", () => {
    expect(isSavedShellNavigation("navigate", "/saved/lectures:1")).toBe(true);
  });
  it("НЕ матчит не-navigate (напр. cors-fetch) на /saved", () => {
    expect(isSavedShellNavigation("cors", "/saved")).toBe(false);
  });
  it("НЕ матчит navigate на другой путь", () => {
    expect(isSavedShellNavigation("navigate", "/lectures/1")).toBe(false);
  });
  it("не матчит /savedxyz (граница сегмента)", () => {
    expect(isSavedShellNavigation("navigate", "/savedxyz")).toBe(false);
  });
});
