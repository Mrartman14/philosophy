"use client";
// src/features/documents/ui/document-meta-form.tsx
import { useActionState } from "react";

import { Form, FormField, Stack, SubmitButton, TextInput } from "@/components/ui";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { updateDocumentMeta } from "../actions";
import type { Document } from "../types";

const initial: ActionResult<Document | null> = { success: true, data: null };

interface Props {
  document: Document;
}

export function DocumentMetaForm({ document }: Props) {
  const t = useT("documents");
  const tErrors = useT("errors");
  const [state, action] = useActionState(updateDocumentMeta, initial);
  const fieldErrors: Record<string, string> =
    !state.success && state.code === "validation" ? state.fieldErrors : {};

  return (
    <Form action={action} errors={fieldErrors}>
      <Stack>
        <input type="hidden" name="id" value={document.id ?? ""} />
        <FormField name="title" label={t("titleLabel")} required>
          <TextInput
            name="title"
            defaultValue={document.filename ?? ""}
            required
            maxLength={500}
          />
        </FormField>
        {state.success && state.data && (
          <p className="text-sm text-(--color-fg-muted)">{t("savedMessage")}</p>
        )}
        {!state.success && state.code === "forbidden" && (
          <p className="text-sm text-red-600">
            {tErrors("forbiddenAction", { action: t("editForbiddenAction") })}
          </p>
        )}
        {!state.success && !state.code && (
          <p className="text-sm text-red-600">{state.error}</p>
        )}
        <div>
          <SubmitButton>{t("saveTitleButton")}</SubmitButton>
        </div>
      </Stack>
    </Form>
  );
}
