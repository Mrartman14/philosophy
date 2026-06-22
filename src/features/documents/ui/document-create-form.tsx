"use client";
// src/features/documents/ui/document-create-form.tsx
import { useActionState, useState } from "react";

import type { AstBlock } from "@/components/ast-editor";
import { LazyAstEditor } from "@/components/ast-editor/lazy-ast-editor";
import { createTypedForm, Form, FormFeedback, IdempotencyField, Select, Stack, SubmitButton, TextInput } from "@/components/ui";
import { useActionRedirect } from "@/hooks/use-action-redirect";
import { useT } from "@/i18n/client";
import { initialActionState } from "@/utils/action-state";

import { createDocument } from "../actions";
import type { DocumentCreateFormInput } from "../schemas";
import type { Document } from "../types";

const initial = initialActionState<Document | null>(null);

const { Field, f, errors } = createTypedForm<DocumentCreateFormInput>();

export function DocumentCreateForm() {
  const t = useT("documents");
  const [blocks, setBlocks] = useState<AstBlock[]>([]);
  const [state, action] = useActionState(createDocument, initial);

  useActionRedirect(state, (data) => `/documents/${data.id}`);

  return (
    <Form action={action} errors={errors(state)}>
      <Stack>
        <input type="hidden" name={f("blocks")} value={JSON.stringify(blocks)} />
        <IdempotencyField result={state} />

        <Field name="title" label={t("titleLabel")} required>
          <TextInput required maxLength={500} placeholder={t("titlePlaceholder")} />
        </Field>

        <Field name="visibility" label={t("visibilityLabel")}>
          <Select
            defaultValue="private"
            options={[
              { value: "private", label: t("visibilityPrivate") },
              { value: "public", label: t("visibilityPublic") },
            ]}
          />
        </Field>
        <p className="text-xs text-(--color-fg-muted)">
          {t("publicWarning")}
        </p>

        <Field name="blocks" label={t("contentLabel")} required>
          <LazyAstEditor
            defaultValue={[]}
            entityContext="document"
            onChange={setBlocks}
          />
        </Field>

        <FormFeedback result={state} forbiddenAction={t("createAction")} />

        <div>
          <SubmitButton>{t("createButton")}</SubmitButton>
        </div>
      </Stack>
    </Form>
  );
}
