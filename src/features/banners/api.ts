// src/features/banners/api.ts
import "server-only";
import { cache } from "react";

import { createApiClient } from "@/api/client";
import { getT } from "@/i18n";
import { unwrap, unwrapList } from "@/utils/api-unwrap";

import type { Banner, BannerRevision, BannerRevisionMeta } from "./types";

export interface BannerListFilter {
  offset?: number;
  limit?: number;
}

export interface BannerListResult {
  items: Banner[];
  total: number;
  offset: number;
  limit: number;
}

/** Admin-список баннеров (бек: default limit 20, max 100; гейт banner.read). */
export const getAdminBanners = cache(
  async (filter: BannerListFilter = {}): Promise<BannerListResult> => {
    const api = await createApiClient();
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 20;
    const { data, error } = await api.GET("/api/admin/banners", {
      params: { query: { offset, limit } },
    });
    if (error) {
      throw new Error(error.error ?? (await getT("banners"))("api.loadListFailed"));
    }
    return unwrapList(data, { offset, limit });
  },
);

export const getAdminBannerById = cache(
  async (id: string): Promise<Banner | null> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET("/api/admin/banners/{id}", {
      params: { path: { id } },
    });
    if (response.status === 404) return null;
    if (error) {
      throw new Error(error.error ?? (await getT("banners"))("api.loadItemFailed"));
    }
    return unwrap(data);
  },
);

/** Список ревизий (бек гейтит на banner.update; без пагинации). */
export const getBannerRevisions = cache(
  async (id: string): Promise<BannerRevisionMeta[]> => {
    const api = await createApiClient();
    const { data, error } = await api.GET(
      "/api/admin/banners/{id}/revisions",
      { params: { path: { id } } },
    );
    if (error) {
      throw new Error(error.error ?? (await getT("banners"))("api.loadRevisionsFailed"));
    }
    return unwrap(data) ?? [];
  },
);

export const getBannerRevision = cache(
  async (id: string, revisionId: string): Promise<BannerRevision | null> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET(
      "/api/admin/banners/{id}/revisions/{revisionID}",
      { params: { path: { id, revisionID: revisionId } } },
    );
    if (response.status === 404) return null;
    if (error) {
      throw new Error(error.error ?? (await getT("banners"))("api.loadRevisionFailed"));
    }
    return unwrap(data);
  },
);

/**
 * Активные баннеры (GET /api/banners/active, optionalAuth). ПЕРСОНАЛИЗИРОВАН:
 * бек фильтрует по аудитории и dismissed текущего пользователя — поэтому
 * только React.cache (per-request), без unstable_cache. createApiClient
 * прикладывает Bearer лишь при наличии cookie; без cookie запрос анонимный.
 * ВАЖНО: протухший токен в cookie даст 401 (optionalAuth бека отвергает
 * невалидный Bearer) — вызывающий ActiveBanners глотает ошибку.
 */
export const getActiveBanners = cache(async (): Promise<Banner[]> => {
  const api = await createApiClient();
  const { data, error } = await api.GET("/api/banners/active");
  if (error) {
    throw new Error((await getT("banners"))("api.loadListFailed"));
  }
  return unwrap(data) ?? [];
});
