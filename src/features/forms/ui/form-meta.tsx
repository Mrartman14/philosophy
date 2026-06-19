// src/features/forms/ui/form-meta.tsx
import { getT } from "@/i18n";

import type { Form } from "../types";

export async function FormMeta({ form }: { form: Form }) {
  const t = await getT("forms");
  const visLabel: Record<string, string> = {
    private: t("visibility.private"),
    public: t("visibility.public"),
  };
  const modeLabel: Record<string, string> = {
    editable: t("submissionMode.editable"),
    immutable: t("submissionMode.immutable"),
  };

  return (
    <div className="flex flex-wrap gap-2 text-xs text-(--color-fg-muted)">
      <span className="rounded border border-(--color-border) px-2 py-0.5">
        {visLabel[form.visibility ?? "private"] ?? form.visibility}
      </span>
      <span className="rounded border border-(--color-border) px-2 py-0.5">
        {modeLabel[form.submission_mode ?? "editable"] ?? form.submission_mode}
      </span>
      {form.published_at && (
        <span className="rounded border border-(--color-border) px-2 py-0.5">{t("publishedBadge")}</span>
      )}
    </div>
  );
}
