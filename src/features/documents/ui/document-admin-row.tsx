// src/features/documents/ui/document-admin-row.tsx
import { RouterLink } from "@/components/ui";

import type { Document } from "../types";

import { DocumentDeleteButton } from "./document-delete-button";

interface Props {
  document: Document;
  /** Можно ли admin-удалить (delete_any и не-private). */
  canDelete: boolean;
}

export function DocumentAdminRow({ document, canDelete }: Props) {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div className="flex flex-col">
        <RouterLink href={`/documents/${document.id}`} className="text-sm hover:underline">
          {document.filename ?? "Без названия"}
        </RouterLink>
        <span className="text-xs text-(--color-fg-muted)">
          {document.visibility} · автор {document.owner_id}
        </span>
      </div>
      {canDelete && document.id && (
        <DocumentDeleteButton id={document.id} admin redirectTo="/admin/documents" />
      )}
    </li>
  );
}
