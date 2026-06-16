"use client";
// src/features/trails/ui/trail-create-form.tsx
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { Form, FormFeedback, FormField, IdempotencyField, SubmitButton, TextInput, Textarea } from "@/components/ui";
import type { ActionResult } from "@/utils/create-action";

import { createTrail } from "../actions";
import type { Trail } from "../types";

const initial: ActionResult<Trail | null> = { success: true, data: null };

export function TrailCreateForm() {
  const router = useRouter();
  const [state, action] = useActionState(createTrail, initial);

  const fieldErrors: Record<string, string> =
    !state.success && state.code === "validation" ? state.fieldErrors : {};

  useEffect(() => {
    if (state.success && state.data?.id) {
      router.push(`/trails/${state.data.id}`);
    }
  }, [state, router]);

  return (
    <Form action={action} errors={fieldErrors} className="flex flex-col gap-4">
      <IdempotencyField result={state} />
      <FormField name="title" label="Название" required>
        <TextInput name="title" required maxLength={200} placeholder="Название маршрута" />
      </FormField>

      <FormField name="description" label="Описание">
        <Textarea name="description" maxLength={2000} rows={3} placeholder="Краткое описание (необязательно)" />
      </FormField>

      <FormField name="visibility" label="Видимость">
        <select
          name="visibility"
          defaultValue="private"
          className="rounded border border-(--color-border) px-2 py-1 text-sm"
        >
          <option value="private">Приватный</option>
          <option value="public">Публичный</option>
        </select>
      </FormField>
      <p className="text-xs text-(--color-description)">
        Публичный маршрут нельзя будет вернуть в приватный — только удалить.
      </p>

      <FormFeedback result={state} forbiddenAction="создание маршрута" />

      <div>
        <SubmitButton>Создать</SubmitButton>
      </div>
    </Form>
  );
}
