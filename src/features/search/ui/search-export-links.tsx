// src/features/search/ui/search-export-links.tsx
import { searchExportMdUrl } from "../export-urls";
import type { SearchType } from "../types";

// Тот же env и fallback, что в src/api/client.ts. Серверный компонент:
// process.env читается при SSR — рендерить ТОЛЬКО из server components.
const API_URL = process.env.API_URL ?? "http://localhost:8080";

interface Props {
  q: string;
  type?: SearchType | undefined;
  className?: string;
}

/**
 * Ссылка на публичную .md-выгрузку текущего запроса. Контент рендерит бек;
 * эндпоинт публичный (только optionalAuth + rate-limit) — прямая ссылка.
 */
export function SearchExportLinks({ q, type, className }: Props) {
  const href = searchExportMdUrl(API_URL, type ? { q, type } : { q });
  return (
    <p
      className={
        className ?? "flex items-center gap-2 text-xs text-(--color-description)"
      }
    >
      Экспорт:
      <a href={href} className="hover:underline" target="_blank" rel="noopener">
        .md
      </a>
    </p>
  );
}
