// src/features/glossary/ui/glossary-admin-row.tsx
import { RouterLink } from "@/components/ui";

import type { Term } from "../types";

import { GlossaryDeleteButton } from "./glossary-delete-button";

interface Props {
  term: Term;
  canEdit: boolean;
  canDelete: boolean;
}

export function GlossaryAdminRow({ term, canEdit, canDelete }: Props) {
  return (
    <li className="flex items-center justify-between gap-4 py-2">
      <span className="flex-1 truncate">{term.title}</span>
      <div className="flex items-center gap-2">
        {canEdit && term.id && (
          <RouterLink
            href={`/admin/glossary/${term.id}/edit`}
            className="text-sm hover:underline"
          >
            Редактировать
          </RouterLink>
        )}
        {canDelete && term.id && (
          <GlossaryDeleteButton id={term.id} />
        )}
      </div>
    </li>
  );
}
