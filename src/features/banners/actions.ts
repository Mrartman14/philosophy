// src/features/banners/actions.ts
"use server";
import "server-only";
import { createApiClient } from "@/api/client";
import {
  createAction,
  createFormAction,
  parseFormData,
} from "@/utils/create-action";
import { getMe } from "@/utils/me";
import { requireCapability } from "@/utils/permissions";
import { handleCommonApiError, type ApiError } from "@/utils/api-error";
import { revalidateEntity } from "@/utils/revalidate";
import { Tags } from "@/api/tags";
import {
  canCreateBanner,
  canUpdateBanner,
  canDeleteBanner,
  canDismissBanner,
} from "./permissions";
import {
  BannerCreateSchema,
  BannerUpdateSchema,
  BannerIdSchema,
} from "./schemas";
import type { Banner } from "./types";

function rethrowApiError(err: ApiError | undefined): never {
  // Бек пишет code в UPPER_SNAKE_CASE (internal/apperror, middleware/auth.go).
  switch (err?.code) {
    case "INVALID_COLOR":
      throw new Error("Бекенд отклонил цвет фона: нужен hex вида #RGB или #RRGGBB.");
    case "INVALID_DATE":
      throw new Error(
        "Бекенд отклонил даты показа: проверьте формат и порядок начала/окончания.",
      );
    case "INVALID_EVENT":
      throw new Error("Событие с таким id не найдено.");
    case "BLOCKS_INVALID":
      throw new Error("Текст баннера не прошёл валидацию AST.");
    case "REF_NOT_FOUND":
      throw new Error("Одна из ссылок указывает на несуществующий объект.");
    case "BLOCK_REFERENCED":
      throw new Error(
        "На блок баннера ссылаются другие материалы. Удалите ссылки или оставьте блок.",
      );
    case "BLOCKS_HAVE_ANCHORS":
      throw new Error(
        "Нельзя удалить блок с привязанными комментариями. Удалите комментарии или оставьте блок.",
      );
  }
  handleCommonApiError(err);
}

export const createBanner = createFormAction(async (formData) => {
  const me = await getMe();
  requireCapability(me, canCreateBanner);
  const input = parseFormData(BannerCreateSchema, formData);
  const api = await createApiClient();
  const { data, error } = await api.POST("/api/admin/banners", {
    body: {
      background_color: input.background_color,
      target_audience: input.target_audience,
      dismissible: input.dismissible,
      start_at: input.start_at,
      ...(input.end_at ? { end_at: input.end_at } : {}),
      ...(input.event_id ? { event_id: input.event_id } : {}),
    },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.BANNERS);
  return (data?.data ?? null) as Banner | null;
});

export const updateBanner = createFormAction(async (formData) => {
  const me = await getMe();
  requireCapability(me, canUpdateBanner);
  const input = parseFormData(BannerUpdateSchema, formData);
  const api = await createApiClient();
  const { data, error } = await api.PUT("/api/admin/banners/{id}", {
    params: { path: { id: input.id } },
    body: {
      background_color: input.background_color,
      target_audience: input.target_audience,
      dismissible: input.dismissible,
      start_at: input.start_at,
      blocks: input.blocks as never,
      // event_id отправляем ВСЕГДА: пустая строка = «отвязать событие»
      // (repo.Update бекенда: "" → SQL NULL).
      event_id: input.event_id,
      // Известное ограничение бекенда: omitted-поле НЕ очищает значение
      // (UpdateRequest — частичный апдейт), а пустая строка end_at не пройдёт
      // RFC3339-парсинг. Очистка end_at невозможна — см. секцию рисков плана.
      ...(input.end_at ? { end_at: input.end_at } : {}),
    },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.BANNERS, input.id);
  revalidateEntity(Tags.BANNERS);
  return (data?.data ?? null) as Banner | null;
});

export const deleteBanner = createAction(async (rawId: string) => {
  const me = await getMe();
  requireCapability(me, canDeleteBanner);
  const { id } = BannerIdSchema.parse({ id: rawId });
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/admin/banners/{id}", {
    params: { path: { id } },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.BANNERS);
  return undefined;
});

export const dismissBanner = createAction(async (rawId: string) => {
  const me = await getMe();
  requireCapability(me, canDismissBanner);
  const { id } = BannerIdSchema.parse({ id: rawId });
  const api = await createApiClient();
  const { error } = await api.POST("/api/banners/{id}/dismiss", {
    params: { path: { id } },
  });
  if (error) {
    const err = error as ApiError;
    // dismissible=false → 409 CONFLICT («banner is not dismissible»).
    if (err?.code === "CONFLICT") {
      throw new Error("Этот баннер нельзя скрыть.");
    }
    rethrowApiError(err);
  }
  revalidateEntity(Tags.BANNERS);
  return undefined;
});
