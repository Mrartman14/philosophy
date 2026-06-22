"use client";
import { useActionState, useState } from "react";

import type { AstBlock } from "@/components/ast-editor";
import { LazyAstEditor } from "@/components/ast-editor/lazy-ast-editor";
import {
  createTypedForm,
  Form,
  FormFeedback,
  IdempotencyField,
  Stack,
  SubmitButton,
} from "@/components/ui";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { updateTermBlocks } from "../actions";
import type { TermBlocksUpdateFormInput } from "../schemas";
import type { Term } from "../types";

const initial: ActionResult<Term | null> = { success: true, data: null };

const { Field, f, errors } = createTypedForm<TermBlocksUpdateFormInput>();

interface Props {
  term: Term;
}

export function GlossaryEditForm({ term }: Props) {
  const [blocks, setBlocks] = useState<AstBlock[]>(term.blocks ?? []);
  const [state, action] = useActionState(updateTermBlocks, initial);
  const t = useT("glossary");

  // exactOptionalPropertyTypes: текст успеха только при реальном сохранении —
  // иначе опускаем свойство (нельзя передавать undefined).
  const successText =
    state.success && state.data ? { successText: t("savedMessage") } : {};

  return (
    <Form action={action} errors={errors(state)}>
      <Stack>
        <input type="hidden" name={f("id")} value={term.id ?? ""} />
        {/* version — If-Match path-параметр (action читает из FormData), НЕ ключ схемы. */}
        <input type="hidden" name="version" value={term.version ?? ""} />
        <input type="hidden" name={f("blocks")} value={JSON.stringify(blocks)} />
        <IdempotencyField result={state} />

        <Field name="blocks" label={t("blocksLabel")} required>
          <LazyAstEditor
            defaultValue={term.blocks ?? []}
            entityContext="glossary"
            onChange={(next: AstBlock[]) => { setBlocks(next); }}
          />
        </Field>

        <FormFeedback
          result={state}
          forbiddenAction={t("updateTermAction")}
          {...successText}
        />

        <div>
          <SubmitButton>{t("saveButton")}</SubmitButton>
        </div>
      </Stack>
    </Form>
  );
}
