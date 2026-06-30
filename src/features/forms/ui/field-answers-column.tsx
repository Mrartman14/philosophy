// src/features/forms/ui/field-answers-column.tsx
import { UserView } from "@/components/shared/user-view";
import { RouterLink } from "@/components/ui";
import { getServerFmt, getT } from "@/i18n";

import { readAnswerValue } from "../answer-read";
import { fieldAnswersHref } from "../results-href";
import type { FieldAnswerItem, FormField } from "../types";

import { blocksToPlainText } from "./blocks-text";

interface Page {
  items: FieldAnswerItem[];
  total: number;
  offset: number;
  limit: number;
}

interface Props {
  field: FormField;
  page: Page;
  formId: string;
  token?: string | undefined;
}

/**
 * Атрибутированная колонка ответов на одно поле формы (страница уже загружена и
 * передана пропом `page`). Для choice-полей маппит option_id → label из
 * field.options; через readAnswerValue (Task 2) сужает opaque value по типу поля.
 * Пагинация — ссылками `?p=<номер страницы>` (RouterLink), token прокидывается в QS.
 */
export async function FieldAnswersColumn({ field, page, formId, token }: Props) {
  const [t, fmt] = await Promise.all([getT("forms"), getServerFmt()]);
  const type = field.type ?? "text";
  const labels = new Map(
    (field.options ?? [])
      .filter((o): o is { id: string; label: string } => !!o.id && o.label != null)
      .map((o) => [o.id, o.label] as const),
  );

  function renderValue(value: FieldAnswerItem["value"]): string {
    const rv = readAnswerValue(type, value);
    switch (rv.kind) {
      case "text":
        return rv.text;
      case "number":
        return fmt.number(rv.number);
      case "date":
        return rv.date;
      case "single":
        return labels.get(rv.optionId) ?? rv.optionId;
      case "multi":
        return rv.optionIds.map((id) => labels.get(id) ?? id).join(", ");
      default:
        return "—";
    }
  }

  const prompt = blocksToPlainText(field.prompt ?? []);

  const limit = page.limit;
  const currentPage = Math.floor(page.offset / limit);
  const hasPrev = currentPage > 0;
  const hasNext = page.offset + limit < page.total;

  return (
    <div className="flex flex-col gap-3">
      {prompt && <h2 className="text-base font-semibold">{prompt}</h2>}
      {page.items.length === 0 ? (
        <p className="text-sm text-(--color-fg-muted)">{t("results.noTextAnswers")}</p>
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-(--color-border)">
            {page.items.map((a) => (
              <li
                key={a.submission_id}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <span className="whitespace-pre-wrap">{renderValue(a.value)}</span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-(--color-fg-muted)">
                  <UserView user={a.user} />
                  {a.submitted_at ? fmt.dateTime(a.submitted_at) : ""}
                </span>
              </li>
            ))}
          </ul>
          {(hasPrev || hasNext) && (
            <nav
              className="flex items-center gap-4 text-sm"
              aria-label={t("results.paginationLabel")}
            >
              {hasPrev && (
                <RouterLink
                  href={fieldAnswersHref(formId, field.id ?? "", {
                    ...(token ? { token } : {}),
                    page: currentPage - 1,
                  })}
                  className="text-sm text-(--color-link) hover:underline"
                >
                  {t("results.prevPage")}
                </RouterLink>
              )}
              {hasNext && (
                <RouterLink
                  href={fieldAnswersHref(formId, field.id ?? "", {
                    ...(token ? { token } : {}),
                    page: currentPage + 1,
                  })}
                  className="text-sm text-(--color-link) hover:underline"
                >
                  {t("results.nextPage")}
                </RouterLink>
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
