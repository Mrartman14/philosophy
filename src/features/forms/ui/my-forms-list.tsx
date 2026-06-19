// src/features/forms/ui/my-forms-list.tsx
import { RouterLink } from "@/components/ui";
import { getT } from "@/i18n";

import type { FormListItem } from "../types";

interface Props {
  forms: FormListItem[];
}

export async function MyFormsList({ forms }: Props) {
  const t = await getT("forms");
  const visLabel: Record<string, string> = {
    private: t("visibility.privateLower"),
    public: t("visibility.publicLower"),
  };
  const modeLabel: Record<string, string> = {
    editable: t("submissionMode.editableLower"),
    immutable: t("submissionMode.immutableLower"),
  };

  if (forms.length === 0) {
    return <p className="text-sm text-(--color-fg-muted)">{t("noForms")}</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-(--color-border)">
      {forms.map((f) => (
        <li key={f.id} className="flex items-center justify-between gap-2 py-2">
          <RouterLink href={`/forms/${f.id}`} className="text-sm hover:underline">
            {f.title ?? t("untitledForm")}
          </RouterLink>
          <span className="text-xs text-(--color-fg-muted)">
            {visLabel[f.visibility ?? "private"] ?? f.visibility}
            {" · "}
            {modeLabel[f.submission_mode ?? "editable"] ?? f.submission_mode}
            {f.published_at ? t("publishedSuffix") : t("draftSuffix")}
          </span>
        </li>
      ))}
    </ul>
  );
}
