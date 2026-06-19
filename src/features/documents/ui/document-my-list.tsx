// src/features/documents/ui/document-my-list.tsx
import { RouterLink } from "@/components/ui";

import type { Document } from "../types";

interface Props {
  documents: Document[];
}

const visibilityLabel: Record<string, string> = {
  private: "приватный",
  public: "публичный",
};

export function DocumentMyList({ documents }: Props) {
  if (documents.length === 0) {
    return (
      <p className="text-sm text-(--color-fg-muted)">
        У вас пока нет документов.
      </p>
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-(--color-border)">
      {documents.map((doc) => (
        <li key={doc.id} className="flex items-center justify-between gap-2 py-2">
          <RouterLink href={`/documents/${doc.id}`} className="text-sm hover:underline">
            {doc.filename ?? "Без названия"}
          </RouterLink>
          <span className="text-xs text-(--color-fg-muted)">
            {visibilityLabel[doc.visibility ?? "private"] ?? doc.visibility}
          </span>
        </li>
      ))}
    </ul>
  );
}
