// src/features/comments/ui/comment-export-links.tsx
/**
 * Прямые ссылки на .md/.txt выгрузки. В отличие от events, эти роуты бека
 * ПУБЛИЧНЫЕ (cmd/server/main.go:995-998 — только publicRL, без auth), поэтому
 * прокси не нужен — ссылаемся прямо на API. API_URL доступен только на сервере;
 * компонент серверный, читает env и кладёт готовый абсолютный href.
 */
const API_URL = process.env.API_URL ?? "http://localhost:8080";

interface Props {
  /** "lecture" → .../lectures/{id}/comments.*, "subtree" → .../comments/{id}/subtree.* */
  kind: "lecture" | "subtree";
  id: string;
}

export function CommentExportLinks({ kind, id }: Props) {
  const base =
    kind === "lecture"
      ? `${API_URL}/api/lectures/${encodeURIComponent(id)}/comments`
      : `${API_URL}/api/comments/${encodeURIComponent(id)}/subtree`;
  return (
    <span className="flex items-center gap-2 text-xs">
      <a href={`${base}.md`} className="hover:underline" target="_blank" rel="noopener noreferrer">
        .md
      </a>
      <a href={`${base}.txt`} className="hover:underline" target="_blank" rel="noopener noreferrer">
        .txt
      </a>
    </span>
  );
}
