// src/features/forms/ui/field-stats-card.tsx
import { RouterLink } from "@/components/ui";
import { getT } from "@/i18n";

import { fieldAnswersHref } from "../results-href";
import type { FieldStats, FormField } from "../types";

import { blocksToPlainText } from "./blocks-text";
import { ChoiceBars } from "./choice-bars";
import { DateSummary } from "./date-summary";
import { NumberSummary } from "./number-summary";
import { TextAnswersPreview } from "./text-answers-preview";

interface Props {
  field: FormField;
  stats: FieldStats | undefined;
  formId: string;
  token?: string;
}

export async function FieldStatsCard({ field, stats, formId, token }: Props) {
  const t = await getT("forms");
  const type = field.type ?? "text";
  const answered = stats?.answered ?? 0;

  return (
    <section className="flex flex-col gap-3 border-b border-(--color-border) pb-4">
      <header className="flex flex-col gap-0.5">
        <h2 className="text-base font-semibold">{blocksToPlainText(field.prompt ?? [])}</h2>
        <p className="text-xs text-(--color-fg-muted)">
          {t(`results.fieldType.${type}`)} · {t("results.answered", { n: answered })}
        </p>
      </header>
      {(type === "single_choice" || type === "multi_choice") && (
        <div className="flex flex-col gap-2">
          <ChoiceBars options={stats?.options ?? []} answered={answered} multi={type === "multi_choice"} />
          {answered > 0 && (
            <RouterLink
              href={fieldAnswersHref(formId, field.id ?? "", token ? { token } : {})}
              className="self-start text-sm text-(--color-link) hover:underline"
            >
              {t("results.allAnswers")}
            </RouterLink>
          )}
        </div>
      )}
      {type === "number" && stats?.number && <NumberSummary stats={stats.number} />}
      {type === "date" && stats?.date && <DateSummary stats={stats.date} />}
      {(type === "text" || type === "long_text") && (
        <TextAnswersPreview
          formId={formId}
          fieldId={field.id ?? ""}
          fieldType={type}
          {...(token ? { token } : {})}
        />
      )}
    </section>
  );
}
