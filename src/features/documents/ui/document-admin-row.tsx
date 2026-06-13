// src/features/documents/ui/document-admin-row.tsx
import Link from "next/link";
import { DocumentDeleteButton } from "./document-delete-button";
import type { Document } from "../types";

interface Props {
  document: Document;
  /** Можно ли admin-удалить (delete_any и не-private). */
  canDelete: boolean;
}

export function DocumentAdminRow({ document, canDelete }: Props) {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div className="flex flex-col">
        <Link href={`/documents/${document.id}`} className="text-sm hover:underline">
          {document.filename || "Без названия"}
        </Link>
        <span className="text-xs text-(--color-description)">
          {document.visibility} · автор {document.owner_id}
        </span>
      </div>
      {canDelete && document.id && (
        <DocumentDeleteButton id={document.id} admin redirectTo="/admin/documents" />
      )}
    </li>
  );
}
