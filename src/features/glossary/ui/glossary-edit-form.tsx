"use client";
import { useActionState, useState } from "react";

import { AstEditor } from "@/components/ast-editor";
import type { AstBlock } from "@/components/ast-editor";
import {
  Form,
  FormField,
  SubmitButton,
} from "@/components/ui";
import type { ActionResult } from "@/utils/create-action";

import { updateTermBlocks } from "../actions";
import type { Term } from "../types";

const initial: ActionResult<Term | null> = { success: true, data: null };

interface Props {
  term: Term;
}

export function GlossaryEditForm({ term }: Props) {
  const [blocks, setBlocks] = useState<AstBlock[]>(term.blocks ?? []);
  const [state, action] = useActionState(updateTermBlocks, initial);

  const fieldErrors: Record<string, string> =
    !state.success && state.code === "validation"
      ? state.fieldErrors
      : {};

  return (
    <Form action={action} errors={fieldErrors} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={term.id ?? ""} />
      <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />

      <FormField name="blocks" label="Тело термина">
        <AstEditor
          defaultValue={term.blocks ?? []}
          entityContext="glossary"
          onChange={(next: AstBlock[]) => { setBlocks(next); }}
        />
      </FormField>

      {state.success && state.data && (
        <p className="text-sm text-(--color-description)">Сохранено.</p>
      )}
      {!state.success && state.code === "forbidden" && (
        <p className="text-sm text-red-600">У вас нет прав на изменение термина.</p>
      )}
      {!state.success && !state.code && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      <div>
        <SubmitButton>Сохранить</SubmitButton>
      </div>
    </Form>
  );
}
