// src/features/events/api.ts
import "server-only";
import { unstable_cache } from "next/cache";
import { cache } from "react";

import { createApiClient, createPublicApiClient } from "@/api/client";
import { Tags } from "@/api/tags";

import type {
  CalendarEvent,
  EventOccurrence,
  EventRevision,
  EventRevisionMeta,
} from "./types";

export interface EventListFilter {
  offset?: number;
  limit?: number;
}

export interface EventListResult {
  items: CalendarEvent[];
  total: number;
  offset: number;
  limit: number;
}

/** Admin-список событий (бек: default limit 20, max 100; гейт event.read). */
export const getAdminEvents = cache(
  async (filter: EventListFilter = {}): Promise<EventListResult> => {
    const api = await createApiClient();
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 20;
    const { data, error } = await api.GET("/api/admin/events", {
      params: { query: { offset, limit } },
    });
    if (error) {
      throw new Error(error.error ?? "Не удалось загрузить события");
    }
    return {
      items: (data?.data ?? []) as CalendarEvent[],
      total: data?.pagination?.total ?? 0,
      offset: data?.pagination?.offset ?? offset,
      limit: data?.pagination?.limit ?? limit,
    };
  },
);

export const getAdminEventById = cache(
  async (id: string): Promise<CalendarEvent | null> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET("/api/admin/events/{id}", {
      params: { path: { id } },
    });
    if (response.status === 404) return null;
    if (error) {
      throw new Error(error.error ?? "Не удалось загрузить событие");
    }
    return (data?.data ?? null) as CalendarEvent | null;
  },
);

/** Список ревизий (бек гейтит на event.update; без пагинации). */
export const getEventRevisions = cache(
  async (id: string): Promise<EventRevisionMeta[]> => {
    const api = await createApiClient();
    const { data, error } = await api.GET(
      "/api/admin/events/{id}/revisions",
      { params: { path: { id } } },
    );
    if (error) {
      throw new Error(error.error ?? "Не удалось загрузить ревизии");
    }
    return (data?.data ?? []) as EventRevisionMeta[];
  },
);

export const getEventRevision = cache(
  async (id: string, revisionId: string): Promise<EventRevision | null> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET(
      "/api/admin/events/{id}/revisions/{revisionID}",
      { params: { path: { id, revisionID: revisionId } } },
    );
    if (response.status === 404) return null;
    if (error) {
      throw new Error(error.error ?? "Не удалось загрузить ревизию");
    }
    return (data?.data ?? null) as EventRevision | null;
  },
);

/**
 * Публичный календарь. from/to — YYYY-MM-DD; бек требует оба параметра,
 * to >= from, диапазон ≤ 366 дней. Мы всегда передаём границы одного месяца
 * (см. resolveMonthRange).
 *
 * Auth-free (createPublicApiClient) → единственный, помимо getCommentSchema,
 * кандидат на cross-request кеш. Оборачиваем в unstable_cache с тегом EVENTS;
 * from/to автоматически попадают в ключ (unstable_cache добавляет аргументы к
 * keyParts), поэтому каждый месяц кешируется отдельно. Инвалидация:
 * create/update/deleteEvent зовут revalidateEntity(Tags.EVENTS) (см.
 * actions.ts) → пользовательский флоу всегда свежий. revalidate: 3600 —
 * safety-net на изменения в обход наших server actions.
 */
export const getCalendarOccurrences = unstable_cache(
  async (from: string, to: string): Promise<EventOccurrence[]> => {
    const api = createPublicApiClient();
    const { data, error } = await api.GET("/api/calendar", {
      params: { query: { from, to } },
    });
    if (error) {
      throw new Error(error.error ?? "Не удалось загрузить календарь");
    }
    return (data?.data ?? []) as EventOccurrence[];
  },
  ["calendar-occurrences"],
  { tags: [Tags.EVENTS], revalidate: 3600 },
);
