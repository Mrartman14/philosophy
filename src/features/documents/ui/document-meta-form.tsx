"use client";
// src/features/documents/ui/document-meta-form.tsx
import { useActionState } from "react";

import { createTypedForm, Form, Stack, SubmitButton, TextInput } from "@/components/ui";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { updateDocumentMeta } from "../actions";
import type { DocumentMetaFormInput } from "../schemas";
import type { Document } from "../types";

const initial: ActionResult<Document | null> = { success: true, data: null };

const { Field, f, errors } = createTypedForm<DocumentMetaFormInput>();

interface Props {
  document: Document;
}

export function DocumentMetaForm({ document }: Props) {
  const t = useT("documents");
  const tErrors = useT("errors");
  const [state, action] = useActionState(updateDocumentMeta, initial);

  return (
    <Form action={action} errors={errors(state)}>
      <Stack>
        <input type="hidden" name={f("id")} value={document.id ?? ""} />
        <Field name="title" label={t("titleLabel")} required>
          <TextInput
            defaultValue={document.filename ?? ""}
            required
            maxLength={500}
          />
        </Field>
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
