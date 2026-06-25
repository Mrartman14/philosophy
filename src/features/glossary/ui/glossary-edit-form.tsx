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
  VersionField,
} from "@/components/ui";
import { useT } from "@/i18n/client";
import { initialActionState } from "@/utils/action-state";

import { updateTermBlocks } from "../actions";
import type { TermBlocksUpdateFormInput } from "../schemas";
import type { Term } from "../types";

const initial = initialActionState<Term | null>(null);

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
        <VersionField version={term.version} />
        <input type="hidden" name={f("blocks")} value={JSON.stringify(blocks)} />
        <IdempotencyField result={state} />

        <Field name="blocks" label={t("blocksLabel")} required>
          <LazyAstEditor
            defaultValue={term.blocks ?? []}
            entityContext="glossary"
            ariaLabel={t("blocksLabel")}
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
