// src/features/lectures/export-urls.ts
// Ссылки на прокси-выгрузки лекции. Без "server-only": нужен тестам.
import { proxyExportUrls, type ExportUrls } from "@/utils/export-urls";

export type LectureExportUrls = ExportUrls;

/**
 * Ссылки на `.md/.txt` лекции ведут на ЛОКАЛЬНЫЙ прокси-роут
 * `/lectures/{id}/export` (подкладывает Bearer из httpOnly-cookie — приватная
 * лекция владельца без токена получила бы 401 при браузерной навигации).
 * См. `@/utils/export-urls` / `@/utils/export-proxy`.
 */
export function lectureExportUrls(id: string): LectureExportUrls {
  return proxyExportUrls("lectures", id);
}
