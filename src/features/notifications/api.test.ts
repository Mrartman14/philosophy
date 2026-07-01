// src/features/notifications/api.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  getNotifications,
  getNotificationCounts,
  getDocumentSubscription,
} from "./api";

// createApiClient — единственная внешняя зависимость. Стабим, чтобы тестировать
// ветки деградации и нормализации без реального бекенда.
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
  // React.cache запоминает результат на время render'а. Так как каждый тест
  // запускается в свежем модуле (hoisting), сброс мока достаточен.
});

// ---------------------------------------------------------------------------
// getNotifications — мягкое поведение при отсутствии pagination в ответе
// ---------------------------------------------------------------------------
describe("getNotifications — pagination defaults", () => {
  it("возвращает переданные offset/limit, если bek не прислал pagination", async () => {
    getMock.mockResolvedValue(
      apiResult({ data: { data: [], pagination: null } }),
    );

    const result = await getNotifications(5, 15);

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.offset).toBe(5);
    expect(result.limit).toBe(15);
  });

  it("нормализует DTO: опциональные поля становятся not-null с дефолтами", async () => {
    const dto = {
      id: "n-1",
      type: "document.updated",
      reason: "subscribed",
      // остальные поля намеренно отсутствуют — проверяем дефолты
    };
    getMock.mockResolvedValue(
      apiResult({
        data: {
          data: [dto],
          pagination: { total: 1, offset: 0, limit: 20 },
        },
      }),
    );

    const { items } = await getNotifications();

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "n-1",
      type: "document.updated",
      reason: "subscribed",
      actorId: null,
      actorName: null,
      targetId: null,
      groupCount: 1,
      readAt: null,
      seenAt: null,
      createdAt: null,
    });
  });

  it("маппит actor.username → actorName (атрибуция «от X»)", async () => {
    getMock.mockResolvedValue(
      apiResult({
        data: {
          data: [
            {
              id: "n-2",
              type: "document.updated",
              actor: { id: "u-9", username: "alex_b" },
            },
          ],
          pagination: { total: 1, offset: 0, limit: 20 },
        },
      }),
    );

    const { items } = await getNotifications();

    expect(items[0]).toMatchObject({ actorId: "u-9", actorName: "alex_b" });
  });

  it("бросает ошибку при error-ответе (нет мягкой деградации)", async () => {
    getMock.mockResolvedValue(
      apiResult({ error: { error: "unauthorized" }, status: 401 }),
    );

    await expect(getNotifications()).rejects.toThrow("unauthorized");
  });
});

// ---------------------------------------------------------------------------
// getNotificationCounts — счётчики с мягкой деградацией к нулям
// ---------------------------------------------------------------------------
describe("getNotificationCounts — defaults", () => {
  it("возвращает нули, если data.data отсутствует", async () => {
    getMock.mockResolvedValue(apiResult({ data: { data: null } }));

    const counts = await getNotificationCounts();

    expect(counts.unread).toBe(0);
    expect(counts.unseen).toBe(0);
  });

  it("бросает при error (нет мягкой деградации)", async () => {
    getMock.mockResolvedValue(
      apiResult({ error: { error: "server error" }, status: 500 }),
    );

    await expect(getNotificationCounts()).rejects.toThrow("server error");
  });
});

// ---------------------------------------------------------------------------
// getDocumentSubscription — главный кейс мягкой деградации
// ---------------------------------------------------------------------------
describe("getDocumentSubscription — soft-degrade + boolean derivation", () => {
  it("возвращает true, если среди подписок есть совпадение по target_id", async () => {
    getMock.mockResolvedValue(
      apiResult({
        data: {
          data: [
            { target_type: "document", target_id: "doc-abc", id: "s-1" },
            { target_type: "document", target_id: "doc-xyz", id: "s-2" },
          ],
        },
      }),
    );

    expect(await getDocumentSubscription("doc-abc")).toBe(true);
  });

  it("возвращает false, если совпадения нет (но список не пуст)", async () => {
    getMock.mockResolvedValue(
      apiResult({
        data: {
          data: [{ target_type: "document", target_id: "doc-other", id: "s-3" }],
        },
      }),
    );

    expect(await getDocumentSubscription("doc-missing")).toBe(false);
  });

  it("возвращает false, если data.data пустой массив", async () => {
    getMock.mockResolvedValue(apiResult({ data: { data: [] } }));

    expect(await getDocumentSubscription("doc-any")).toBe(false);
  });

  it("мягкая деградация: возвращает false при error-ответе (не бросает)", async () => {
    getMock.mockResolvedValue(
      apiResult({ error: { error: "network" }, status: 503 }),
    );

    // Не бросает — возвращает false («показываем Подписаться»)
    await expect(getDocumentSubscription("doc-err")).resolves.toBe(false);
  });

  it("мягкая деградация: возвращает false при network-reject (throw в fetch)", async () => {
    getMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(getDocumentSubscription("doc-network-fail")).resolves.toBe(false);
  });

  it("не засчитывает совпадение по чужому target_type (игнорирует не-document)", async () => {
    getMock.mockResolvedValue(
      apiResult({
        data: {
          data: [
            // тот же target_id, но другой тип — не должен засчитываться
            { target_type: "lecture", target_id: "doc-abc", id: "s-4" },
          ],
        },
      }),
    );

    expect(await getDocumentSubscription("doc-abc")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getNotifications — обогащение comment.replied хост-лекцией
// ---------------------------------------------------------------------------
describe("getNotifications — commentLectureId enrichment", () => {
  it("резолвит lecture_id для comment.replied через GET /api/comments/{id}", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === "/api/me/notifications") {
        return Promise.resolve(
          apiResult({
            data: {
              data: [
                { id: "n-1", type: "comment.replied", target_type: "comment", target_id: "cmt-9" },
              ],
              pagination: { total: 1, offset: 0, limit: 20 },
            },
          }),
        );
      }
      // GET /api/comments/{id}
      return Promise.resolve(apiResult({ data: { data: { id: "cmt-9", lecture_id: "lec-42" } } }));
    });

    const { items } = await getNotifications();

    expect(items[0]).toMatchObject({ type: "comment.replied", commentLectureId: "lec-42" });
  });

  it("commentLectureId=null, если GET комментария вернул ошибку (мягкая деградация)", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === "/api/me/notifications") {
        return Promise.resolve(
          apiResult({
            data: {
              data: [
                { id: "n-2", type: "comment.replied", target_type: "comment", target_id: "cmt-gone" },
              ],
              pagination: { total: 1, offset: 0, limit: 20 },
            },
          }),
        );
      }
      return Promise.resolve(apiResult({ error: { error: "not found" }, status: 404 }));
    });

    const { items } = await getNotifications();

    expect(items[0]).toMatchObject({ commentLectureId: null });
  });

  it("не дергает GET комментария для не-comment-типов (commentLectureId=null)", async () => {
    getMock.mockResolvedValue(
      apiResult({
        data: {
          data: [{ id: "n-3", type: "document.updated", target_type: "document", target_id: "doc-1" }],
          pagination: { total: 1, offset: 0, limit: 20 },
        },
      }),
    );

    const { items } = await getNotifications();

    expect(items[0]).toMatchObject({ commentLectureId: null });
    // единственный GET — за уведомлениями; за комментом не ходили
    expect(getMock).toHaveBeenCalledOnce();
  });
});
