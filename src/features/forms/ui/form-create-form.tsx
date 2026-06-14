"use client";
// src/features/forms/ui/form-create-form.tsx
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Form, SubmitButton } from "@/components/ui";
import type { ActionResult } from "@/utils/create-action";
import { createForm } from "../actions";
import { FormBuilder } from "./form-builder";
import type { Form as FormEntity } from "../types";

const initial: ActionResult<FormEntity | null> = { success: true, data: null };

export function FormCreateForm() {
  const router = useRouter();
  const [state, action] = useActionState(createForm, initial);
  const fieldErrors: Record<string, string> =
    !state.success && state.code === "validation" ? state.fieldErrors : {};

  useEffect(() => {
    if (state.success && state.data?.id) router.push(`/forms/${state.data.id}`);
  }, [state, router]);

  return (
    <Form action={action} errors={fieldErrors} className="flex flex-col gap-4">
      <FormBuilder mode="create" />
      {fieldErrors._form && <p className="text-sm text-red-600" role="alert">{fieldErrors._form}</p>}
      {!state.success && state.code === "forbidden" && (
        <p className="text-sm text-red-600">У вас нет прав на создание формы.</p>
      )}
      {!state.success && !state.code && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      <div><SubmitButton>Создать форму</SubmitButton></div>
    </Form>
  );
}
