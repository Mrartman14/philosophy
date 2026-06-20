// src/features/semantic-map/api.ts
import "server-only";
import { cache } from "react";

import { makeFixtureMap } from "./fixtures";
import type { MapData } from "./types";

/**
 * Карта смыслов. Read-only.
 *
 * БЭКЕНД-АГНОСТИК-ГРАНИЦА: сейчас возвращает фикстуру контрактной формы. Когда
 * /api/map появится в @/api/schema.ts — заменить тело на:
 *   const api = await createApiClient();
 *   const { data, error } = await api.GET("/api/map");
 *   if (error) throw new Error(error.message);
 *   return parseMapResponse(data);   // ./schemas
 * Сигнатура и потребители (нормализатор/рендерер/UI) не меняются.
 *
 * `count` — dev-only stress-параметр (см. /map?n=). В реальном пути игнорируется.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- fixture stub; real path uses await api.GET(...)
export const getMap = cache(async (count?: number): Promise<MapData> => {
  return makeFixtureMap(count ? { count } : {});
});
