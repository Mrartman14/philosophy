// src/features/forms/ui/my-submissions-list.tsx
import { RouterLink } from "@/components/ui";
import { getT, getServerFmt } from "@/i18n";

import type { SubmissionListItem } from "../types";

interface Props {
  submissions: SubmissionListItem[];
}

export async function MySubmissionsList({ submissions }: Props) {
  const t = await getT("forms");
  const fmt = await getServerFmt();

  if (submissions.length === 0) {
    return <p className="text-sm text-(--color-fg-muted)">{t("noSubmissions")}</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-(--color-border)">
      {submissions.map((s) => (
        <li key={s.id} className="flex items-center justify-between gap-2 py-2">
          <RouterLink href={`/submissions/${s.id}`} className="text-sm hover:underline">
            {t("formLinkPrefix", { id: s.form_id?.slice(0, 8) ?? "" })}
          </RouterLink>
          <span className="text-xs text-(--color-fg-muted)">
            {s.retracted_at
              ? t("submissionRetractedLabel")
              : fmt.dateTime(new Date(s.submitted_at ?? ""))}
          </span>
        </li>
      ))}
    </ul>
  );
}
