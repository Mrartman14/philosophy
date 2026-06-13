"use client";
// src/features/canvas/ui/canvas-edit-form.tsx
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Form, FormField, TextInput, Textarea, SubmitButton, useToast } from "@/components/ui";
import type { ActionResult } from "@/utils/create-action";
import { updateCanvas } from "../actions";
import type { Canvas } from "../types";

const initial: ActionResult<Canvas | null> = { success: true, data: null };

interface Props {
  canvas: Canvas;
}

/**
 * Редактирование канваса: title + data-JSON. updated_at канваса хранится в
 * скрытом поле и шлётся как If-Match — на 412 action вернёт понятный текст.
 * data сериализуется из canvas.data в pretty-JSON для удобства правки.
 */
export function CanvasEditForm({ canvas }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [state, action] = useActionState(updateCanvas, initial);

  useEffect(() => {
    if (state.success && state.data) {
      toast.add({ title: "Сохранено" });
      router.refresh();
    } else if (!state.success && state.code !== "validation") {
      const msg = state.code === "forbidden" ? "У вас нет прав на изменение канваса." : state.error;
      toast.add({ title: "Ошибка", description: msg });
    }
    // state — единственный триггер; toast/router стабильны
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fieldErrors = state.success === false && state.code === "validation" ? state.fieldErrors : {};
  const dataJson = JSON.stringify(canvas.data ?? { nodes: [], edges: [] }, null, 2);

  return (
    <Form action={action} errors={fieldErrors}>
      <input type="hidden" name="id" value={canvas.id ?? ""} />
      <input type="hidden" name="updated_at" value={canvas.updated_at ?? ""} />
      <FormField name="title" label="Название" required>
        <TextInput name="title" defaultValue={canvas.title ?? ""} required />
      </FormField>
      <FormField name="data" label="Данные графа (JSON)">
        <Textarea name="data" rows={14} defaultValue={dataJson} className="font-mono text-xs" />
      </FormField>
      <SubmitButton>Сохранить</SubmitButton>
    </Form>
  );
}
