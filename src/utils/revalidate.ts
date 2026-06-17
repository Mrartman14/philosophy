// src/utils/revalidate.ts
import "server-only";
import { revalidateTag } from "next/cache";

import { metrics } from "@/services/observability/core/facade";
import { M } from "@/services/observability/core/names";

/**
 * Сбрасывает Next.js cache по конвенции тегов: `<entity>` для списков и
 * `<entity>:<id>` для конкретного item'а. Используется в server actions после
 * мутаций.
 *
 * Соответствующие fetchers в `features/<X>/api.ts` должны ставить эти теги в
 * `unstable_cache(..., { tags: ["<entity>"] })` или `["<entity>:<id>"]`.
 */
export function revalidateEntity(entity: string, id?: string): void {
  // Объём успешных мутаций по сущности (commit засчитывается ровно один раз).
  metrics.increment(M.mutationCommit, { entity });
  // Next 16: revalidateTag требует profile (string | CacheLifeConfig).
  // "default" — стандартный cacheLife profile для немедленной инвалидации.
  revalidateTag(entity, "default");
  if (id) revalidateTag(`${entity}:${id}`, "default");
}
