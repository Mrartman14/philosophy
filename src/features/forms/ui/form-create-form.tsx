"use client";
// src/features/forms/ui/form-create-form.tsx
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { Form, FormFeedback, IdempotencyField, Stack, SubmitButton } from "@/components/ui";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { createForm } from "../actions";
import type { Form as FormEntity } from "../types";

import { FormBuilder } from "./form-builder";

const initial: ActionResult<FormEntity | null> = { success: true, data: null };

export function FormCreateForm() {
  const router = useRouter();
  const t = useT("forms");
  const [state, action] = useActionState(createForm, initial);
  const fieldErrors: Record<string, string> =
    !state.success && state.code === "validation" ? state.fieldErrors : {};

  useEffect(() => {
    if (state.success && state.data?.id) router.push(`/forms/${state.data.id}`);
  }, [state, router]);

  return (
    <Form action={action} errors={fieldErrors}>
      <Stack>
        <IdempotencyField result={state} />
        <FormBuilder mode="create" />
        <FormFeedback result={state} forbiddenAction={t("createFormForbiddenAction")} />
        <div><SubmitButton>{t("createSubmit")}</SubmitButton></div>
      </Stack>
    </Form>
  );
}
