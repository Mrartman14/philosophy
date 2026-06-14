"use client";
// src/features/documents/ui/document-create-form.tsx
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { AstEditor } from "@/components/ast-editor";
import type { AstBlock } from "@/components/ast-editor";
import { Form, FormField, SubmitButton, TextInput } from "@/components/ui";
import type { ActionResult } from "@/utils/create-action";

import { createDocument } from "../actions";
import type { Document } from "../types";

const initial: ActionResult<Document | null> = { success: true, data: null };

export function DocumentCreateForm() {
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

      <FormField name="title" label="Название" required>
        <TextInput name="title" required maxLength={500} placeholder="Название документа" />
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
      <p className="text-xs text-(--color-description)">
        Публичный документ нельзя будет вернуть в приватный — только удалить.
      </p>

      <FormField name="blocks" label="Содержимое">
        <AstEditor
          defaultValue={[]}
          entityContext="document"
          onChange={(next: AstBlock[]) => { setBlocks(next); }}
        />
      </FormField>

      {!state.success && state.code === "forbidden" && (
        <p className="text-sm text-red-600">У вас нет прав на создание документа.</p>
      )}
      {!state.success && !state.code && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      <div>
        <SubmitButton>Создать</SubmitButton>
      </div>
    </Form>
  );
}
