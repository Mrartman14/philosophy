"use client";
// src/features/documents/ui/document-upload-form.tsx
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { Form, FormFeedback, FormField, SubmitButton } from "@/components/ui";
import type { ActionResult } from "@/utils/create-action";

import { uploadDocument } from "../actions";
import type { Document } from "../types";

const initial: ActionResult<Document | null> = { success: true, data: null };

export function DocumentUploadForm() {
  const router = useRouter();
  const [state, action] = useActionState(uploadDocument, initial);

  useEffect(() => {
    if (state.success && state.data?.id) {
      router.push(`/documents/${state.data.id}`);
    }
  }, [state, router]);

  return (
    <Form action={action} className="flex flex-col gap-4">
      <FormField name="file" label="Файл Markdown (.md)" required>
        <input
          type="file"
          name="file"
          accept=".md,.markdown,text/markdown"
          required
          className="text-sm"
        />
      </FormField>

      <FormField name="visibility" label="Видимость">
        <select
          name="visibility"
          defaultValue="private"
          className="rounded border border-(--color-border) px-2 py-1 text-sm"
        >
          <option value="private">Приватный</option>
          <option value="public">Публичный</option>
        </select>
      </FormField>

      <FormFeedback result={state} forbiddenAction="загрузку документа" />

      <div>
        <SubmitButton>Загрузить</SubmitButton>
      </div>
    </Form>
  );
}
