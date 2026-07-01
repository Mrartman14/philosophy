// src/features/documents/api.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

import { getMyDocuments, getAdminDocuments } from "./api";

// createApiClient — единственная внешняя зависимость list-фетчеров. Стабим её,
// чтобы проверить, что после реген-контракта запрос уходит на единый
// scope-фасетный GET /api/documents с явным scope (mine|all), а ответ
// разворачивается через unwrapList в { items, total, offset, limit }.
const getMock = vi.fn();
vi.mock("@/api/client", () => ({
  createApiClient: () => Promise.resolve({ GET: getMock }),
}));

// i18n не должен бить в реальные каталоги в тесте загрузки.
vi.mock("@/i18n", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/i18n")>();
  return { ...actual, getT: () => Promise.resolve((key: string) => key) };
});

/** Фейковый ответ openapi-fetch: { data, error, response }. */
function apiResult(opts: { data?: unknown; error?: unknown; status?: number }) {
  const response = new Response(null, { status: opts.status ?? 200 });
  return { data: opts.data, error: opts.error, response };
}

/** Снять [path, opts] из первого вызова мока с типизацией query (mock.calls — any[]). */
function firstCall(): { path: string; query: Record<string, unknown> } {
  const [path, opts] = getMock.mock.calls[0] as [
    string,
    { params: { query: Record<string, unknown> } },
  ];
  return { path, query: opts.params.query };
}

const listEnvelope = {
  data: [
    {
      id: "d1",
      filename: "doc-1",
      owner: { id: "u1", username: "alice" },
      visibility: "private",
      version: 1,
    },
  ],
  pagination: { total: 1, offset: 0, limit: 20 },
};

beforeEach(() => {
  getMock.mockReset();
});

describe("getMyDocuments — scope=mine", () => {
  it("шлёт GET /api/documents с query scope=mine + offset/limit", async () => {
    getMock.mockResolvedValue(apiResult({ data: listEnvelope }));

    const result = await getMyDocuments({ offset: 0, limit: 20 });

    expect(getMock).toHaveBeenCalledTimes(1);
    const { path, query } = firstCall();
    expect(path).toBe("/api/documents");
    expect(query).toMatchObject({ scope: "mine", offset: 0, limit: 20 });
    // Разворот конверта → items/total.
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe("d1");
    expect(result.total).toBe(1);
  });

  it("free_floating пробрасывается в query (scope=mine)", async () => {
    getMock.mockResolvedValue(apiResult({ data: listEnvelope }));
    await getMyDocuments({ freeFloating: true });
    expect(firstCall().query).toMatchObject({ scope: "mine", free_floating: true });
  });

  it("error → бросает", async () => {
    getMock.mockResolvedValue(apiResult({ error: { error: "boom" }, status: 500 }));
    await expect(getMyDocuments()).rejects.toThrow("boom");
  });
});

describe("getAdminDocuments — scope=all", () => {
  it("шлёт GET /api/documents с query scope=all + offset/limit", async () => {
    getMock.mockResolvedValue(apiResult({ data: listEnvelope }));

    const result = await getAdminDocuments({ offset: 0, limit: 20 });

    expect(getMock).toHaveBeenCalledTimes(1);
    const { path, query } = firstCall();
    expect(path).toBe("/api/documents");
    expect(query).toMatchObject({ scope: "all", offset: 0, limit: 20 });
    expect(result.items[0]?.owner?.id).toBe("u1");
  });

  it("owner_id-фильтр пробрасывается в query (scope=all)", async () => {
    getMock.mockResolvedValue(apiResult({ data: listEnvelope }));
    await getAdminDocuments({ ownerId: "u9" });
    expect(firstCall().query).toMatchObject({ scope: "all", owner_id: "u9" });
  });

  it("error → бросает", async () => {
    getMock.mockResolvedValue(apiResult({ error: { error: "denied" }, status: 403 }));
    await expect(getAdminDocuments()).rejects.toThrow("denied");
  });
});
