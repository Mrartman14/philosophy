// src/features/media/actions.ts
"use server";
import "server-only";
import { createApiClient } from "@/api/client";
import { Tags } from "@/api/tags";
import { handleCommonApiError, type ApiError } from "@/utils/api-error";
import { createAction } from "@/utils/create-action";
import { getMe } from "@/utils/me";
import { ForbiddenError, requireCapability } from "@/utils/permissions";
import { revalidateEntity } from "@/utils/revalidate";

import { canDeleteMedia, canChangeMediaVisibility } from "./permissions";
import { MediaIdSchema, MediaVisibilitySchema } from "./schemas";
import type { Media } from "./types";

/** Маппинг UPPER_SNAKE_CASE-кодов бекенда на доменные ошибки фронта. */
function rethrowApiError(err: ApiError | undefined): never {
  switch (err?.code) {
    // SUSPENDED оставлен локально: без дефолтного текста "Аккаунт ограничен."
    // — поведение 1:1 (handleCommonApiError подставил бы фоллбек).
    case "SUSPENDED":
      throw new ForbiddenError("status", err.error);
    case "PUBLIC_IMMUTABLE":
      throw new Error(
        "Публичное медиа нельзя сделать приватным. Удалите и загрузите заново.",
      );
    case "NOT_FOUND":
      throw new Error("Медиа не найдено.");
  }
  handleCommonApiError(err);
}

/** Загружает media-запись для owner-aware RBAC. 404 → ForbiddenError (secure). */
async function loadMediaForGate(id: string): Promise<Media> {
  const api = await createApiClient();
  const { data, error, response } = await api.GET("/api/media/{media_id}", {
    params: { path: { media_id: id } },
  });
  if (response.status === 404) {
    // Не видно ≡ не существует. Для гейта это отказ.
    throw new ForbiddenError("owner", "Медиа не найдено");
  }
  if (error) rethrowApiError(error);
  return (data.data ?? null) as Media;
}

/**
 * DELETE /api/media/{id}. Owner ИЛИ media.delete_any (независимо от
 * видимости, §6.2). Используется и владельцем со страницы /media/[id], и
 * админом (admin-списка нет — §10.3).
 */
export const deleteMedia = createAction(async (rawId: string) => {
  const me = await getMe();
  const { id } = MediaIdSchema.parse({ id: rawId });
  const media = await loadMediaForGate(id);
  requireCapability(me, (m) => canDeleteMedia(m, media));
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/media/{media_id}", {
    params: { path: { media_id: id } },
  });
  if (error) rethrowApiError(error as ApiError);
  revalidateEntity(Tags.MEDIA, id);
  revalidateEntity(Tags.MEDIA);
  return undefined;
});

/**
 * PATCH /api/media/{id}/visibility. Только владелец, только private→public.
 * Вход — { id, visibility } (visibility всегда "public" из UI).
 */
export const setMediaVisibility = createAction(
  async (raw: { id: string; visibility: string }) => {
    const me = await getMe();
    const input = MediaVisibilitySchema.parse(raw);
    const media = await loadMediaForGate(input.id);
    requireCapability(me, (m) => canChangeMediaVisibility(m, media));
    const api = await createApiClient();
    const { error } = await api.PATCH("/api/media/{media_id}/visibility", {
      params: { path: { media_id: input.id } },
      body: { visibility: input.visibility },
    });
    if (error) rethrowApiError(error as ApiError);
    revalidateEntity(Tags.MEDIA, input.id);
    revalidateEntity(Tags.MEDIA);
    return undefined;
  },
);
