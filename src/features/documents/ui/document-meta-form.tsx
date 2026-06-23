"use client";
// src/features/documents/ui/document-meta-form.tsx
import { useActionState } from "react";

import { createTypedForm, Form, FormFeedback, Stack, SubmitButton, TextInput } from "@/components/ui";
import { useT } from "@/i18n/client";
import { initialActionState } from "@/utils/action-state";

import { updateDocumentMeta } from "../actions";
import type { DocumentMetaFormInput } from "../schemas";
import type { Document } from "../types";

const initial = initialActionState<Document | null>(null);

const { Field, f, errors } = createTypedForm<DocumentMetaFormInput>();

interface Props {
  document: Document;
}

export function DocumentMetaForm({ document }: Props) {
  const t = useT("documents");
  const [state, action] = useActionState(updateDocumentMeta, initial);

  // exactOptionalPropertyTypes: successText передаём только при успешном сохранении
  // (начальный state тоже success, но без data) — иначе свойство опускаем.
  const successText =
    state.success && state.data ? { successText: t("savedMessage") } : {};

  return (
    <Form action={action} errors={errors(state)}>
      <Stack>
        <input type="hidden" name={f("id")} value={document.id ?? ""} />
        <Field name="title" label={t("titleLabel")} required>
          <TextInput
            defaultValue={document.filename ?? ""}
            aria-required
            maxLength={500}
          />
        </Field>
        <FormFeedback
          result={state}
          forbiddenAction={t("editForbiddenAction")}
          {...successText}
        />
        <div>
          <SubmitButton>{t("saveTitleButton")}</SubmitButton>
        </div>
      </Stack>
    </Form>
  );
}
