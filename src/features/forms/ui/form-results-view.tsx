// src/features/forms/ui/form-results-view.tsx
import { getT } from "@/i18n";

import type { Form, FormStats } from "../types";

import { FieldStatsCard } from "./field-stats-card";
import { FormVisibilityBadges } from "./form-visibility-badges";

interface Props {
  form: Form;
  stats: FormStats;
  token?: string;
}

export async function FormResultsView({ form, stats, token }: Props) {
  const t = await getT("forms");
  const fields = (form.fields ?? []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const byField = new Map((stats.fields ?? []).map((s) => [s.field_id, s]));
  const total = stats.total_submissions ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-xl font-semibold">{form.title}</h1>
          <span className="text-sm text-(--color-fg-muted)">{t("results.totalSubmissions", { n: total })}</span>
        </div>
        <FormVisibilityBadges form={form} />
      </header>
      {total === 0 ? (
        <p className="text-sm text-(--color-fg-muted)">{t("results.empty")}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {fields.map((f) => (
            <FieldStatsCard
              key={f.id}
              field={f}
              stats={byField.get(f.id)}
              formId={form.id ?? ""}
              {...(token ? { token } : {})}
            />
          ))}
        </div>
      )}
    </div>
  );
}
