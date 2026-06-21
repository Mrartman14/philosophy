"use client";
// src/features/canvas/ui/canvas-create-form.tsx
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { Form, FormField, TextInput, Textarea, Select, Stack, SubmitButton, useToast } from "@/components/ui";
import { useT } from "@/i18n/client";
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

  const fieldErrors = !state.success && state.code === "validation" ? state.fieldErrors : {};

  return (
    <Form action={action} errors={fieldErrors}>
      <Stack>
        <FormField name="title" label={t("createForm.titleLabel")} required>
          <TextInput name="title" required />
        </FormField>
        <FormField name="visibility" label={t("createForm.visibilityLabel")}>
          <Select
            name="visibility"
            defaultValue="private"
            options={[
              { value: "private", label: t("createForm.visibilityPrivate") },
              { value: "public", label: t("createForm.visibilityPublic") },
            ]}
          />
        </FormField>
        <FormField
          name="data"
          label={t("createForm.dataLabel")}
          description={t("createForm.dataDescription")}
        >
          <Textarea name="data" rows={6} placeholder='{"nodes":[],"edges":[]}' />
        </FormField>
        <SubmitButton>{t("createForm.submitCreate")}</SubmitButton>
      </Stack>
    </Form>
  );
}
