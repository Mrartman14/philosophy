"use client";
// src/features/trails/ui/trail-create-form.tsx
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { Form, FormFeedback, FormField, IdempotencyField, SubmitButton, TextInput, Textarea } from "@/components/ui";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { createTrail } from "../actions";
import type { Trail } from "../types";

const initial: ActionResult<Trail | null> = { success: true, data: null };

export function TrailCreateForm() {
  const router = useRouter();
  const t = useT("trails");
  const [state, action] = useActionState(createTrail, initial);

  const fieldErrors: Record<string, string> =
    !state.success && state.code === "validation" ? state.fieldErrors : {};

  useEffect(() => {
    if (state.success && state.data?.id) {
      router.push(`/trails/${state.data.id}`);
    }
  }, [state, router]);

  return (
    <Form action={action} errors={fieldErrors} className="flex flex-col gap-4">
      <IdempotencyField result={state} />
      <FormField name="title" label={t("createTitleLabel")} required>
        <TextInput name="title" required maxLength={200} placeholder={t("createTitlePlaceholder")} />
      </FormField>

      <FormField name="description" label={t("createDescriptionLabel")}>
        <Textarea name="description" maxLength={2000} rows={3} placeholder={t("createDescriptionPlaceholder")} />
      </FormField>

      <FormField name="visibility" label={t("createVisibilityLabel")}>
        <select
          name="visibility"
          defaultValue="private"
          className="rounded border border-(--color-border) px-2 py-1 text-sm"
        >
          <option value="private">{t("createVisibilityPrivate")}</option>
          <option value="public">{t("createVisibilityPublic")}</option>
        </select>
      </FormField>
      <p className="text-xs text-(--color-fg-muted)">
        {t("createVisibilityNote")}
      </p>

      <FormFeedback result={state} forbiddenAction="создание маршрута" />

      <div>
        <SubmitButton>{t("createSubmit")}</SubmitButton>
      </div>
    </Form>
  );
}
