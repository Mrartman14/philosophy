// src/features/tags/ui/tag-create-form.tsx
"use client";
import { useActionState } from "react";
import { Form, FormField, SubmitButton, TextInput } from "@/components/ui";
import type { ActionResult } from "@/utils/create-action";
import { createTag } from "../actions";
import type { Tag } from "../types";

const initial: ActionResult<Tag | null> = { success: true, data: null };

export function TagCreateForm() {
  const [state, action] = useActionState(createTag, initial);
  const fieldErrors: Record<string, string> =
    !state.success && state.code === "validation"
      ? state.fieldErrors
      : {};

  return (
    <Form action={action} errors={fieldErrors} className="flex max-w-xl flex-col gap-3">
      <FormField name="name" label="Новый тег" required>
        <TextInput name="name" required maxLength={100} placeholder="Например: «этика»" />
      </FormField>

      {state.success && state.data && (
        <p className="text-sm text-green-600">Тег «{state.data.name}» создан.</p>
      )}
      {!state.success && state.code === "forbidden" && (
        <p className="text-sm text-red-600">У вас нет прав на создание тега.</p>
      )}
      {!state.success && !state.code && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      <div>
        <SubmitButton>Создать</SubmitButton>
      </div>
    </Form>
  );
}
