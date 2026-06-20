// src/features/search/hit-href.ts
// Внутренний маршрут для хита семантического поиска. Без "server-only": нужен тестам.
import type { SearchHit } from "./types";

/**
 * Внутренний роут для хита: document → /documents/{id}, glossary → /glossary/{id}.
 * Возвращает null, если нет entity_id или тип неизвестен — такой хит
 * пропускается в рендере (нечего открыть).
 *
 * Бек также отдаёт `source_url`, но для внутренней SPA-навигации (RouterLink)
 * строим относительный путь из entity_id + type.
 */
export function hitHref(hit: SearchHit): string | null {
  if (!hit.entity_id) return null;
  if (hit.type === "document") return `/documents/${hit.entity_id}`;
  if (hit.type === "glossary") return `/glossary/${hit.entity_id}`;
  return null;
}
