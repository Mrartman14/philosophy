// src/features/lectures/cover-url.ts
// URL обложки лекции. Без "server-only": нужен тестам и client-карточке.
import { resolveStorageUrl } from "@/utils/storage-url";

/**
 * URL обложки лекции из `cover_image_key` (SHA256-hex content-address). `null`,
 * если ключа нет. Построение URL делегировано общему `resolveStorageUrl`.
 */
export function lectureCoverUrl(
  coverImageKey: string | undefined | null,
): string | null {
  if (!coverImageKey) return null;
  return resolveStorageUrl(coverImageKey);
}
