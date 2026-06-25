// src/features/lectures/ui/lecture-document-selector.tsx
import { RouterLink } from "@/components/ui";

import type { LectureDocument } from "../types";

interface Props {
  documents: Pick<LectureDocument, "id" | "filename">[];
  activeId: string;
  token?: string;
  navLabel: string;
}

const BASE =
  "-mb-px max-w-[14rem] truncate rounded-t border-b-2 px-3 py-1.5 text-sm transition-colors";
const ACTIVE =
  "border-(--color-accent) bg-(--color-surface-subtle) font-semibold text-(--color-fg)";
const INACTIVE =
  "border-transparent text-(--color-fg-muted) hover:text-(--color-fg)";

/**
 * Строка-селектор документов лекции (URL-driven просмотр). Каждый документ —
 * ссылка `?doc=<id>` (навигация, не ARIA-tablist). Активная подсвечена + несёт
 * aria-current. ≤1 документа → не рендерится.
 */
export function LectureDocumentSelector({ documents, activeId, token, navLabel }: Props) {
  const docs = documents.filter(
    (d): d is Pick<LectureDocument, "filename"> & { id: string } => Boolean(d.id),
  );
  if (docs.length <= 1) return null;
  return (
    <nav aria-label={navLabel} className="flex flex-wrap gap-1 border-b border-(--color-border)">
      {docs.map((d) => {
        const active = d.id === activeId;
        const href = token
          ? `?doc=${encodeURIComponent(d.id)}&token=${encodeURIComponent(token)}`
          : `?doc=${encodeURIComponent(d.id)}`;
        return (
          <RouterLink
            key={d.id}
            href={href}
            title={d.filename ?? d.id}
            aria-current={active ? "page" : undefined}
            className={`${BASE} ${active ? ACTIVE : INACTIVE}`}
          >
            {d.filename ?? d.id}
          </RouterLink>
        );
      })}
    </nav>
  );
}
