"use client";
// src/features/canvas/ui/canvas-create-form.tsx
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { Form, createTypedForm, TextInput, Textarea, Select, Stack, SubmitButton, useToast } from "@/components/ui";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { createCanvas } from "../actions";
import type { CanvasCreateFormInput } from "../schemas";
import type { Canvas } from "../types";

const initial: ActionResult<Canvas | null> = { success: true, data: null };

const { Field, errors } = createTypedForm<CanvasCreateFormInput>();

/**
 * Создание канваса: title + visibility + опц. data-JSON (по умолчанию пустой
 * граф). Редактора графа в фазе 1 нет — data вводится сырым JSON.
 */
export function CanvasCreateForm() {
  const router = useRouter();
  const toast = useToast();
  const t = useT("canvas");
  const tErrors = useT("errors");
  const [state, action] = useActionState(createCanvas, initial);

  useEffect(() => {
    if (state.success && state.data?.id) {
      toast.add({ title: t("createForm.toastCreatedTitle") });
      router.push(`/canvases/${state.data.id}`);
    } else if (!state.success && state.code !== "validation") {
      const msg =
        state.code === "forbidden"
          ? tErrors("forbiddenAction", { action: t("createForbiddenAction") })
          : state.error;
      toast.add({ title: t("createForm.toastErrorTitle"), description: msg });
    }
    // state — единственный триггер; toast/router стабильны
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Form action={action} errors={errors(state)}>
      <Stack>
        <Field name="title" label={t("createForm.titleLabel")} required>
          <TextInput required />
        </Field>
        <Field name="visibility" label={t("createForm.visibilityLabel")}>
          <Select
            defaultValue="private"
            options={[
              { value: "private", label: t("createForm.visibilityPrivate") },
              { value: "public", label: t("createForm.visibilityPublic") },
            ]}
          />
        </Field>
        <Field
          name="data"
          label={t("createForm.dataLabel")}
          description={t("createForm.dataDescription")}
        >
          <Textarea rows={6} placeholder='{"nodes":[],"edges":[]}' />
        </Field>
        <SubmitButton>{t("createForm.submitCreate")}</SubmitButton>
      </Stack>
    </Form>
  );
}
