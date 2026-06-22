// src/features/semantic-map/actions.ts
"use server";
import "server-only";

import { createApiClient } from "@/api/client";
import { rethrowApiError } from "@/utils/api-error";
import { createAction } from "@/utils/create-action";

import type { MapPointDetail } from "./types";

/**
 * Детали точек карты по id (батч). Read-only, optional-auth, без Idempotency-Key.
 * Бэк резолвит ТОЛЬКО id из опубликованной публичной раскладки; неизвестные id
 * молча отсутствуют в ответе. v1 зовёт с одним id (клик), но сигнатура батчевая —
 * будущий вьюпорт-префетч (кэп 300) включается без смены контракта.
 */
export const getMapPointDetails = createAction(
  async (ids: string[]): Promise<Record<string, MapPointDetail>> => {
    const api = await createApiClient();
    const { data, error } = await api.POST("/api/map/points", { body: { ids } });
    if (error) rethrowApiError(error);
    // После guard `if (error)` openapi-fetch сужает `data` до non-undefined;
    // оптика `?? {}` покрывает только отсутствие поля-конверта `.data` (пустая карта).
    return data.data ?? {};
  },
  "getMapPointDetails",
);
