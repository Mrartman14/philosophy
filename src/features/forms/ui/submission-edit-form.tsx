"use client";
// src/features/forms/ui/submission-edit-form.tsx
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, useToast } from "@/components/ui";
import { useT } from "@/i18n/client";
import { toastActionError } from "@/utils/action-toast";

import { editSubmission } from "../actions";
import { encodeAnswerValue, emptyAnswerValue, type AnswerInput } from "../answer-codec";
import type { Form, FormField, Submission } from "../types";

import { FormFieldInput } from "./form-field-input";

interface Props {
  form: Form;
  submission: Submission;
}

/** Декодирует wire-value существующего ответа обратно в AnswerInput для контролов. */
function wireToInput(type: FormField["type"], value: unknown): AnswerInput {
  const t = type ?? "text";
  const v = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  switch (t) {
    case "text":
    case "long_text":
      return { text: typeof v.text === "string" ? v.text : "" };
    case "number":
      return { number: typeof v.number === "number" ? String(v.number) : "" };
    case "date":
      return { date: typeof v.date === "string" ? v.date : "" };
    case "single_choice":
      return { optionId: typeof v.option_id === "string" ? v.option_id : "" };
    case "multi_choice":
      return { optionIds: Array.isArray(v.option_ids) ? (v.option_ids as string[]) : [] };
    default:
      return emptyAnswerValue("text");
  }
}

export function SubmissionEditForm({ form, submission }: Props) {
  const router = useRouter();
  const toast = useToast();
  const t = useT("forms");
  const fields: FormField[] = (form.fields ?? [])
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const answerByField = new Map((submission.answers ?? []).map((a) => [a.field_id, a.value]));

  const [values, setValues] = useState<Record<string, AnswerInput>>(() => {
    const init: Record<string, AnswerInput> = {};
    for (const f of fields) init[f.id ?? ""] = wireToInput(f.type, answerByField.get(f.id));
    return init;
  });
  const [pending, setPending] = useState(false);

  async function onSave() {
    const answers: { field_id: string; value: Record<string, unknown> }[] = [];
    for (const f of fields) {
      const fid = f.id ?? "";
      const enc = encodeAnswerValue(f.type ?? "text", values[fid] ?? emptyAnswerValue(f.type ?? "text"));
      if (enc === null) {
        if (f.required) {
          toast.add({ title: t("requiredFieldsTitle"), description: t("requiredFieldsDescription") });
          return;
        }
        continue;
      }
      answers.push({ field_id: fid, value: enc });
    }
    setPending(true);
    const fd = new FormData();
    fd.set("id", submission.id ?? "");
    fd.set("answers", JSON.stringify(answers));
    const result = await editSubmission({ success: true, data: null }, fd);
    setPending(false);
    if (!result.success) {
      toastActionError(toast, result, { action: "изменение отклика", failureTitle: "Не удалось сохранить" });
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {fields.map((f) => (
        <FormFieldInput
          key={f.id}
          field={f}
          disabled={pending}
          value={values[f.id ?? ""] ?? emptyAnswerValue(f.type ?? "text")}
          onChange={(next) => { setValues((prev) => ({ ...prev, [f.id ?? ""]: next })); }}
        />
      ))}
      <div>
        <Button type="button" disabled={pending} onClick={() => { void onSave(); }}>
          {pending ? t("savingButton") : t("saveButton")}
        </Button>
      </div>
    </div>
  );
}
