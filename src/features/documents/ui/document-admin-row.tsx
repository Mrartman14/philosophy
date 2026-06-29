// src/features/documents/ui/document-admin-row.tsx
import { UserView } from "@/components/shared/user-view";
import { RouterLink } from "@/components/ui";
import { getT } from "@/i18n";

import type { Document } from "../types";

import { DocumentDeleteButton } from "./document-delete-button";

interface Props {
  document: Document;
  /** Можно ли admin-удалить (delete_any и не-private). */
  canDelete: boolean;
}

export async function DocumentAdminRow({ document, canDelete }: Props) {
  const t = await getT("documents");
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div className="flex flex-col">
        <RouterLink href={`/documents/${document.id}`} className="text-sm hover:underline">
          {document.filename ?? t("noTitle")}
        </RouterLink>
        <span className="text-xs text-(--color-fg-muted)">
          {document.visibility === "public" ? t("visibilityPublic") : t("visibilityPrivate")}
          {" · "}
          {t("authorLabel")} <UserView user={document.owner} />
        </span>
      </div>
      {canDelete && document.id && (
        <DocumentDeleteButton id={document.id} admin redirectTo="/admin/documents" />
      )}
    </li>
  );
}
