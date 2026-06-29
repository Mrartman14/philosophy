// src/features/forms/ui/text-answers-preview.tsx
import { UserView } from "@/components/shared/user-view";
import { RouterLink } from "@/components/ui";
import { getServerFmt, getT } from "@/i18n";

import { readAnswerValue } from "../answer-read";
import { getFieldAnswers } from "../api";
import type { FieldType } from "../types";

interface Props {
  formId: string;
  fieldId: string;
  fieldType: FieldType;
  token?: string;
  /** answered — число заполнивших; решает, рисовать ли «Все ответы →». */
  answered: number;
}

const PREVIEW = 20;

export async function TextAnswersPreview({ formId, fieldId, fieldType, token, answered }: Props) {
  const [t, fmt] = await Promise.all([getT("forms"), getServerFmt()]);
  const page = await getFieldAnswers(formId, fieldId, {
    ...(token ? { token } : {}),
    offset: 0,
    limit: PREVIEW,
  });
  if (!page || page.items.length === 0) {
    return <p className="text-sm text-(--color-fg-muted)">{t("results.noTextAnswers")}</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {page.items.map((a) => {
          const rv = readAnswerValue(fieldType, a.value);
          return (
            <li key={a.submission_id} className="flex flex-col gap-0.5 border-s-2 border-(--color-border) ps-3">
              <div className="flex items-center gap-2 text-xs text-(--color-fg-muted)">
                <UserView user={a.user} />
                <span>{a.submitted_at ? fmt.dateTime(a.submitted_at) : ""}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{rv.kind === "text" ? rv.text : ""}</p>
            </li>
          );
        })}
      </ul>
      {answered > PREVIEW && (
        <RouterLink
          href={`/forms/${formId}/fields/${fieldId}${token ? `?token=${encodeURIComponent(token)}` : ""}`}
          className="self-start text-sm text-(--color-link) hover:underline"
        >
          {t("results.allAnswers")}
        </RouterLink>
      )}
    </div>
  );
}
