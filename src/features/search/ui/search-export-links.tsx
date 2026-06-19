// src/features/search/ui/search-export-links.tsx
import { API_URL } from "@/api/client";
import { getT } from "@/i18n";

import { searchExportMdUrl } from "../export-urls";
import type { SearchType } from "../types";

// API_URL — единый источник (src/api/client.ts). Серверный компонент:
// process.env читается при SSR — рендерить ТОЛЬКО из server components.

interface Props {
  q: string;
  type?: SearchType | undefined;
  className?: string;
}

/**
 * Ссылка на публичную .md-выгрузку текущего запроса. Контент рендерит бек;
 * эндпоинт публичный (только optionalAuth + rate-limit) — прямая ссылка.
 */
export async function SearchExportLinks({ q, type, className }: Props) {
  const t = await getT("search");
  const href = searchExportMdUrl(API_URL, type ? { q, type } : { q });
  return (
    <p
      className={
        className ?? "flex items-center gap-2 text-xs text-(--color-fg-muted)"
      }
    >
      {t("exportLabel")}
      <a href={href} className="hover:underline" target="_blank" rel="noopener noreferrer">
        .md
      </a>
    </p>
  );
}
