// src/features/share-links/share-url.ts
// БЕЗ "server-only": используется в client-компоненте share-button.
import type { ResourceType } from "./types";

/**
 * Сегмент detail-страницы для каждого типа ресурса. Ключи — пути app-роутера.
 * canvas включён: страница /canvases/{id} существует с фазы 1 canvas.
 */
const RESOURCE_PATH_SEGMENT: Record<ResourceType, string> = {
  lecture: "lectures",
  document: "documents",
  trail: "trails",
  media: "media",
  form: "forms",
  canvas: "canvases",
};

/**
 * Абсолютный URL detail-страницы ресурса с ?token=. База — из
 * NEXT_PUBLIC_BASE_URL (он уже содержит base-path в prod, напр.
 * https://mrartman14.github.io/philosophy — поэтому NEXT_PUBLIC_BASE_PATH
 * повторно НЕ добавляем). Завершающий слеш базы нормализуется.
 */
export function buildShareUrl(
  resourceType: ResourceType,
  resourceId: string,
  token: string,
): string {
  const segment = RESOURCE_PATH_SEGMENT[resourceType];
  const rawBase = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const base = rawBase.replace(/\/+$/, "");
  const path = `/${segment}/${encodeURIComponent(resourceId)}`;
  const query = `?token=${encodeURIComponent(token)}`;
  return `${base}${path}${query}`;
}
