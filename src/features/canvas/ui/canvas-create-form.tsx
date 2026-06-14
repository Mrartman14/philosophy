"use client";
// src/features/canvas/ui/canvas-create-form.tsx
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { Form, FormField, TextInput, Textarea, Select, SubmitButton, useToast } from "@/components/ui";
import type { ActionResult } from "@/utils/create-action";

import { createCanvas } from "../actions";
import type { Canvas } from "../types";

const initial: ActionResult<Canvas | null> = { success: true, data: null };

/**
 * Создание канваса: title + visibility + опц. data-JSON (по умолчанию пустой
 * граф). Редактора графа в фазе 1 нет — data вводится сырым JSON.
 */
export function CanvasCreateForm() {
  const router = useRouter();
  const toast = useToast();
  const [state, action] = useActionState(createCanvas, initial);

  useEffect(() => {
    if (state.success && state.data?.id) {
      toast.add({ title: "Канвас создан" });
      router.push(`/canvases/${state.data.id}`);
    } else if (!state.success && state.code !== "validation") {
      const msg = state.code === "forbidden" ? "У вас нет прав на создание канваса." : state.error;
      toast.add({ title: "Ошибка", description: msg });
    }
    // state — единственный триггер; toast/router стабильны
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fieldErrors = !state.success && state.code === "validation" ? state.fieldErrors : {};

  return (
    <Form action={action} errors={fieldErrors}>
      <FormField name="title" label="Название" required>
        <TextInput name="title" required />
      </FormField>
      <FormField name="visibility" label="Видимость">
        <Select
          name="visibility"
          defaultValue="private"
          options={[
            { value: "private", label: "Приватный" },
            { value: "public", label: "Публичный" },
          ]}
        />
      </FormField>
      <FormField name="data" label="Данные графа (JSON, необязательно)" description='Например: {"nodes":[],"edges":[]}'>
        <Textarea name="data" rows={6} placeholder='{"nodes":[],"edges":[]}' />
      </FormField>
      <SubmitButton>Создать</SubmitButton>
    </Form>
  );
}
