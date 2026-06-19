// src/app/_offline/probe-lecture-manifest-action.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.hoisted гарантирует, что get доступен до подъёма vi.mock в начало файла
const { get } = vi.hoisted(() => ({ get: vi.fn() }));

// Мок createApiClient — возвращает объект с методом GET
vi.mock("@/api/client", () => ({
  createApiClient: vi.fn().mockResolvedValue({ GET: get }),
}));

// server-only глушим в тестовой среде
vi.mock("server-only", () => ({}));

import { probeLectureManifest } from "./probe-lecture-manifest-action";

describe("probeLectureManifest", () => {
  beforeEach(() => {
    get.mockReset();
  });

  it("304 → fresh", async () => {
    get.mockResolvedValue({
      data: undefined,
      error: "",
      response: { status: 304, ok: false, headers: { get: () => null } },
    });
    expect(await probeLectureManifest("L1", '"5"')).toEqual({ status: "fresh" });
  });

  it("404 → gone", async () => {
    get.mockResolvedValue({
      data: undefined,
      error: {},
      response: { status: 404, ok: false, headers: { get: () => null } },
    });
    expect(await probeLectureManifest("L1", '"5"')).toEqual({ status: "gone" });
  });

  it("200 → stale с новым токеном из ETag", async () => {
    get.mockResolvedValue({
      data: { data: { version: "6" } },
      error: undefined,
      response: {
        status: 200,
        ok: true,
        headers: { get: (h: string) => (h === "ETag" ? '"6"' : null) },
      },
    });
    expect(await probeLectureManifest("L1", '"5"')).toEqual({
      status: "stale",
      freshnessToken: '"6"',
    });
  });

  it("ошибка сети → skip", async () => {
    get.mockRejectedValue(new Error("net"));
    expect(await probeLectureManifest("L1", undefined)).toEqual({
      status: "skip",
    });
  });
});
