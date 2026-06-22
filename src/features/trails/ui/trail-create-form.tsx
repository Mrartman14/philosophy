"use client";
// src/features/trails/ui/trail-create-form.tsx
import { useActionState } from "react";

import { createTypedForm, Form, FormFeedback, IdempotencyField, Select, Stack, SubmitButton, TextInput, Textarea } from "@/components/ui";
import { useActionRedirect } from "@/hooks/use-action-redirect";
import { useT } from "@/i18n/client";
import { initialActionState } from "@/utils/action-state";

import { createTrail } from "../actions";
import type { TrailCreateFormInput } from "../schemas";
import type { Trail } from "../types";

const initial = initialActionState<Trail | null>(null);

const { Field, errors } = createTypedForm<TrailCreateFormInput>();

export function TrailCreateForm() {
  const t = useT("trails");
  const [state, action] = useActionState(createTrail, initial);

  useActionRedirect(state, (data) => `/trails/${data.id}`);

  return (
    <Form action={action} errors={errors(state)}>
      <Stack>
        <IdempotencyField result={state} />
        <Field name="title" label={t("createTitleLabel")} required>
          <TextInput required maxLength={200} placeholder={t("createTitlePlaceholder")} />
        </Field>

        <Field name="description" label={t("createDescriptionLabel")}>
          <Textarea maxLength={2000} rows={3} placeholder={t("createDescriptionPlaceholder")} />
        </Field>

        <Field name="visibility" label={t("createVisibilityLabel")}>
          <Select
            defaultValue="private"
            options={[
              { value: "private", label: t("createVisibilityPrivate") },
              { value: "public", label: t("createVisibilityPublic") },
            ]}
          />
        </Field>
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
