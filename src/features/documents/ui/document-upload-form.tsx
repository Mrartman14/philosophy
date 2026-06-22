"use client";
// src/features/documents/ui/document-upload-form.tsx
import { useActionState } from "react";

import { Form, FormFeedback, FormField, Select, Stack, SubmitButton } from "@/components/ui";
import { useActionRedirect } from "@/hooks/use-action-redirect";
import { useT } from "@/i18n/client";
import { initialActionState } from "@/utils/action-state";

import { uploadDocument } from "../actions";
import type { Document } from "../types";

const initial = initialActionState<Document | null>(null);

export function DocumentUploadForm() {
  const t = useT("documents");
  const [state, action] = useActionState(uploadDocument, initial);

  useActionRedirect(state, (data) => `/documents/${data.id}`);

  return (
    <Form action={action}>
      <Stack>
        <FormField name="file" label={t("fileLabel")} required>
          <input
            type="file"
            name="file"
            accept=".md,.markdown,text/markdown"
            required
            className="text-sm"
          />
        </FormField>

        <FormField name="visibility" label={t("visibilityLabel")}>
          <Select
            defaultValue="private"
            options={[
              { value: "private", label: t("visibilityPrivate") },
              { value: "public", label: t("visibilityPublic") },
            ]}
          />
        </FormField>

        <FormFeedback result={state} forbiddenAction={t("uploadAction")} />

        <div>
          <SubmitButton>{t("uploadButton")}</SubmitButton>
        </div>
      </Stack>
    </Form>
  );
}
