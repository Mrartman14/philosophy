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
 * Шаблон `range` (`{from}–{to} из {total}`) намеренно оставлен как литерал с
 * плейсхолдерами: `Pagination` подставляет числа сам (синхронно, без ICU-эвала
 * на каждый ререндер). Достаточно `t("common.pagination.range")` без params.
 */
export async function getPaginationLabels(): Promise<PaginationLabels> {
  const t = await getT("common");
  return {
    ariaLabel: t("pagination.ariaLabel"),
    prev: t("pagination.prev"),
    next: t("pagination.next"),
    range: t("pagination.range"),
    rangeEmpty: t("pagination.rangeEmpty"),
  };
}
