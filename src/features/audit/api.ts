// src/features/audit/api.ts
import "server-only";
import { cache } from "react";

import { createApiClient } from "@/api/client";
import { getT } from "@/i18n";
import { unwrapList } from "@/utils/api-unwrap";

import type { AuditTargetType } from "./target-types";
import type { AuditRecord } from "./types";

export interface AuditLogFilter {
  /** Точное равенство actor_user_id (UUID). По username бек не ищет. */
  actor?: string;
  target_type?: AuditTargetType;
  target_id?: string;
  /** Точное равенство, формат domain.verb (например, lecture.create). */
  action?: string;
  /** RFC3339. */
  from?: string;
  /** RFC3339. */
  to?: string;
  offset?: number;
  /** Бек: default 50, max 100. */
  limit?: number;
}

export interface AuditLogResult {
  items: AuditRecord[];
  total: number;
  offset: number;
  limit: number;
}

/**
 * Журнал админ-действий. Read-only фича: мутаций нет, revalidateEntity не
 * нужен, поэтому тег в src/api/tags.ts не заводится; unstable_cache не
 * используется (данные авторизованы per-user и постоянно растут).
 * React.cache дедуплицирует вызовы в рамках одного запроса.
 */
export const getAuditLog = cache(
  async (filter: AuditLogFilter = {}): Promise<AuditLogResult> => {
    const api = await createApiClient();
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 50;
    const query: {
      offset: number;
      limit: number;
      actor?: string;
      target_type?: AuditTargetType;
      target_id?: string;
      action?: string;
      from?: string;
      to?: string;
    } = { offset, limit };
    if (filter.actor) query.actor = filter.actor;
    if (filter.target_type) query.target_type = filter.target_type;
    if (filter.target_id) query.target_id = filter.target_id;
    if (filter.action) query.action = filter.action;
    if (filter.from) query.from = filter.from;
    if (filter.to) query.to = filter.to;

    const { data, error } = await api.GET("/api/admin/audit", {
      params: { query },
    });
    if (error) {
      throw new Error(error.error ?? (await getT("audit"))("api.loadLogFailed"));
    }
    return unwrapList(data, { offset, limit });
  },
);
