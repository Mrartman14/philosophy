"use client";
// src/features/trails/ui/trail-meta-form.tsx
import { useActionState } from "react";

import { createTypedForm, Form, FormFeedback, IdempotencyField, Stack, SubmitButton, TextInput, Textarea, VersionField } from "@/components/ui";
import { useT } from "@/i18n/client";
import { initialActionState } from "@/utils/action-state";

import { updateTrailMeta } from "../actions";
import type { TrailMetaFormInput } from "../schemas";
import type { Trail, TrailWithItems } from "../types";

interface Props {
  trail: Trail | TrailWithItems;
}

const { Field, f, errors } = createTypedForm<TrailMetaFormInput>();

export function TrailMetaForm({ trail }: Props) {
  const t = useT("trails");
  const initial = initialActionState<Trail | null>(null);
  const [state, action] = useActionState(updateTrailMeta, initial);

  // exactOptionalPropertyTypes: successText подставляем только при успешном сохранении
  // (иначе свойство опускаем — нельзя передавать undefined).
  const successText = state.success && state.data ? { successText: t("metaSaved") } : {};

  return (
    <Form action={action} errors={errors(state)}>
      <Stack>
        <input type="hidden" name={f("id")} value={trail.id} />
        <VersionField version={trail.version} />
        <IdempotencyField result={state} />

        <Field name="title" label={t("metaTitleLabel")} required>
          <TextInput aria-required maxLength={200} defaultValue={trail.title} />
        </Field>

        {/* description — required-ключ z.input (нет .optional() в makeTrailMetaSchema:
            пустая строка допустима, но сам ключ обязан присутствовать). */}
        <Field name="description" label={t("metaDescriptionLabel")} required>
          <Textarea maxLength={2000} rows={3} defaultValue={trail.description ?? ""} />
        </Field>

        <FormFeedback
          result={state}
          forbiddenAction={t("metaForbiddenAction")}
          {...successText}
        />

        <div>
          <SubmitButton>{t("metaSubmit")}</SubmitButton>
        </div>
      </Stack>
    </Form>
  );
}
