// src/features/glossary/ui/glossary-admin-row.tsx
import { RouterLink } from "@/components/ui";
import { getT } from "@/i18n";

import type { Term } from "../types";

import { GlossaryDeleteButton } from "./glossary-delete-button";

interface Props {
  term: Term;
  canEdit: boolean;
  canDelete: boolean;
}

export async function GlossaryAdminRow({ term, canEdit, canDelete }: Props) {
  const t = await getT("glossary");
  return (
    <li className="flex items-center justify-between gap-4 py-2">
      <span className="flex-1 truncate">{term.title}</span>
      <div className="flex items-center gap-2">
        {canEdit && term.id && (
          <RouterLink
            href={`/admin/glossary/${term.id}/edit`}
            className="text-sm hover:underline"
          >
            {t("editButton")}
          </RouterLink>
        )}
        {canDelete && term.id && (
          <GlossaryDeleteButton id={term.id} />
        )}
      </div>
    </li>
  );
}
