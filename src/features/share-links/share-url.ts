// src/features/share-links/share-url.ts
// БЕЗ "server-only": используется в client-компоненте share-button.
import type { ResourceType } from "./types";

/**
 * Сегмент detail-страницы для каждого типа ресурса. canvas сюда не входит:
 * canvas-страниц на фронте нет (фича вне скоупа). Ключи — пути app-роутера.
 */
const RESOURCE_PATH_SEGMENT: Record<Exclude<ResourceType, "canvas">, string> = {
  lecture: "lectures",
  document: "documents",
  trail: "trails",
  media: "media",
  form: "forms",
};

/**
 * Абсолютный URL detail-страницы ресурса с ?token=. База — из
 * NEXT_PUBLIC_BASE_URL (он уже содержит base-path в prod, напр.
 * https://mrartman14.github.io/philosophy — поэтому NEXT_PUBLIC_BASE_PATH
 * повторно НЕ добавляем). Завершающий слеш базы нормализуется.
 *
 * Бросает на canvas — для него detail-страницы и share-URL не существует.
 */
export function buildShareUrl(
  resourceType: ResourceType,
  resourceId: string,
  token: string,
): string {
  if (resourceType === "canvas") {
    throw new Error("buildShareUrl: canvas не поддерживается фронтендом");
  }
  const segment = RESOURCE_PATH_SEGMENT[resourceType];
  const rawBase = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const base = rawBase.replace(/\/+$/, "");
  const path = `/${segment}/${encodeURIComponent(resourceId)}`;
  const query = `?token=${encodeURIComponent(token)}`;
  return `${base}${path}${query}`;
}
