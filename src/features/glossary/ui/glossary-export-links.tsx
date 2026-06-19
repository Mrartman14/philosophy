// src/features/glossary/ui/glossary-export-links.tsx
import { API_URL } from "@/api/client";

import { glossaryExportUrls } from "../export-urls";

// API_URL — единый источник (src/api/client.ts). Серверный компонент:
// process.env читается при SSR — рендерить ТОЛЬКО из server components
// (в client-дереве env недоступен).

interface Props {
  /** id термина — ссылки на выгрузки термина; без него — выгрузки списка. */
  termId?: string;
  className?: string;
}

/**
 * Ссылки на публичные .md/.txt-выгрузки глоссария. Контент рендерит бек;
 * эндпоинты публичные (только rate-limit) — прокси не нужен, прямые ссылки.
 */
export function GlossaryExportLinks({ termId, className }: Props) {
  const urls = glossaryExportUrls(API_URL, termId);
  return (
    <p
      className={
        className ?? "flex items-center gap-2 text-xs text-(--color-fg-muted)"
      }
    >
      Экспорт:
      <a href={urls.md} className="hover:underline" target="_blank" rel="noopener noreferrer">
        .md
      </a>
      <a href={urls.txt} className="hover:underline" target="_blank" rel="noopener noreferrer">
        .txt
      </a>
    </p>
  );
}
