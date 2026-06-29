// src/components/ui/pagination.server.ts
import "server-only";

import { getT } from "@/i18n";

import type { PaginationLabels } from "./pagination";

/**
 * Резолвит локализованные подписи `Pagination` на СЕРВЕРЕ. `Pagination` —
 * server-used компонент (списки/таблицы), поэтому он не может тянуть `useT` сам
 * (это сломало бы server/client-границу). Каждый server-page вызывает этот
 * хелпер и пробрасывает результат пропом `labels`.
 *
 * Шаблон `range` (`{from}–{to} из {total}`) хранит ICU-плейсхолдеры, которые
 * `Pagination` подставляет сам (синхронно, без ICU-эвала на каждый ререндер).
 * Поэтому его берём через `t.raw(...)`, а не `t(...)`: обычный `t(...)` попытался
 * бы отформатировать ICU-сообщение, и без значений `from/to/total` next-intl
 * бросил бы FORMATTING_ERROR, вернув ключ-фоллбек `common.pagination.range`
 * (именно это раньше и протекало в UI). `t.raw` возвращает строку как есть.
 */
export async function getPaginationLabels(): Promise<PaginationLabels> {
  const t = await getT("common");
  return {
    ariaLabel: t("pagination.ariaLabel"),
    prev: t("pagination.prev"),
    next: t("pagination.next"),
    range: String(t.raw("pagination.range")),
    rangeEmpty: t("pagination.rangeEmpty"),
  };
}
