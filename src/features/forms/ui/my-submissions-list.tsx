// src/features/forms/ui/my-submissions-list.tsx
import { RouterLink } from "@/components/ui";

import type { SubmissionListItem } from "../types";

interface Props {
  submissions: SubmissionListItem[];
}

export function MySubmissionsList({ submissions }: Props) {
  if (submissions.length === 0) {
    return <p className="text-sm text-(--color-fg-muted)">У вас пока нет откликов.</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-(--color-border)">
      {submissions.map((s) => (
        <li key={s.id} className="flex items-center justify-between gap-2 py-2">
          <RouterLink href={`/submissions/${s.id}`} className="text-sm hover:underline">
            Форма {s.form_id?.slice(0, 8)}
          </RouterLink>
          <span className="text-xs text-(--color-fg-muted)">
            {s.retracted_at ? "отозван" : new Date(s.submitted_at ?? "").toLocaleString("ru-RU")}
          </span>
        </li>
      ))}
    </ul>
  );
}
