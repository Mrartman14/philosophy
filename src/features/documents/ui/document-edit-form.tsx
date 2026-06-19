"use client";
// src/features/documents/ui/document-edit-form.tsx
import { useActionState, useState } from "react";

import { AstEditor } from "@/components/ast-editor";
import type { AstBlock } from "@/components/ast-editor";
import { Form, FormField, IdempotencyField, SubmitButton } from "@/components/ui";
import type { ActionResult } from "@/utils/create-action";

import { updateDocumentBlocks } from "../actions";
import type { Document } from "../types";

const initial: ActionResult<Document | null> = { success: true, data: null };

interface Props {
  document: Document;
}

export function DocumentEditForm({ document }: Props) {
  const [blocks, setBlocks] = useState<AstBlock[]>(document.blocks ?? []);
  const [state, action] = useActionState(updateDocumentBlocks, initial);

  return (
    <Form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={document.id ?? ""} />
      <input type="hidden" name="version" value={document.version ?? ""} />
      <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />
      <IdempotencyField result={state} />

      <FormField name="blocks" label="Содержимое">
        <AstEditor
          defaultValue={document.blocks ?? []}
          entityContext="document"
          onChange={(next: AstBlock[]) => { setBlocks(next); }}
        />
      </FormField>

      {state.success && state.data && (
        <p className="text-sm text-(--color-fg-muted)">Сохранено.</p>
      )}
      {!state.success && state.code === "forbidden" && (
        <p className="text-sm text-red-600">У вас нет прав на изменение документа.</p>
      )}
      {!state.success && !state.code && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      <div>
        <SubmitButton>Сохранить содержимое</SubmitButton>
      </div>
    </Form>
  );
}
