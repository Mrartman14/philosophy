// src/features/forms/ui/submission-list.tsx
import { UserView } from "@/components/shared/user-view";
import { RouterLink } from "@/components/ui";
import { getT, getServerFmt } from "@/i18n";

import type { SubmissionListItem } from "../types";

interface Props {
  submissions: SubmissionListItem[];
}

export async function SubmissionList({ submissions }: Props) {
  const t = await getT("forms");
  const fmt = await getServerFmt();

  if (submissions.length === 0) {
    return <p className="text-sm text-(--color-fg-muted)">{t("noSubmissionsAdmin")}</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-(--color-border)">
      {submissions.map((s) => (
        <li key={s.id} className="flex items-center justify-between gap-2 py-2">
          <div className="flex min-w-0 flex-col">
            <RouterLink href={`/submissions/${s.id}`} className="text-sm hover:underline">
              {t("submissionLinkPrefix", { id: s.id?.slice(0, 8) ?? "" })}
            </RouterLink>
            {/* Автор отклика — бэк отдаёт submission.user (userref.Ref). */}
            <span className="text-xs text-(--color-fg-muted)">
              <UserView user={s.user} />
            </span>
          </div>
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
