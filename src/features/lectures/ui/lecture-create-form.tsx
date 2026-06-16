"use client";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import {
  Form,
  FormFeedback,
  FormField,
  IdempotencyField,
  Select,
  SubmitButton,
  TextInput,
  Textarea,
} from "@/components/ui";
import type { ActionResult } from "@/utils/create-action";

import { createLecture } from "../actions";
import type { Lecture } from "../types";

const initial: ActionResult<Lecture | null> = { success: true, data: null };

export function LectureCreateForm() {
  const router = useRouter();
  const [state, action] = useActionState(createLecture, initial);
  const fieldErrors: Record<string, string> =
    !state.success && state.code === "validation" ? state.fieldErrors : {};

  useEffect(() => {
    if (state.success && state.data) {
      router.push(`/admin/lectures/${state.data.id}/edit`);
    }
  }, [state, router]);

  return (
    <Form action={action} errors={fieldErrors} className="max-w-xl">
      <IdempotencyField result={state} />
      <FormField name="title" label="Название" required>
        <TextInput name="title" required maxLength={200} />
      </FormField>

      <FormField name="date" label="Дата" required description="Формат ГГГГ-ММ-ДД">
        <TextInput name="date" required placeholder="2026-04-27" />
      </FormField>

      <FormField name="description" label="Описание">
        <Textarea name="description" rows={6} maxLength={5000} />
      </FormField>

      <FormField name="visibility" label="Видимость">
        <Select
          name="visibility"
          defaultValue="private"
          options={[
            { value: "private", label: "Приватная" },
            { value: "public", label: "Публичная" },
          ]}
        />
      </FormField>

      <FormFeedback result={state} forbiddenAction="создание лекции" />

      <div>
        <SubmitButton>Создать</SubmitButton>
      </div>
    </Form>
  );
}
