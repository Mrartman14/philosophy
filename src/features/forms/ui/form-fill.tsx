"use client";
// src/features/forms/ui/form-fill.tsx
import { useState } from "react";

import { Button, useToast } from "@/components/ui";

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
        <p className="text-sm font-medium">Ответ отправлен. Спасибо!</p>
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
          toast.add({ title: "Заполните обязательные поля", description: "Не все обязательные поля заполнены." });
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
    const result = await submitForm({ success: true, data: null }, fd);
    setPending(false);

    if (!result.success) {
      toast.add({
        title: result.code === "forbidden" ? "Нет прав" : "Не удалось отправить",
        description: result.code === "forbidden" ? "У вас нет прав на отправку отклика." : result.error,
      });
      return;
    }
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
      <div>
        <Button type="button" disabled={pending} onClick={() => { void onSubmit(); }}>
          {pending ? "Отправка…" : "Отправить отклик"}
        </Button>
      </div>
    </div>
  );
}
