// src/features/events/actions.ts
"use server";
import "server-only";
import { createApiClient } from "@/api/client";
import {
  createAction,
  createFormAction,
  parseFormData,
} from "@/utils/create-action";
import { getMe } from "@/utils/me";
import { ForbiddenError, requireCapability } from "@/utils/permissions";
import { revalidateEntity } from "@/utils/revalidate";
import { Tags } from "@/api/tags";
import {
  canCreateEvent,
  canUpdateEvent,
  canDeleteEvent,
} from "./permissions";
import {
  EventCreateSchema,
  EventUpdateSchema,
  EventIdSchema,
} from "./schemas";
import type { CalendarEvent } from "./types";

type ApiError = { code?: string; error?: string };

function rethrowApiError(err: ApiError | undefined): never {
  // Бек пишет code в UPPER_SNAKE_CASE (internal/apperror, middleware/auth.go).
  switch (err?.code) {
    case "FORBIDDEN":
      throw new ForbiddenError("role", err.error);
    case "INVALID_DATE":
      throw new Error(
        "Бекенд отклонил дату: проверьте формат и порядок дат начала/окончания.",
      );
    case "INVALID_RRULE":
      throw new Error("Бекенд отклонил правило повторения (RRULE).");
    case "BLOCKS_INVALID":
      throw new Error("Описание события не прошло валидацию AST.");
    case "REF_NOT_FOUND":
      throw new Error("Одна из ссылок указывает на несуществующий объект.");
    case "BLOCK_REFERENCED":
      throw new Error(
        "На блок события ссылаются другие материалы. Удалите ссылки или оставьте блок.",
      );
    case "BLOCKS_HAVE_ANCHORS":
      throw new Error(
        "Нельзя удалить блок с привязанными комментариями. Удалите комментарии или оставьте блок.",
      );
  }
  throw new Error(err?.error ?? "Ошибка сервера");
}

export const createEvent = createFormAction(async (formData) => {
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
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.EVENTS);
  return (data?.data ?? null) as CalendarEvent | null;
});

export const updateEvent = createFormAction(async (formData) => {
  const me = await getMe();
  requireCapability(me, canUpdateEvent);
  const input = parseFormData(EventUpdateSchema, formData);
  const api = await createApiClient();
  const { data, error } = await api.PUT("/api/admin/events/{id}", {
    params: { path: { id: input.id } },
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
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.EVENTS, input.id);
  revalidateEntity(Tags.EVENTS);
  return (data?.data ?? null) as CalendarEvent | null;
});

export const deleteEvent = createAction(async (rawId: string) => {
  const me = await getMe();
  requireCapability(me, canDeleteEvent);
  const { id } = EventIdSchema.parse({ id: rawId });
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/admin/events/{id}", {
    params: { path: { id } },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.EVENTS);
  return undefined;
});
