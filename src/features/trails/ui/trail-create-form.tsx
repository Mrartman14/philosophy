"use client";
// src/features/trails/ui/trail-create-form.tsx
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { Form, FormFeedback, FormField, IdempotencyField, Select, Stack, SubmitButton, TextInput, Textarea } from "@/components/ui";
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
    <Form action={action} errors={fieldErrors}>
      <Stack>
        <IdempotencyField result={state} />
        <FormField name="title" label={t("createTitleLabel")} required>
          <TextInput required maxLength={200} placeholder={t("createTitlePlaceholder")} />
        </FormField>

        <FormField name="description" label={t("createDescriptionLabel")}>
          <Textarea maxLength={2000} rows={3} placeholder={t("createDescriptionPlaceholder")} />
        </FormField>

        <FormField name="visibility" label={t("createVisibilityLabel")}>
          <Select
            defaultValue="private"
            options={[
              { value: "private", label: t("createVisibilityPrivate") },
              { value: "public", label: t("createVisibilityPublic") },
            ]}
          />
        </FormField>
        <p className="text-xs text-(--color-fg-muted)">
          {t("createVisibilityNote")}
        </p>

        <FormFeedback result={state} forbiddenAction={t("createForbiddenAction")} />

        <div>
          <SubmitButton>{t("createSubmit")}</SubmitButton>
        </div>
      </Stack>
    </Form>
  );
}
