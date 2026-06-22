// src/features/media/api.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

import { getAdminMedia, getMediaById, getMediaContainers, getMyMedia } from "./api";

// createApiClient — единственная внешняя зависимость. Стабим её.
const getMock = vi.fn();
vi.mock("@/api/client", () => ({
  createApiClient: () => Promise.resolve({ GET: getMock }),
}));

/** Фейковый ответ openapi-fetch: { data, error, response }. */
function apiResult(opts: { data?: unknown; error?: unknown; status?: number }) {
  const response = new Response(null, { status: opts.status ?? 200 });
  return { data: opts.data, error: opts.error, response };
}

beforeEach(() => {
  getMock.mockReset();
});

// ---------------------------------------------------------------------------
// getMediaById — 404 → null, error → throw, success → unwrap
// ---------------------------------------------------------------------------
describe("getMediaById — 404 → null", () => {
  it("возвращает null при 404 (secure-by-obscurity: «не видно» ≡ «не существует»)", async () => {
    getMock.mockResolvedValue(apiResult({ status: 404, data: null }));

    expect(await getMediaById("m-404")).toBeNull();
  });

  it("возвращает null, если data.data отсутствует в ответе 200", async () => {
    getMock.mockResolvedValue(apiResult({ data: { data: null } }));

    expect(await getMediaById("m-no-data")).toBeNull();
  });

  it("возвращает медиа-объект при успешном ответе", async () => {
    const media = { id: "m-1", file_type: "video", url: "https://cdn.example.com/v.mp4" };
    getMock.mockResolvedValue(apiResult({ data: { data: media } }));

    const result = await getMediaById("m-1");

    expect(result).toEqual(media);
  });

  it("бросает при ошибке (не 404)", async () => {
    getMock.mockResolvedValue(
      apiResult({ error: { error: "forbidden" }, status: 403 }),
    );

    await expect(getMediaById("m-403")).rejects.toThrow("forbidden");
  });
});

// ---------------------------------------------------------------------------
// getMediaContainers — 404 → [] (пустой список)
// ---------------------------------------------------------------------------
describe("getMediaContainers — 404 → []", () => {
  it("возвращает [] при 404 (медиа без attachments)", async () => {
    getMock.mockResolvedValue(apiResult({ status: 404, data: null }));

    const result = await getMediaContainers("m-404");

    expect(result).toEqual([]);
  });

  it("возвращает [] если data.data отсутствует при 200", async () => {
    getMock.mockResolvedValue(apiResult({ data: { data: null } }));

    const result = await getMediaContainers("m-empty");

    expect(result).toEqual([]);
  });

  it("возвращает список контейнеров при успешном ответе", async () => {
    const attachment = { container_id: "lec-1", media_id: "m-5" };
    getMock.mockResolvedValue(apiResult({ data: { data: [attachment] } }));

    const result = await getMediaContainers("m-5");

    expect(result).toEqual([attachment]);
  });

  it("бросает при ошибке (не 404)", async () => {
    getMock.mockResolvedValue(
      apiResult({ error: { error: "internal" }, status: 500 }),
    );

    await expect(getMediaContainers("m-500")).rejects.toThrow("internal");
  });
});

// ---------------------------------------------------------------------------
// getMyMedia — pagination defaults через unwrapList
// ---------------------------------------------------------------------------
describe("getMyMedia — pagination defaults (через unwrapList)", () => {
  it("возвращает переданные offset/limit, если pagination отсутствует", async () => {
    getMock.mockResolvedValue(apiResult({ data: { data: [], pagination: null } }));

    const result = await getMyMedia({ offset: 10, limit: 5 });

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.offset).toBe(10);
    expect(result.limit).toBe(5);
  });

  it("использует дефолты offset=0, limit=20 если filter не передан и pagination отсутствует", async () => {
    getMock.mockResolvedValue(apiResult({ data: { data: [], pagination: undefined } }));

    const result = await getMyMedia();

    expect(result.offset).toBe(0);
    expect(result.limit).toBe(20);
  });

  it("использует pagination из ответа, если он присутствует", async () => {
    getMock.mockResolvedValue(
      apiResult({
        data: {
          data: [],
          pagination: { total: 42, offset: 20, limit: 20 },
        },
      }),
    );

    const result = await getMyMedia({ offset: 20, limit: 20 });

    expect(result.total).toBe(42);
    expect(result.offset).toBe(20);
    expect(result.limit).toBe(20);
  });

  it("бросает при error-ответе (нет деградации для авторизованных списков)", async () => {
    getMock.mockResolvedValue(
      apiResult({ error: { error: "unauthorized" }, status: 401 }),
    );

    await expect(getMyMedia()).rejects.toThrow("unauthorized");
  });
});

// ---------------------------------------------------------------------------
// getAdminMedia — admin-список (GET /api/admin/media)
// ---------------------------------------------------------------------------
describe("getAdminMedia — admin-список", () => {
  it("пробрасывает offset/limit и owner_id в query, когда owner_id задан", async () => {
    getMock.mockResolvedValue(
      apiResult({ data: { data: [], pagination: { total: 0, offset: 0, limit: 20 } } }),
    );

    await getAdminMedia({ offset: 0, limit: 20, owner_id: "u-7" });

    expect(getMock).toHaveBeenCalledWith("/api/admin/media", {
      params: { query: { offset: 0, limit: 20, owner_id: "u-7" } },
    });
  });

  it("НЕ пробрасывает owner_id, когда он пустой/не задан", async () => {
    getMock.mockResolvedValue(
      apiResult({ data: { data: [], pagination: { total: 0, offset: 0, limit: 20 } } }),
    );

    await getAdminMedia({ offset: 0, limit: 20 });

    expect(getMock).toHaveBeenCalledWith("/api/admin/media", {
      params: { query: { offset: 0, limit: 20 } },
    });
  });

  it("использует дефолты offset=0, limit=20 без filter", async () => {
    getMock.mockResolvedValue(apiResult({ data: { data: [], pagination: null } }));

    const result = await getAdminMedia();

    expect(result.offset).toBe(0);
    expect(result.limit).toBe(20);
    expect(result.items).toEqual([]);
  });

  it("разворачивает items/total через unwrapList", async () => {
    const media = { id: "m-1", filename: "a.mp4", type: "video", owner_id: "u-1", visibility: "public", created_at: "2026-06-01T00:00:00Z" };
    getMock.mockResolvedValue(
      apiResult({ data: { data: [media], pagination: { total: 5, offset: 0, limit: 20 } } }),
    );

    const result = await getAdminMedia({ offset: 0, limit: 20 });

    expect(result.items).toEqual([media]);
    expect(result.total).toBe(5);
  });

  it("бросает при error-ответе (403/401 не деградируем)", async () => {
    getMock.mockResolvedValue(
      apiResult({ error: { error: "forbidden" }, status: 403 }),
    );

    await expect(getAdminMedia()).rejects.toThrow("forbidden");
  });
});
