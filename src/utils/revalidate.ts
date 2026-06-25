// src/utils/revalidate.ts
import "server-only";
import { updateTag } from "next/cache";

import { metrics, M } from "@/services/observability";

/**
 * Сбрасывает Next.js cache по конвенции тегов: `<entity>` для списков и
 * `<entity>:<id>` для конкретного item'а. Вызывается ТОЛЬКО из server actions
 * после мутаций.
 *
 * Соответствующие fetchers в `features/<X>/api.ts` должны ставить эти теги в
 * `unstable_cache(..., { tags: ["<entity>"] })` или `["<entity>:<id>"]`.
 *
 * Используем `updateTag`, а НЕ `revalidateTag(tag, profile)`. В Next 16
 * `revalidateTag` с профилем (включая "default") даёт stale-while-revalidate и
 * НЕ помечает текущий маршрут как ревалидированный — server action не подтянет
 * свежий RSC в том же ответе, и автор мутации не увидит свою запись до полной
 * перезагрузки (см. revalidate.js: pathWasRevalidated ставится лишь при
 * `!profile` или `cacheLife.expire === 0`). `updateTag` — read-your-writes API
 * Next 16 для server actions: немедленно инвалидирует тег И помечает маршрут на
 * рефреш. Бросает вне server action (route handler / render) — поэтому утилита
 * предназначена только для actions.
 */
export function revalidateEntity(entity: string, id?: string): void {
  // Объём успешных мутаций по сущности (commit засчитывается ровно один раз).
  metrics.increment(M.mutationCommit, { entity });
  updateTag(entity);
  if (id) updateTag(`${entity}:${id}`);
}
