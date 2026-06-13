"use client";
// src/features/forms/ui/form-edit-form.tsx
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Form, SubmitButton } from "@/components/ui";
import type { ActionResult } from "@/utils/create-action";
import { updateForm } from "../actions";
import { FormBuilder, type BuilderInitial } from "./form-builder";
import type { BuilderField } from "./form-builder-field-row";
import { blocksToPlainText } from "./blocks-text";
import type { Form as FormEntity, FieldType } from "../types";

interface Props {
  form: FormEntity;
}

function toBuilderInitial(form: FormEntity): BuilderInitial {
  const fields: BuilderField[] = (form.fields ?? [])
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((f) => ({
      type: (f.type ?? "text") as FieldType,
      prompt: blocksToPlainText(f.prompt ?? []),
      help_text: blocksToPlainText(f.help_text ?? []),
      required: f.required ?? false,
      options: (f.options ?? []).map((o) => o.label ?? ""),
    }));
  return {
    title: form.title ?? "",
    description: blocksToPlainText(form.description ?? []),
    after_submit: blocksToPlainText(form.after_submit_blocks ?? []),
    visibility: form.visibility ?? "private",
    submission_mode: form.submission_mode ?? "editable",
    fields: fields.length > 0 ? fields : [{ type: "text", prompt: "", help_text: "", required: false, options: [] }],
  };
}

const initial: ActionResult<FormEntity | null> = { success: true, data: null };

export function FormEditForm({ form }: Props) {
  const router = useRouter();
  const [state, action] = useActionState(updateForm, initial);
  const fieldErrors: Record<string, string> =
    state.success === false && state.code === "validation" ? state.fieldErrors : {};

  useEffect(() => {
    if (state.success && state.data?.id) router.refresh();
  }, [state, router]);

  return (
    <Form action={action} errors={fieldErrors} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={form.id ?? ""} />
      <FormBuilder mode="edit" initial={toBuilderInitial(form)} />
      {fieldErrors._form && <p className="text-sm text-red-600" role="alert">{fieldErrors._form}</p>}
      {state.success === false && state.code === "forbidden" && (
        <p className="text-sm text-red-600">У вас нет прав на изменение формы.</p>
      )}
      {state.success === false && !state.code && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      <div><SubmitButton>Сохранить структуру</SubmitButton></div>
    </Form>
  );
}
