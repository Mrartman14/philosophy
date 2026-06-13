"use client";
// src/features/trails/ui/trail-meta-form.tsx
import { useActionState } from "react";
import { Form, FormField, SubmitButton, TextInput, Textarea } from "@/components/ui";
import type { ActionResult } from "@/utils/create-action";
import { updateTrailMeta } from "../actions";
import type { Trail, TrailWithItems } from "../types";

interface Props {
  trail: Trail | TrailWithItems;
}

export function TrailMetaForm({ trail }: Props) {
  const initial: ActionResult<Trail | null> = { success: true, data: null };
  const [state, action] = useActionState(updateTrailMeta, initial);

  const fieldErrors: Record<string, string> =
    state.success === false && state.code === "validation" ? state.fieldErrors : {};

  return (
    <Form action={action} errors={fieldErrors} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={trail.id} />

      <FormField name="title" label="Название" required>
        <TextInput name="title" required maxLength={200} defaultValue={trail.title ?? ""} />
      </FormField>

      <FormField name="description" label="Описание">
        <Textarea name="description" maxLength={2000} rows={3} defaultValue={trail.description ?? ""} />
      </FormField>

      {state.success === false && state.code === "forbidden" && (
        <p className="text-sm text-red-600">У вас нет прав на редактирование маршрута.</p>
      )}
      {state.success === false && !state.code && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      {state.success && state.data && (
        <p className="text-sm text-green-600">Сохранено.</p>
      )}

      <div>
        <SubmitButton>Сохранить</SubmitButton>
      </div>
    </Form>
  );
}
