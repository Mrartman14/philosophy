// src/features/documents/export-urls.ts
// Ссылки на прокси-выгрузки документа. Без "server-only": нужен тестам.
import { proxyExportUrls, type ExportUrls } from "@/utils/export-urls";

export type DocumentExportUrls = ExportUrls;

/**
 * Ссылки на `.md/.txt` документа ведут на ЛОКАЛЬНЫЙ прокси-роут
 * `/documents/{id}/export` (подкладывает Bearer из httpOnly-cookie —
 * приватный документ владельца без токена получил бы 401 при браузерной
 * навигации). См. `@/utils/export-urls` / `@/utils/export-proxy`.
 */
export function documentExportUrls(id: string): DocumentExportUrls {
  return proxyExportUrls("documents", id);
}
