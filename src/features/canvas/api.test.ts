// src/features/canvas/api.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCanvasById } from "./api";

// createApiClient — единственная внешняя зависимость getCanvasById. Стабим её,
// чтобы прогнать чистый маппинг ответа (data + заголовок ETag → CanvasWithETag)
// без реального бекенда. Источник истины по формату ETag — handler.go.
const getMock = vi.fn();
vi.mock("@/api/client", () => ({
  createApiClient: async () => ({ GET: getMock }),
}));

/** Фейковый ответ openapi-fetch: { data, error, response: Response }. */
function apiResult(opts: {
  data?: unknown;
  error?: unknown;
  status?: number;
  etag?: string | null;
}) {
  const headers = new Headers();
  if (opts.etag != null) headers.set("ETag", opts.etag);
  const response = new Response(null, { status: opts.status ?? 200, headers });
  return { data: opts.data, error: opts.error, response };
}

beforeEach(() => {
  getMock.mockReset();
});

describe("getCanvasById — ETag-маппинг", () => {
  it("возвращает { canvas, etag } из заголовка ETag ответа (с кавычками, .000Z)", async () => {
    // Бек эмитит ETag в фиксированном формате `"...000Z"` с кавычками — это
    // ровно то значение, что должно уйти обратно как If-Match. Хвостовой ноль
    // (`:00.000Z`) — тот самый кейс, где JSON updated_at обрезался бы до `:00Z`.
    const canvas = { id: "c-etag-1", title: "T", updated_at: "2026-06-13T10:00:00Z" };
    getMock.mockResolvedValue(
      apiResult({ data: { data: canvas }, etag: `"2026-06-13T10:00:00.000Z"` }),
    );

    const result = await getCanvasById("c-etag-1");

    expect(result).not.toBeNull();
    expect(result?.canvas).toEqual(canvas);
    // etag берётся из заголовка, НЕ из JSON updated_at — кавычки и .000Z сохранены.
    expect(result?.etag).toBe(`"2026-06-13T10:00:00.000Z"`);
  });

  it("etag = null, если бек не прислал заголовок ETag", async () => {
    getMock.mockResolvedValue(
      apiResult({ data: { data: { id: "c-no-etag" } }, etag: null }),
    );

    const result = await getCanvasById("c-no-etag");
    expect(result?.etag).toBeNull();
  });

  it("404 → null", async () => {
    getMock.mockResolvedValue(apiResult({ status: 404, data: null }));
    expect(await getCanvasById("c-404")).toBeNull();
  });

  it("error → бросает", async () => {
    getMock.mockResolvedValue(apiResult({ error: { error: "boom" }, status: 500 }));
    await expect(getCanvasById("c-err")).rejects.toThrow("boom");
  });
});
