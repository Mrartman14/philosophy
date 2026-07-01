// src/features/notifications/api.ts
import "server-only";
import { cache } from "react";

import { createApiClient } from "@/api/client";
import { getT } from "@/i18n";

import type {
  AppNotification,
  DocumentSubscription,
  NotificationCounts,
  NotificationDTO,
  NotificationListResult,
  SubscriptionDTO,
  SubscriptionListResult,
} from "./types";

function normalizeNotification(dto: NotificationDTO): AppNotification {
  return {
    id: dto.id ?? "",
    type: dto.type ?? null,
    reason: dto.reason ?? null,
    actorId: dto.actor?.id ?? null,
    actorName: dto.actor?.username ?? null,
    targetId: dto.target_id ?? null,
    targetType: dto.target_type ?? null,
    targetVersion: dto.target_version ?? null,
    groupCount: dto.group_count ?? 1,
    readAt: dto.read_at ?? null,
    seenAt: dto.seen_at ?? null,
    createdAt: dto.created_at ?? null,
    commentLectureId: null,
  };
}

function normalizeSubscription(dto: SubscriptionDTO): DocumentSubscription {
  return {
    id: dto.id ?? "",
    targetId: dto.target_id ?? "",
    targetType: dto.target_type ?? null,
    createdAt: dto.created_at ?? null,
  };
}

/** Лента уведомлений (GET /api/me/notifications). */
export const getNotifications = cache(
  async (offset = 0, limit = 20): Promise<NotificationListResult> => {
    const api = await createApiClient();
    const { data, error } = await api.GET("/api/me/notifications", {
      params: { query: { offset, limit } },
    });
    if (error) throw new Error(error.error ?? (await getT("notifications"))("api.loadNotificationsFailed"));
    const items = (data.data ?? []).map(normalizeNotification);
    // Обогащаем comment.replied хост-лекцией параллельно (N+1, мягкая деградация).
    await Promise.all(
      items.map(async (n) => {
        if (n.type === "comment.replied" && n.targetId) {
          n.commentLectureId = await getCommentLectureId(n.targetId);
        }
      }),
    );
    return {
      items,
      total: data.pagination?.total ?? 0,
      offset: data.pagination?.offset ?? offset,
      limit: data.pagination?.limit ?? limit,
    };
  },
);

/**
 * Хост-лекция комментария (для deep-link comment.replied). Комментарий несёт
 * обязательное lecture_id (comment.Comment). Мягкая деградация → null (карточка
 * без ссылки). N+1 бэк-ask: включить lecture_id в payload уведомления.
 */
const getCommentLectureId = cache(async (commentId: string): Promise<string | null> => {
  try {
    const api = await createApiClient();
    const { data, error } = await api.GET("/api/comments/{id}", {
      params: { path: { id: commentId } },
    });
    if (error) return null;
    return data.data?.lecture_id ?? null;
  } catch {
    return null;
  }
});

/** Счётчики (GET /api/me/notifications/counts). */
export const getNotificationCounts = cache(async (): Promise<NotificationCounts> => {
  const api = await createApiClient();
  const { data, error } = await api.GET("/api/me/notifications/counts", {});
  if (error) throw new Error(error.error ?? (await getT("notifications"))("api.loadCountsFailed"));
  return { unread: data.data?.unread ?? 0, unseen: data.data?.unseen ?? 0 };
});

/** Подписки текущего пользователя (GET /api/me/subscriptions). */
export const getSubscriptions = cache(
  async (offset = 0, limit = 50): Promise<SubscriptionListResult> => {
    const api = await createApiClient();
    const { data, error } = await api.GET("/api/me/subscriptions", {
      params: { query: { offset, limit } },
    });
    if (error) throw new Error(error.error ?? (await getT("notifications"))("api.loadSubscriptionsFailed"));
    return {
      items: (data.data ?? []).map(normalizeSubscription),
      total: data.pagination?.total ?? 0,
      offset: data.pagination?.offset ?? offset,
      limit: data.pagination?.limit ?? limit,
    };
  },
);

/**
 * Приватный хелпер: подписан ли пользователь на сущность данного типа.
 * Interim: бэк не отдаёт `subscribed` в detail-ответах — сканируем первую
 * страницу подписок (limit 100). Backend-ask (Task 16): N+1 при большом числе
 * подписок, деградирует мягко → false.
 */
const getEntitySubscription = cache(
  async (targetType: string, targetId: string): Promise<boolean> => {
    try {
      const api = await createApiClient();
      const { data, error } = await api.GET("/api/me/subscriptions", {
        params: { query: { offset: 0, limit: 100 } },
      });
      if (error) return false;
      return (data.data ?? []).some(
        (s) => s.target_type === targetType && s.target_id === targetId,
      );
    } catch {
      // Сетевой сбой (fetch reject) — тоже мягкая деградация: показываем «Подписаться».
      return false;
    }
  },
);

/** Подписан ли пользователь на документ. */
export const getDocumentSubscription = (documentId: string): Promise<boolean> =>
  getEntitySubscription("document", documentId);

/** Подписан ли пользователь на лекцию. */
export const getLectureSubscription = (lectureId: string): Promise<boolean> =>
  getEntitySubscription("lecture", lectureId);
