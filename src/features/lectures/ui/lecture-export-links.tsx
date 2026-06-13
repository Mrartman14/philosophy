import { lectureExportUrls } from "../export-urls";

interface Props {
  id: string;
  className?: string;
}

/**
 * Ссылки .md/.txt лекции (через локальный прокси /lectures/[id]/export).
 * Паттерн — DocumentExportLinks.
 */
export function LectureExportLinks({ id, className }: Props) {
  const urls = lectureExportUrls(id);
  return (
    <span
      className={
        className ?? "flex items-center gap-2 text-xs text-(--color-description)"
      }
    >
      <a href={urls.md} className="hover:underline" target="_blank" rel="noopener">
        .md
      </a>
      <a href={urls.txt} className="hover:underline" target="_blank" rel="noopener">
        .txt
      </a>
    </span>
  );
}
