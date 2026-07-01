// src/features/forms/api.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

import { getMyForms, getAdminForms } from "./api";

// createApiClient — единственная внешняя зависимость scope-фетчеров. Стабим её,
// чтобы проверить чистый контракт: путь /api/forms, query (scope/owner_id/
// offset/limit) и маппинг пагинированного конверта httputil.ListResponse.
// Старые ручки /api/me/forms и /api/admin/forms УДАЛЕНЫ бекендом — обе формы
// списка теперь идут через единый /api/forms?scope=...
const getMock = vi.fn();
vi.mock("@/api/client", () => ({
  createApiClient: () => Promise.resolve({ GET: getMock }),
}));

// getT не должен дёргаться на happy-path (только в ветке ошибки) — стабим тривиально.
vi.mock("@/i18n", () => ({
  getT: () => Promise.resolve((k: string) => k),
}));

/** Фейковый ответ openapi-fetch: { data, error, response: Response }. */
function apiResult(opts: { data?: unknown; error?: unknown; status?: number }) {
  const response = new Response(null, { status: opts.status ?? 200 });
  return { data: opts.data, error: opts.error, response };
}

/** Пагинированный конверт httputil.ListResponse & { data }. */
function listEnvelope(items: unknown[], pagination?: { total?: number; offset?: number; limit?: number }) {
  return { data: items, pagination: pagination ?? null };
}

beforeEach(() => {
  getMock.mockReset();
});

describe("getMyForms — scope=mine", () => {
  it("дёргает GET /api/forms со scope=mine + offset/limit", async () => {
    getMock.mockResolvedValue(apiResult({ data: listEnvelope([]) }));
    await getMyForms({ offset: 40, limit: 10 });
    expect(getMock).toHaveBeenCalledWith("/api/forms", {
      params: { query: { scope: "mine", offset: 40, limit: 10 } },
    });
  });

  it("дефолтит offset=0/limit=20, scope передаётся ЯВНО", async () => {
    getMock.mockResolvedValue(apiResult({ data: listEnvelope([]) }));
    await getMyForms();
    expect(getMock).toHaveBeenCalledWith("/api/forms", {
      params: { query: { scope: "mine", offset: 0, limit: 20 } },
    });
  });

  it("возвращает ПАГИНИРОВАННЫЙ результат { items, total, offset, limit } (не голый массив)", async () => {
    const items = [
      { id: "f1", title: "A", owner: { id: "u1", username: "me" } },
      { id: "f2", title: "B", owner: { id: "u1", username: "me" } },
    ];
    getMock.mockResolvedValue(
      apiResult({ data: listEnvelope(items, { total: 5, offset: 2, limit: 2 }) }),
    );
    const result = await getMyForms({ offset: 2, limit: 2 });
    expect(result.items).toEqual(items);
    expect(result.total).toBe(5);
    expect(result.offset).toBe(2);
    expect(result.limit).toBe(2);
  });

  it("error → бросает", async () => {
    getMock.mockResolvedValue(apiResult({ error: { error: "boom" }, status: 500 }));
    await expect(getMyForms()).rejects.toThrow("boom");
  });
});

describe("getAdminForms — scope=all", () => {
  it("дёргает GET /api/forms со scope=all + owner_id + offset/limit", async () => {
    getMock.mockResolvedValue(apiResult({ data: listEnvelope([]) }));
    await getAdminForms({ offset: 20, limit: 20, ownerId: "owner-7" });
    expect(getMock).toHaveBeenCalledWith("/api/forms", {
      params: { query: { scope: "all", offset: 20, limit: 20, owner_id: "owner-7" } },
    });
  });

  it("без ownerId — owner_id не попадает в query", async () => {
    getMock.mockResolvedValue(apiResult({ data: listEnvelope([]) }));
    await getAdminForms();
    expect(getMock).toHaveBeenCalledWith("/api/forms", {
      params: { query: { scope: "all", offset: 0, limit: 20 } },
    });
  });

  it("маппит пагинированный конверт в { items, total, offset, limit }", async () => {
    const items = [{ id: "f3", title: "C", owner: { id: "u9", username: "alice" } }];
    getMock.mockResolvedValue(
      apiResult({ data: listEnvelope(items, { total: 1, offset: 0, limit: 20 }) }),
    );
    const result = await getAdminForms();
    expect(result.items).toEqual(items);
    expect(result.total).toBe(1);
  });

  it("error → бросает", async () => {
    getMock.mockResolvedValue(apiResult({ error: { error: "nope" }, status: 403 }));
    await expect(getAdminForms()).rejects.toThrow("nope");
  });
});
