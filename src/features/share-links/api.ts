// src/features/share-links/api.ts
import "server-only";
import { cache } from "react";

import { createApiClient } from "@/api/client";

import type { ShareLink, ResourceType } from "./types";

/**
 * Ссылки одного ресурса (владелец или share_link.moderate).
 * GET /api/share-links?resource_type=&resource_id= — оба query обязательны.
 * Бек на чужой/несуществующий ресурс отдаёт 404 → возвращаем [] (страница
 * показывает «нет ссылок», не падает).
 *
 * НЕ оборачиваем в unstable_cache: данные пер-юзерные и редко читаются;
 * React.cache дедуплицирует в рамках одного запроса.
 */
export const getShareLinksFor = cache(
  async (
    resourceType: ResourceType,
    resourceId: string,
  ): Promise<ShareLink[]> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET("/api/share-links", {
      params: {
        query: { resource_type: resourceType, resource_id: resourceId },
      },
    });
    if (response.status === 404) return [];
    if (error) {
      throw new Error(error.error ?? "Не удалось загрузить ссылки");
    }
    return (data.data ?? []) as ShareLink[];
  },
);

/**
 * Admin-вариант: ссылки любого ресурса без ownership-чека.
 * GET /api/admin/share-links?resource_type=&resource_id= (требует
 * share_link.moderate; гейт — на странице через Layer-3 forbidden()).
 */
export const getAdminShareLinksFor = cache(
  async (
    resourceType: ResourceType,
    resourceId: string,
  ): Promise<ShareLink[]> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET("/api/admin/share-links", {
      params: {
        query: { resource_type: resourceType, resource_id: resourceId },
      },
    });
    if (response.status === 404) return [];
    if (error) {
      throw new Error(error.error ?? "Не удалось загрузить ссылки");
    }
    return (data.data ?? []) as ShareLink[];
  },
);
