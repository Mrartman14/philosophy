// src/features/lectures/cover-url.ts
// Чистый helper URL обложки лекции. Без "server-only": нужен тестам и
// client-карточке. cover_image_key — SHA256-hex content-address (как
// resolveStorageUrl в ast-editor); раскрываем здесь, чтобы не тянуть
// deep-import ast-editor в слайс лекций.

/**
 * URL обложки лекции из cover_image_key (storage-key). null, если ключа нет.
 * База — NEXT_PUBLIC_STORAGE_URL, фолбэк — NEXT_PUBLIC_API_URL (как
 * src/components/ast-editor/upload/storage-url.ts). Пустая строка в env
 * трактуется как «не задано» → фолбэк.
 */
export function lectureCoverUrl(coverImageKey: string | undefined | null): string | null {
  if (!coverImageKey) return null;
  const base =
    (process.env.NEXT_PUBLIC_STORAGE_URL || process.env.NEXT_PUBLIC_API_URL) ?? "";
  return `${base}/static/files/${coverImageKey}`;
}
