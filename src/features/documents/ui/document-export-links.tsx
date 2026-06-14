// src/features/documents/ui/document-export-links.tsx
import { documentExportUrls } from "../export-urls";

interface Props {
  id: string;
  className?: string;
}

/**
 * Ссылки на .md/.txt выгрузки документа. Ведут на локальный прокси-роут
 * /documents/[id]/export (см. export-urls.ts) — он подкладывает токен из cookie.
 */
export function DocumentExportLinks({ id, className }: Props) {
  const urls = documentExportUrls(id);
  return (
    <span className={className ?? "flex items-center gap-2 text-xs"}>
      <a href={urls.md} className="hover:underline" target="_blank" rel="noopener noreferrer">
        .md
      </a>
      <a href={urls.txt} className="hover:underline" target="_blank" rel="noopener noreferrer">
        .txt
      </a>
    </span>
  );
}
