// src/features/events/actions.ts
"use server";
import "server-only";
import { createApiClient } from "@/api/client";
import { Tags } from "@/api/tags";
import { rethrowApiError, type ApiErrorMessages } from "@/utils/api-error";
import {
  createAction,
  createFormAction,
  parseFormData,
} from "@/utils/create-action";
import { idempotencyHeaders } from "@/utils/idempotency";
import { getMe } from "@/utils/me";
import { ifMatchHeader } from "@/utils/optimistic-lock";
import { requireCapability } from "@/utils/permissions";
import { revalidateEntity } from "@/utils/revalidate";

import { canCreateEvent, canUpdateEvent, canDeleteEvent } from "./permissions";
import { EventCreateSchema, EventUpdateSchema, EventIdSchema } from "./schemas";
import type { CalendarEvent } from "./types";

/** Доменные коды событий → русский текст. Бек пишет code в UPPER_SNAKE_CASE
 * (internal/apperror, middleware/auth.go). REF_NOT_FOUND и BLOCKS_HAVE_ANCHORS —
 * из DEFAULT_MESSAGES api-error.ts (текст совпадал). */
const ERRORS: ApiErrorMessages = {
  INVALID_DATE:
    "Бекенд отклонил дату: проверьте формат и порядок дат начала/окончания.",
  INVALID_RRULE: "Бекенд отклонил правило повторения (RRULE).",
  BLOCKS_INVALID: "Описание события не прошло валидацию AST.",
  BLOCK_REFERENCED:
    "На блок события ссылаются другие материалы. Удалите ссылки или оставьте блок.",
};

export const createEvent = createFormAction(async (formData, ctx) => {
  const me = await getMe();
  requireCapability(me, canCreateEvent);
  const input = parseFormData(EventCreateSchema, formData);
  const api = await createApiClient();
  const { data, error } = await api.POST("/api/admin/events", {
    body: {
      title: input.title,
      start_date: input.start_date,
      all_day: input.all_day,
      ...(input.end_date ? { end_date: input.end_date } : {}),
      ...(input.rrule ? { rrule: input.rrule } : {}),
    },
    headers: idempotencyHeaders(ctx.idempotencyKey),
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.EVENTS);
  return (data.data ?? null) as CalendarEvent | null;
});

/**
 * PUT /api/admin/events/{id}. Content-edit PUT требует `If-Match: "<version>"`
 * (optimistic lock, см. docs/conventions/optimistic-locking.md). Версия берётся
 * из `event.version` (тело single-GET) через hidden-поле формы. Отсутствие →
 * 428, расхождение → 412.
 */
export const updateEvent = createFormAction(async (formData, ctx) => {
  const me = await getMe();
  requireCapability(me, canUpdateEvent);
  const input = parseFormData(EventUpdateSchema, formData);
  const api = await createApiClient();
  const { data, error } = await api.PUT("/api/admin/events/{id}", {
    params: {
      path: { id: input.id },
      header: ifMatchHeader(formData, "события"),
    },
    body: {
      title: input.title,
      start_date: input.start_date,
      all_day: input.all_day,
      blocks: input.blocks as never,
      // Известное ограничение бекенда: omitted-поле НЕ очищает значение
      // (UpdateRequest — частичный апдейт), а пустая строка не проходит
      // validateDates/validateRRule. Очистка end_date/rrule невозможна —
      // см. секцию рисков плана.
      ...(input.end_date ? { end_date: input.end_date } : {}),
      ...(input.rrule ? { rrule: input.rrule } : {}),
    },
    headers: idempotencyHeaders(ctx.idempotencyKey),
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.EVENTS, input.id);
  revalidateEntity(Tags.EVENTS);
  return (data.data ?? null) as CalendarEvent | null;
});

export const deleteEvent = createAction(async (rawId: string, ctx) => {
  const me = await getMe();
  requireCapability(me, canDeleteEvent);
  const { id } = EventIdSchema.parse({ id: rawId });
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/admin/events/{id}", {
    params: { path: { id } },
    headers: idempotencyHeaders(ctx.idempotencyKey),
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.EVENTS);
  return undefined;
});
