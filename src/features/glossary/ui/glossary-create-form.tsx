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

  const blocksError = errors(state).blocks;

  return (
    <Form action={action} errors={errors(state)}>
      <Stack>
        <input type="hidden" name={f("blocks")} value={JSON.stringify(blocks)} />
        <IdempotencyField result={state} />

        <Field name="title" label={t("titleLabel")} required>
          <TextInput aria-required maxLength={300} placeholder={t("titlePlaceholder")} />
        </Field>

        {/*
          Тело НЕ оборачиваем в <Field name="blocks">: Base UI Field.Root
          пробрасывает name="blocks" на kit-контролы тулбара редактора
          (HeadingSelect и пр.) как Field.Control — и они уходят в FormData
          дублями поля blocks. Object.fromEntries берёт ПОСЛЕДНЕЕ значение
          (пустое) → «тело пустое». Имя blocks несёт ТОЛЬКО скрытый input выше;
          лейбл и ошибку рендерим рядом вручную.
        */}
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">
            {t("blocksLabel")}
            <span className="ms-0.5 text-(--color-danger)">*</span>
          </span>
          <LazyAstEditor
            defaultValue={[]}
            entityContext="glossary"
            onChange={(next: AstBlock[]) => { setBlocks(next); }}
          />
          {blocksError && (
            <span className="text-xs text-(--color-danger)">{blocksError}</span>
          )}
        </div>

        <FormFeedback result={state} forbiddenAction={t("createTermAction")} />

        <div>
          <SubmitButton>{t("createButton")}</SubmitButton>
        </div>
      </Stack>
    </Form>
  );
}
