"use client";
// src/features/documents/ui/document-create-form.tsx
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { AstEditor } from "@/components/ast-editor";
import type { AstBlock } from "@/components/ast-editor";
import { Form, FormFeedback, FormField, IdempotencyField, SubmitButton, TextInput } from "@/components/ui";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { createDocument } from "../actions";
import type { Document } from "../types";

const initial: ActionResult<Document | null> = { success: true, data: null };

export function DocumentCreateForm() {
  const t = useT("documents");
  const router = useRouter();
  const [blocks, setBlocks] = useState<AstBlock[]>([]);
  const [state, action] = useActionState(createDocument, initial);

  const fieldErrors: Record<string, string> =
    !state.success && state.code === "validation" ? state.fieldErrors : {};

  useEffect(() => {
    if (state.success && state.data?.id) {
      router.push(`/documents/${state.data.id}`);
    }
  }, [state, router]);

  return (
    <Form action={action} errors={fieldErrors} className="flex flex-col gap-4">
      <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />
      <IdempotencyField result={state} />

      <FormField name="title" label={t("titleLabel")} required>
        <TextInput name="title" required maxLength={500} placeholder={t("titlePlaceholder")} />
      </FormField>

      <FormField name="visibility" label={t("visibilityLabel")}>
        <select
          name="visibility"
          defaultValue="private"
          className="rounded border border-(--color-border) px-2 py-1 text-sm"
        >
          <option value="private">{t("visibilityPrivate")}</option>
          <option value="public">{t("visibilityPublic")}</option>
        </select>
      </FormField>
      <p className="text-xs text-(--color-fg-muted)">
        {t("publicWarning")}
      </p>

      <FormField name="blocks" label={t("contentLabel")}>
        <AstEditor
          defaultValue={[]}
          entityContext="document"
          onChange={setBlocks}
        />
      </FormField>

      {/* FormFeedback.forbiddenAction flows through frozen action-message seam;
          the literal "создание документа" remains until that seam gets its i18n
          foundation-PR. */}
      <FormFeedback result={state} forbiddenAction="создание документа" />

      <div>
        <SubmitButton>{t("createButton")}</SubmitButton>
      </div>
    </Form>
  );
}
