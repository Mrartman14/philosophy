// src/features/users/api.ts
import "server-only";
import { cache } from "react";

import { createApiClient } from "@/api/client";

import type { AdminUser } from "./types";

export interface UserListFilter {
  offset?: number;
  limit?: number;
}

export interface UserListResult {
  items: AdminUser[];
  total: number;
  offset: number;
  limit: number;
}

/**
 * GET /api/admin/users — список пользователей (offset/limit пагинация).
 * Гейтится на беке capability user.list. React.cache дедуплицирует в рамках
 * одного запроса; cross-request кеш не используем — админ-список должен быть
 * свежим. Тег Tags.USERS зарезервирован в src/api/tags.ts для инвалидации.
 */
export const getUsers = cache(
  async (filter: UserListFilter = {}): Promise<UserListResult> => {
    const api = await createApiClient();
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 50;
    const { data, error } = await api.GET("/api/admin/users", {
      params: { query: { offset, limit } },
    });
    if (error) {
      throw new Error(error.error ?? "Не удалось загрузить пользователей");
    }
    return {
      items: data.data ?? [],
      total: data.pagination?.total ?? 0,
      offset: data.pagination?.offset ?? offset,
      limit: data.pagination?.limit ?? limit,
    };
  },
);
