"use client";
// src/features/documents/ui/document-upload-form.tsx
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { Form, FormFeedback, FormField, Select, Stack, SubmitButton } from "@/components/ui";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { uploadDocument } from "../actions";
import type { Document } from "../types";

const initial: ActionResult<Document | null> = { success: true, data: null };

export function DocumentUploadForm() {
  const t = useT("documents");
  const router = useRouter();
  const [state, action] = useActionState(uploadDocument, initial);

  useEffect(() => {
    if (state.success && state.data?.id) {
      router.push(`/documents/${state.data.id}`);
    }
  }, [state, router]);

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
