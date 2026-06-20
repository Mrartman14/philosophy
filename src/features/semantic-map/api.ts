// src/features/semantic-map/api.ts
import "server-only";
import { cache } from "react";

import { createApiClient } from "@/api/client";

import type { MapData } from "./types";

/** Результат загрузки карты: готова / ещё строится (503 MAP_NOT_READY) / ошибка. */
export type MapResult =
  | { ok: true; map: MapData }
  | { ok: false; reason: "building" | "error" };

/**
 * Карта смыслов. Read-only, optional-auth (createApiClient приложит JWT из cookie —
 * бэк скоупит срез по видимости). ETag/304 в v1 не используем (свежий запрос).
 */
export const getMap = cache(async (): Promise<MapResult> => {
  const api = await createApiClient();
  const { data, error, response } = await api.GET("/api/map");
  if (error) {
    if (response.status === 503) return { ok: false, reason: "building" };
    return { ok: false, reason: "error" };
  }
  const layout = data.data;
  if (!layout) return { ok: false, reason: "error" };
  return { ok: true, map: layout };
});
