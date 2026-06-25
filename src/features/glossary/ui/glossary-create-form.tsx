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
  TextInput,
} from "@/components/ui";
import { useActionRedirect } from "@/hooks/use-action-redirect";
import { useT } from "@/i18n/client";
import { initialActionState } from "@/utils/action-state";

import { createTerm } from "../actions";
import type { TermCreateFormInput } from "../schemas";
import type { Term } from "../types";

const initial = initialActionState<Term | null>(null);

const { Field, f, errors } = createTypedForm<TermCreateFormInput>();

export function GlossaryCreateForm() {
  const t = useT("glossary");
  const [blocks, setBlocks] = useState<AstBlock[]>([]);
  const [state, action] = useActionState(createTerm, initial);

  // Термин создан целиком (title + тело) — возвращаемся к списку.
  useActionRedirect(state, () => `/admin/glossary`);

  return (
    <Form action={action} errors={errors(state)}>
      <Stack>
        <input type="hidden" name={f("blocks")} value={JSON.stringify(blocks)} />
        <IdempotencyField result={state} />

        <Field name="title" label={t("titleLabel")} required>
          <TextInput aria-required maxLength={300} placeholder={t("titlePlaceholder")} />
        </Field>

        <Field name="blocks" label={t("blocksLabel")} required>
          <LazyAstEditor
            defaultValue={[]}
            entityContext="glossary"
            ariaLabel={t("blocksLabel")}
            onChange={(next: AstBlock[]) => { setBlocks(next); }}
          />
        </Field>

        <FormFeedback result={state} forbiddenAction={t("createTermAction")} />

        <div>
          <SubmitButton>{t("createButton")}</SubmitButton>
        </div>
      </Stack>
    </Form>
  );
}
