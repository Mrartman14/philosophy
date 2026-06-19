// src/features/documents/ui/document-my-list.tsx
import { RouterLink } from "@/components/ui";
import { getT } from "@/i18n";

import type { Document } from "../types";

interface Props {
  documents: Document[];
}

export async function DocumentMyList({ documents }: Props) {
  const t = await getT("documents");
  if (documents.length === 0) {
    return (
      <p className="text-sm text-(--color-fg-muted)">
        {t("emptyMyList")}
      </p>
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-(--color-border)">
      {documents.map((doc) => (
        <li key={doc.id} className="flex items-center justify-between gap-2 py-2">
          <RouterLink href={`/documents/${doc.id}`} className="text-sm hover:underline">
            {doc.filename ?? t("noTitle")}
          </RouterLink>
          <span className="text-xs text-(--color-fg-muted)">
            {doc.visibility === "public" ? t("visibilityPublic") : t("visibilityPrivate")}
          </span>
        </li>
      ))}
    </ul>
  );
}
