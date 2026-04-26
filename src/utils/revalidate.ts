// src/utils/revalidate.ts
import "server-only";
import { revalidateTag } from "next/cache";

/**
 * Сбрасывает Next.js cache по конвенции тегов: `<entity>` для списков и
 * `<entity>:<id>` для конкретного item'а. Используется в server actions после
 * мутаций.
 *
 * Соответствующие fetchers в `features/<X>/api.ts` должны ставить эти теги в
 * `unstable_cache(..., { tags: ["<entity>"] })` или `["<entity>:<id>"]`.
 */
export function revalidateEntity(entity: string, id?: string): void {
  revalidateTag(entity);
  if (id) revalidateTag(`${entity}:${id}`);
}
