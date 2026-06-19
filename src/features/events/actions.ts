// src/features/events/actions.ts
"use server";
import "server-only";
import { createApiClient } from "@/api/client";
import { Tags } from "@/api/tags";
import { getT } from "@/i18n";
import { rethrowApiError, type ApiErrorMessageKeys } from "@/utils/api-error";
import { unwrap } from "@/utils/api-unwrap";
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
import {
  makeEventCreateSchema,
  makeEventUpdateSchema,
  makeEventIdSchema,
} from "./schemas";


/** Доменные коды событий → ключи каталога errors. Бек пишет code в UPPER_SNAKE_CASE
 * (internal/apperror, middleware/auth.go). REF_NOT_FOUND и BLOCKS_HAVE_ANCHORS —
 * из DEFAULT_MESSAGES api-error.ts. */
const ERRORS: ApiErrorMessageKeys = {
  INVALID_DATE: "INVALID_DATE",
  INVALID_RRULE: "INVALID_RRULE",
  BLOCKS_INVALID: "EVENT_BLOCKS_INVALID",
  BLOCK_REFERENCED: "EVENT_BLOCK_REFERENCED",
};

export const createEvent = createFormAction(async (formData, ctx) => {
  const me = await getMe();
  requireCapability(me, canCreateEvent);
  const t = await getT("validation");
  const input = parseFormData(makeEventCreateSchema(t), formData);
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
  return unwrap(data);
}, "createEvent");

/**
 * PUT /api/admin/events/{id}. Content-edit PUT требует `If-Match: "<version>"`
 * (optimistic lock, см. docs/conventions/optimistic-locking.md). Версия берётся
 * из `event.version` (тело single-GET) через hidden-поле формы. Отсутствие →
 * 428, расхождение → 412.
 */
export const updateEvent = createFormAction(async (formData, ctx) => {
  const me = await getMe();
  requireCapability(me, canUpdateEvent);
  const t = await getT("validation");
  const input = parseFormData(makeEventUpdateSchema(t), formData);
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
      blocks: input.blocks,
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
  return unwrap(data);
}, "updateEvent");

export const deleteEvent = createAction(async (rawId: string, ctx) => {
  const me = await getMe();
  requireCapability(me, canDeleteEvent);
  const t = await getT("validation");
  const { id } = makeEventIdSchema(t).parse({ id: rawId });
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/admin/events/{id}", {
    params: { path: { id } },
    headers: idempotencyHeaders(ctx.idempotencyKey),
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.EVENTS);
  return undefined;
}, "deleteEvent");
