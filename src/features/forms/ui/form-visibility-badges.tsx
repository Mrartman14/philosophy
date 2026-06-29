// src/features/forms/ui/form-visibility-badges.tsx
import { getT } from "@/i18n";

import type { Form } from "../types";

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-(--color-border) px-2 py-0.5 text-xs text-(--color-fg-muted)">
      {children}
    </span>
  );
}

export async function FormVisibilityBadges({ form }: { form: Form }) {
  const t = await getT("forms");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Chip>{t(`badges.form.${form.visibility ?? "private"}`)}</Chip>
      <Chip>{t(`badges.results.${form.submission_visibility ?? "private"}`)}</Chip>
      <Chip>{t(`badges.mode.${form.submission_mode ?? "editable"}`)}</Chip>
    </div>
  );
}
