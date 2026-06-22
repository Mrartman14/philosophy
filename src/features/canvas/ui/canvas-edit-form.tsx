"use client";
// src/features/canvas/ui/canvas-edit-form.tsx
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { Form, createTypedForm, TextInput, Textarea, Stack, SubmitButton, useToast } from "@/components/ui";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { updateCanvas } from "../actions";
import type { CanvasUpdateFormInput } from "../schemas";
import type { Canvas } from "../types";

const initial: ActionResult<Canvas | null> = { success: true, data: null };

const { Field, f, errors } = createTypedForm<CanvasUpdateFormInput>();

interface Props {
  canvas: Canvas;
  /**
   * Значение заголовка ETag из ответа GET (с кавычками, формат `"...000Z"`).
   * Кладётся как есть в скрытое поле и шлётся как If-Match — бек сам снимает
   * кавычки. НЕ берём версию из JSON canvas.updated_at: Go обрезает хвостовые
   * нули мс, из-за чего бек отдаёт ложный 412. null → версии нет (action
   * отклонит сохранение с просьбой обновить страницу).
   */
  etag: string | null;
}

/**
 * Редактирование канваса: title + data-JSON. ETag (версия канваса) хранится в
 * скрытом поле и шлётся как If-Match — на 412 action вернёт понятный текст.
 * data сериализуется из canvas.data в pretty-JSON для удобства правки.
 */
export function CanvasEditForm({ canvas, etag }: Props) {
  const router = useRouter();
  const toast = useToast();
  const t = useT("canvas");
  const tErrors = useT("errors");
  const [state, action] = useActionState(updateCanvas, initial);

  useEffect(() => {
    if (state.success && state.data) {
      toast.add({ title: t("editForm.toastSavedTitle") });
      router.refresh();
    } else if (!state.success && state.code !== "validation") {
      const msg =
        state.code === "forbidden"
          ? tErrors("forbiddenAction", { action: t("updateForbiddenAction") })
          : state.error;
      toast.add({ title: t("editForm.toastErrorTitle"), description: msg });
    }
    // state — единственный триггер; toast/router стабильны
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const dataJson = JSON.stringify(canvas.data ?? { nodes: [], edges: [] }, null, 2);

  return (
    <Form action={action} errors={errors(state)}>
      <Stack>
        <input type="hidden" name={f("id")} value={canvas.id ?? ""} />
        {/* etag — не ключ схемы (читается через formData.get как If-Match), оставляем raw */}
        <input type="hidden" name="etag" value={etag ?? ""} />
        <Field name="title" label={t("editForm.titleLabel")} required>
          <TextInput defaultValue={canvas.title ?? ""} required />
        </Field>
        <Field name="data" label={t("editForm.dataLabel")}>
          <Textarea rows={14} defaultValue={dataJson} mono />
        </Field>
        <SubmitButton>{t("editForm.submitSave")}</SubmitButton>
      </Stack>
    </Form>
  );
}
