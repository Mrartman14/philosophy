"use client";
// src/features/forms/ui/form-fill.tsx
import { useState } from "react";

import { Button, useToast } from "@/components/ui";
import { useIdempotencyKey } from "@/hooks/use-idempotency-key";
import { useT } from "@/i18n/client";
import { toastActionError } from "@/utils/action-toast";
import { IDEMPOTENCY_FIELD } from "@/utils/idempotency";

import { submitForm } from "../actions";
import { encodeAnswerValue, emptyAnswerValue, type AnswerInput } from "../answer-codec";
import type { Form, FormField, AstBlock } from "../types";

import { FormAfterSubmit } from "./form-after-submit";
import { FormFieldInput } from "./form-field-input";

interface Props {
  form: Form;
  /** share-token из ?token= — для отправки в приватную форму. */
  token?: string;
}

export function FormFill({ form, token }: Props) {
  const toast = useToast();
  const t = useT("forms");
  const tErrors = useT("errors");
  const { key: idempotencyKey, rotate } = useIdempotencyKey();
  const fields: FormField[] = (form.fields ?? [])
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const [values, setValues] = useState<Record<string, AnswerInput>>(() => {
    const init: Record<string, AnswerInput> = {};
    for (const f of fields) init[f.id ?? ""] = emptyAnswerValue(f.type ?? "text");
    return init;
  });
  const [pending, setPending] = useState(false);
  const [afterBlocks, setAfterBlocks] = useState<AstBlock[] | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium">{t("submitSuccessMessage")}</p>
        {afterBlocks && afterBlocks.length > 0 && <FormAfterSubmit blocks={afterBlocks} />}
      </div>
    );
  }

  async function onSubmit() {
    // Кодируем ответы; пустые необязательные — пропускаем, пустые обязательные — ошибка.
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
      // multi_choice required с пустым массивом — даём беку отклонить (INVALID_SUBMISSION).
      answers.push({ field_id: fid, value: enc });
    }

    setPending(true);
    const fd = new FormData();
    fd.set("formId", form.id ?? "");
    fd.set("answers", JSON.stringify(answers));
    if (token) fd.set("token", token);
    fd.set(IDEMPOTENCY_FIELD, idempotencyKey);
    const result = await submitForm({ success: true, data: null }, fd);
    setPending(false);

    if (!result.success) {
      toastActionError(toast, tErrors, result, {
        action: t("fillAction"),
        failureTitle: t("fillFailureTitle"),
      });
      return;
    }
    rotate();
    setAfterBlocks((result.data?.after_submit_blocks ?? []));
    setDone(true);
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
      {form.submission_visibility === "public" && (
        <p className="rounded border border-(--color-border) bg-(--color-surface-subtle) p-3 text-xs text-(--color-fg-muted)">
          {t("publicVoteConsent")}
        </p>
      )}
      <div>
        <Button type="button" disabled={pending} onClick={() => { void onSubmit(); }}>
          {pending ? t("submittingButton") : t("submitButton")}
        </Button>
      </div>
    </div>
  );
}
