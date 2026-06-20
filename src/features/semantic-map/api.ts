// src/features/semantic-map/api.ts
import "server-only";
import { cache } from "react";

import { makeFixtureMap } from "./fixtures";
import type { MapData } from "./types";

/**
 * Карта смыслов. Read-only.
 *
 * БЭКЕНД-АГНОСТИК-ГРАНИЦА: сейчас возвращает фикстуру контрактной формы. Бэкенд
 * `/api/map` УЖЕ В СХЕМЕ (@/api/schema: `semmap.Layout`/`semmap.Point`). При swap'е
 * учесть реальный контракт (отличается от ручных типов в ./types):
 *   const api = await createApiClient();
 *   const { data, error } = await api.GET("/api/map");   // ответ в .data-конверте (httputil.Response)
 *   if (error) throw new Error(error.message);
 *   return parseMapResponse(data.data);                  // распаковать .data
 * Реальная схема: ВСЕ поля optional; `layout_version` — string (content-hash);
 * статусы 503 MAP_NOT_READY (карта до первой сборки) и 304/ETag (If-None-Match).
 * Перед swap'ом: сузить ./types и ./schemas из @/api/schema (semmap.*),
 * ослабить required-поля в parseMapResponse, обработать 503/ETag. Нормализатор уже
 * толерантен (нет bounds → из точек; нет coords → 0; неизвестный type → generic).
 *
 * `count` — dev-only stress-параметр (см. /map?n=). В реальном пути игнорируется.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- fixture stub; real path uses await api.GET(...)
export const getMap = cache(async (count?: number): Promise<MapData> => {
  return makeFixtureMap(count ? { count } : {});
});
