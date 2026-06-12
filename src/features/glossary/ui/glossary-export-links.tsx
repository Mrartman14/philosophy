// src/features/glossary/ui/glossary-export-links.tsx
import { glossaryExportUrls } from "../export-urls";

// Тот же env и fallback, что в src/api/client.ts. Серверный компонент:
// process.env читается при SSR — рендерить ТОЛЬКО из server components
// (в client-дереве env недоступен).
const API_URL = process.env.API_URL ?? "http://localhost:8080";

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
        className ?? "flex items-center gap-2 text-xs text-(--color-description)"
      }
    >
      Экспорт:
      <a href={urls.md} className="hover:underline" target="_blank" rel="noopener">
        .md
      </a>
      <a href={urls.txt} className="hover:underline" target="_blank" rel="noopener">
        .txt
      </a>
    </p>
  );
}
