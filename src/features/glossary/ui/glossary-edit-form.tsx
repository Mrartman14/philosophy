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

const { f, errors } = createTypedForm<TermBlocksUpdateFormInput>();

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

  const blocksError = errors(state).blocks;

  return (
    <Form action={action} errors={errors(state)}>
      <Stack>
        <input type="hidden" name={f("id")} value={term.id ?? ""} />
        {/* version — If-Match path-параметр (action читает из FormData), НЕ ключ схемы. */}
        <VersionField version={term.version} />
        <input type="hidden" name={f("blocks")} value={JSON.stringify(blocks)} />
        <IdempotencyField result={state} />

        {/*
          Тело НЕ оборачиваем в <Field name="blocks">: Base UI Field.Root
          пробрасывает name="blocks" на kit-контролы тулбара редактора и они
          уходят в FormData дублями (Object.fromEntries берёт последнее → пусто).
          Имя несёт ТОЛЬКО скрытый input выше; лейбл и ошибку рендерим рядом.
        */}
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">
            {t("blocksLabel")}
            <span className="ms-0.5 text-(--color-danger)">*</span>
          </span>
          <LazyAstEditor
            defaultValue={term.blocks ?? []}
            entityContext="glossary"
            onChange={(next: AstBlock[]) => { setBlocks(next); }}
          />
          {blocksError && (
            <span className="text-xs text-(--color-danger)">{blocksError}</span>
          )}
        </div>

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
