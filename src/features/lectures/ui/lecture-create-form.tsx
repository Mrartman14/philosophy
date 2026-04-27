"use client";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Form,
  FormField,
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
  const fieldErrors =
    state.success === false && state.code === "validation" ? state.fieldErrors : undefined;

  useEffect(() => {
    if (state.success && state.data) {
      router.push(`/admin/lectures/${state.data.id}/edit`);
    }
  }, [state, router]);

  return (
    <Form action={action} errors={fieldErrors} className="max-w-xl">
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

      {state.success === false && state.code === "forbidden" && (
        <p className="text-sm text-red-600">У вас нет прав на создание лекции.</p>
      )}
      {state.success === false && !state.code && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      <div>
        <SubmitButton>Создать</SubmitButton>
      </div>
    </Form>
  );
}
