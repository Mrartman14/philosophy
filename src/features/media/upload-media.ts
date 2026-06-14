// src/features/media/upload-media.ts
"use server";
import "server-only";
import { cookies } from "next/headers";
import { getMe } from "@/utils/me";
import { revalidateEntity } from "@/utils/revalidate";
import { API_URL } from "@/api/client";
import { Tags } from "@/api/tags";
import { canCreateMedia } from "./permissions";
import type { Media } from "./types";
import type { ApiError } from "@/utils/api-error";

export type UploadMediaResult =
  | { success: true; data: Media }
  | {
      success: false;
      error: string;
      code: "forbidden" | "file_too_large" | "invalid_file";
    }
  | { success: false; error: string; code?: undefined };

/**
 * POST /api/media — multipart-upload (поля type + file). Бек создаёт медиа
 * free-floating и private. Идёт через raw fetch (а не openapi-fetch), потому
 * что openapi-fetch не сериализует File в multipart надёжно — тот же паттерн,
 * что src/components/ast-editor/upload/upload-image.ts.
 *
 * Ожидает FormData с полями:
 *   - file: File (видео .mp4/.webm или аудио .mp3/.m4a/.ogg)
 *   - type: "video" | "audio"
 */
export async function uploadMedia(
  formData: FormData,
): Promise<UploadMediaResult> {
  // Ранний RBAC-отказ (defense-in-depth; бек тоже гейтит media.create).
  const me = await getMe();
  if (!canCreateMedia(me)) {
    return {
      success: false,
      error: "У вас нет прав на загрузку медиа.",
      code: "forbidden",
    };
  }

  const file = formData.get("file");
  const type = formData.get("type");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Выберите файл." };
  }
  if (type !== "video" && type !== "audio") {
    return { success: false, error: "Выберите тип: видео или аудио." };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/media`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Сетевая ошибка",
    };
  }

  if (res.status === 201) {
    const body = (await res.json()) as { data?: Media } | Media;
    const media =
      typeof body === "object" && body !== null && "data" in body
        ? (body as { data: Media }).data
        : (body as Media);
    revalidateEntity(Tags.MEDIA);
    return { success: true, data: media };
  }

  let body: ApiError = {};
  try {
    body = (await res.json()) as ApiError;
  } catch {
    /* пустое/не-JSON тело — фоллбек на статус */
  }

  if (res.status === 401 || res.status === 403) {
    return {
      success: false,
      error: body.error ?? "Нет доступа.",
      code: "forbidden",
    };
  }
  if (res.status === 413) {
    return {
      success: false,
      error: body.error ?? "Файл слишком большой (макс 100 MB).",
      code: "file_too_large",
    };
  }
  // 400/422 — невалидное расширение/MIME/тип (validate.go).
  if (res.status === 400 || res.status === 422) {
    return {
      success: false,
      error:
        body.error ??
        "Неподдерживаемый формат. Видео: mp4/webm. Аудио: mp3/m4a/ogg.",
      code: "invalid_file",
    };
  }
  return {
    success: false,
    error: body.error ?? `Ошибка загрузки: ${res.status}`,
  };
}
