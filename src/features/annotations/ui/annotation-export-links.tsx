// src/features/annotations/ui/annotation-export-links.tsx
/**
 * Ссылки .md/.txt выгрузки аннотации через прокси-роут
 * /annotations/[id]/export (подкладывает токен — нужен для private).
 */
interface Props {
  id: string;
}

export function AnnotationExportLinks({ id }: Props) {
  return (
    <span className="flex items-center gap-2 text-xs">
      <a
        href={`/annotations/${id}/export?format=md`}
        className="hover:underline"
        target="_blank"
        rel="noopener"
      >
        .md
      </a>
      <a
        href={`/annotations/${id}/export?format=txt`}
        className="hover:underline"
        target="_blank"
        rel="noopener"
      >
        .txt
      </a>
    </span>
  );
}
