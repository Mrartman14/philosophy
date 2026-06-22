"use client";
// src/features/trails/ui/trail-meta-form.tsx
import { useActionState } from "react";

import { Form, FormField, IdempotencyField, Stack, SubmitButton, TextInput, Textarea } from "@/components/ui";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { updateTrailMeta } from "../actions";
import type { Trail, TrailWithItems } from "../types";

interface Props {
  trail: Trail | TrailWithItems;
}

export function TrailMetaForm({ trail }: Props) {
  const t = useT("trails");
  const tErrors = useT("errors");
  const initial: ActionResult<Trail | null> = { success: true, data: null };
  const [state, action] = useActionState(updateTrailMeta, initial);

  const fieldErrors: Record<string, string> =
    !state.success && state.code === "validation" ? state.fieldErrors : {};

  return (
    <Form action={action} errors={fieldErrors}>
      <Stack>
        <input type="hidden" name="id" value={trail.id} />
        <input type="hidden" name="version" value={String(trail.version ?? "")} />
        <IdempotencyField result={state} />

        <FormField name="title" label={t("metaTitleLabel")} required>
          <TextInput required maxLength={200} defaultValue={trail.title} />
        </FormField>

        <FormField name="description" label={t("metaDescriptionLabel")}>
          <Textarea maxLength={2000} rows={3} defaultValue={trail.description ?? ""} />
        </FormField>

        {!state.success && state.code === "forbidden" && (
          <p className="text-sm text-red-600">
            {tErrors("forbiddenGeneric")}
          </p>
        )}
        {!state.success && !state.code && (
          <p className="text-sm text-red-600">{state.error}</p>
        )}
        {state.success && state.data && (
          <p className="text-sm text-green-600">{t("metaSaved")}</p>
        )}

        <div>
          <SubmitButton>{t("metaSubmit")}</SubmitButton>
        </div>
      </Stack>
    </Form>
  );
}
