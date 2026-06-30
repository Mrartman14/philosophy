// src/features/trails/api.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

import { getTrails, getMyTrails, getAdminTrails } from "./api";

// createApiClient — единственная внешняя зависимость фетчеров. Стабим её, чтобы
// проверить чистый маппинг запроса: единый GET /api/trails со scope-фасетом
// (старые /api/trails/my и /api/admin/trails УДАЛЕНЫ бекендом — см. schema.ts).
const getMock = vi.fn();
vi.mock("@/api/client", () => ({
  createApiClient: () => Promise.resolve({ GET: getMock }),
}));

/** Фейковый ответ openapi-fetch: { data: { data, pagination }, error, response }. */
function okList(items: unknown[], total = items.length) {
  return {
    data: { data: items, pagination: { total, offset: 0, limit: 20 } },
    error: undefined,
    response: new Response(null, { status: 200 }),
  };
}

beforeEach(() => {
  getMock.mockReset();
  getMock.mockResolvedValue(okList([]));
});

describe("getTrails — единый /api/trails?scope=visible", () => {
  it("бьёт /api/trails со scope=visible (дефолт-фасет, передаём ЯВНО)", async () => {
    await getTrails({ offset: 10, limit: 20 });

    expect(getMock).toHaveBeenCalledWith("/api/trails", {
      params: { query: { scope: "visible", offset: 10, limit: 20 } },
    });
  });

  it("маппит ответ в TrailListResult", async () => {
    getMock.mockResolvedValue(okList([{ id: "t1" }], 1));
    const r = await getTrails();
    expect(r.items).toEqual([{ id: "t1" }]);
    expect(r.total).toBe(1);
  });
});

describe("getMyTrails — /api/trails?scope=mine", () => {
  it("бьёт единый /api/trails со scope=mine (НЕ удалённый /api/trails/my)", async () => {
    await getMyTrails({ offset: 0, limit: 20 });

    expect(getMock).toHaveBeenCalledWith("/api/trails", {
      params: { query: { scope: "mine", offset: 0, limit: 20 } },
    });
    // Старая ручка не должна вызываться.
    expect(getMock).not.toHaveBeenCalledWith("/api/trails/my", expect.anything());
  });

  it("проброс offset/limit", async () => {
    await getMyTrails({ offset: 40, limit: 5 });
    expect(getMock).toHaveBeenCalledWith("/api/trails", {
      params: { query: { scope: "mine", offset: 40, limit: 5 } },
    });
  });

  it("error → бросает", async () => {
    getMock.mockResolvedValue({
      data: undefined,
      error: { error: "boom" },
      response: new Response(null, { status: 500 }),
    });
    await expect(getMyTrails()).rejects.toThrow("boom");
  });
});

describe("getAdminTrails — /api/trails?scope=all", () => {
  it("бьёт единый /api/trails со scope=all (НЕ удалённый /api/admin/trails)", async () => {
    await getAdminTrails({ offset: 0, limit: 20 });

    expect(getMock).toHaveBeenCalledWith("/api/trails", {
      params: { query: { scope: "all", offset: 0, limit: 20 } },
    });
    expect(getMock).not.toHaveBeenCalledWith("/api/admin/trails", expect.anything());
  });

  it("owner-фильтр прокидывается как owner_id (только на scope=all)", async () => {
    await getAdminTrails({ ownerId: "u-42", offset: 0, limit: 20 });

    expect(getMock).toHaveBeenCalledWith("/api/trails", {
      params: { query: { scope: "all", offset: 0, limit: 20, owner_id: "u-42" } },
    });
  });

  it("без ownerId owner_id не отправляется", async () => {
    await getAdminTrails();
    const callArg = getMock.mock.calls[0]?.[1] as
      | { params: { query: Record<string, unknown> } }
      | undefined;
    expect(callArg?.params.query).not.toHaveProperty("owner_id");
  });
});
