"use client";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import {
  Form,
  FormField,
  SubmitButton,
  TextInput,
} from "@/components/ui";
import type { ActionResult } from "@/utils/create-action";

import { createTerm } from "../actions";
import type { Term } from "../types";

const initial: ActionResult<Term | null> = { success: true, data: null };

export function GlossaryCreateForm() {
  const router = useRouter();
  const [state, action] = useActionState(createTerm, initial);
  const fieldErrors: Record<string, string> =
    !state.success && state.code === "validation"
      ? state.fieldErrors
      : {};

  useEffect(() => {
    if (state.success && state.data?.id) {
      router.push(`/admin/glossary/${state.data.id}/edit`);
    }
  }, [state, router]);

  return (
    <Form action={action} errors={fieldErrors} className="max-w-xl">
      <FormField name="title" label="Название" required>
        <TextInput name="title" required maxLength={300} placeholder="Например: «Эпистемология»" />
      </FormField>

      {!state.success && state.code === "forbidden" && (
        <p className="text-sm text-red-600">У вас нет прав на создание термина.</p>
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
