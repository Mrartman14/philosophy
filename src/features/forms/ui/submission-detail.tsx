// src/features/forms/ui/submission-detail.tsx
import { AstRender } from "@/components/ast-render";

import { decodeAnswerText } from "../answer-codec";
import type { Form, Submission } from "../types";

interface Props {
  form: Form;
  submission: Submission;
}

export function SubmissionDetail({ form, submission }: Props) {
  const fields = (form.fields ?? []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const answerByField = new Map((submission.answers ?? []).map((a) => [a.field_id, a.value]));

  if (submission.retracted_at) {
    return <p className="text-sm text-(--color-description)">Отклик отозван — ответы удалены.</p>;
  }

  return (
    <dl className="flex flex-col gap-3">
      {fields.map((f) => {
        const value = answerByField.get(f.id);
        const text = decodeAnswerText(f.type ?? "text", value ?? null, f.options ?? []);
        return (
          <div key={f.id} className="flex flex-col gap-1">
            <dt className="content font-medium" data-size="sm">
              <AstRender blocks={f.prompt ?? []} />
            </dt>
            <dd className="text-sm">{text || <span className="text-(--color-description)">—</span>}</dd>
          </div>
        );
      })}
    </dl>
  );
}
