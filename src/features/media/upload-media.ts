// src/features/media/upload-media.ts
"use server";
import "server-only";
import { cookies } from "next/headers";

import { API_URL } from "@/api/client";
import { Tags } from "@/api/tags";
import { instrumentedFetch } from "@/services/observability/server-fetch";
import {
  rethrowApiError,
  type ApiError,
  type ApiErrorMessageKeys,
} from "@/utils/api-error";
import { createFormAction } from "@/utils/create-action";
import { getMe } from "@/utils/me";
import { ForbiddenError, requireCapability } from "@/utils/permissions";
import { revalidateEntity } from "@/utils/revalidate";

import { canCreateMedia } from "./permissions";
import type { Media } from "./types";

/** Доменные коды media-upload → ключ каталога errors (Case 2 i18n).
 * role-403/SUSPENDED/BANNED и 413 (PAYLOAD_TOO_LARGE / REQUEST_BODY_TOO_LARGE
 * из DEFAULT_MESSAGES) обрабатывает централизованный `rethrowApiError`. Невалидный
 * формат/MIME/тип (UNSUPPORTED_MEDIA_TYPE / INVALID_FILE_TYPE) на беке несёт
 * локализованный `error`-текст — он и всплывёт через фоллбек rethrowApiError. */
const ERRORS: ApiErrorMessageKeys = {
  PUBLIC_IMMUTABLE: "MEDIA_PUBLIC_IMMUTABLE",
  NOT_FOUND: "MEDIA_NOT_FOUND",
};

/**
 * POST /api/media — multipart-upload (поля type + file). Бек создаёт медиа
 * free-floating и private. Идёт через raw fetch (а не openapi-fetch), потому
 * что openapi-fetch не сериализует File в multipart надёжно — тот же паттерн,
 * что src/features/documents/actions.ts:uploadDocument.
 *
 * Ожидает FormData с полями:
 *   - file: File (видео .mp4/.webm или аудио .mp3/.m4a/.ogg)
 *   - type: "video" | "audio"
 *
 * Канон error-handling/useActionState: createFormAction + rethrowApiError(ERRORS),
 * UI — useActionState + <Form action> + FormFeedback (как documents).
 */
export const uploadMedia = createFormAction(async (formData) => {
  // Ранний RBAC-отказ (defense-in-depth; бек тоже гейтит media.create).
  const me = await getMe();
  requireCapability(me, canCreateMedia);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Выберите файл для загрузки.");
  }
  const type = formData.get("type");
  if (type !== "video" && type !== "audio") {
    throw new Error("Выберите тип: видео или аудио.");
  }

  const token = (await cookies()).get("token")?.value;
  // Пересобираем FormData: только разрешённые бекендом поля.
  const upstream = new FormData();
  upstream.set("file", file);
  upstream.set("type", type);

  let res: Response;
  try {
    res = await instrumentedFetch(
      `${API_URL}/api/media`,
      {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: upstream,
      },
      { surface: "media.upload" },
    );
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "Сетевая ошибка при загрузке");
  }

  if (res.status === 401 || res.status === 403) {
    throw new ForbiddenError("role");
  }
  if (res.status !== 201 && res.status !== 200) {
    let body: ApiError = {};
    try {
      body = (await res.json()) as ApiError;
    } catch {
      /* пустое/не-JSON тело — фоллбек на статус */
    }
    rethrowApiError(
      body.code ? body : { error: `Ошибка загрузки: ${res.status}` },
      ERRORS,
    );
  }

  // media-эндпоинты конвертные ({ data }) — api.ts читает их через unwrap();
  // распаковываем так же, как канон documents/uploadDocument.
  const json = (await res.json()) as { data?: Media };
  const media = json.data ?? null;
  revalidateEntity(Tags.MEDIA);
  return media;
}, "uploadMedia");
