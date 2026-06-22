"use client";
// src/features/annotations/ui/annotation-edit-form.tsx
import { useActionState, useEffect, useState } from "react";

import type { AstBlock } from "@/components/ast-editor";
import { LazyAstEditor } from "@/components/ast-editor/lazy-ast-editor";
import { createTypedForm, Form, FormFeedback, IdempotencyField, Stack, SubmitButton, VersionField } from "@/components/ui";
import { useT } from "@/i18n/client";
import { initialActionState } from "@/utils/action-state";

import { updateAnnotation } from "../actions";
import type { AnnotationUpdateFormInput } from "../schemas";
import type { Annotation } from "../types";

const initial = initialActionState<Annotation | null>(null);

const { Field, f, errors } = createTypedForm<AnnotationUpdateFormInput>();

interface Props {
  annotation: Annotation;
  /**
   * Вызывается после успешного сохранения. Родитель (кнопка-диалог) закрывает
   * диалог и делает router.refresh(), чтобы список перечитался на сервере.
   */
  onSuccess?: () => void;
}

/**
 * Форма редактирования. Меняются только blocks (visibility иммутабельна —
 * её нет в форме, §6.8). Монтируется под <SchemaContextProvider>.
 */
export function AnnotationEditForm({ annotation, onSuccess }: Props) {
  const t = useT("annotations");
  const [blocks, setBlocks] = useState<AstBlock[]>(
    (annotation.blocks ?? []),
  );
  const [state, action] = useActionState(updateAnnotation, initial);

  useEffect(() => {
    // initial.data === null → срабатывает только после реального сохранения.
    if (state.success && state.data) onSuccess?.();
  }, [state, onSuccess]);

  // exactOptionalPropertyTypes: текст успеха только при реальном сохранении —
  // иначе опускаем свойство (нельзя передавать undefined).
  const successText =
    state.success && state.data ? { successText: t("editSuccess") } : {};

  return (
    <Form action={action} errors={errors(state)}>
      <Stack>
        <input type="hidden" name={f("id")} value={annotation.id ?? ""} />
        {/* version — If-Match (optimistic concurrency), читается action'ом из
            FormData в заголовок. НЕ body-ключ схемы → raw name, не f(). */}
        <VersionField version={annotation.version} />
        <input type="hidden" name={f("blocks")} value={JSON.stringify(blocks)} />
        <IdempotencyField result={state} />

        <Field name="blocks" label={t("editBodyLabel")} required>
          <LazyAstEditor
            defaultValue={(annotation.blocks ?? [])}
            entityContext="annotation"
            onChange={(next: AstBlock[]) => { setBlocks(next); }}
            ariaLabel={t("editBodyAriaLabel")}
          />
        </Field>

        <FormFeedback
          result={state}
          forbiddenAction={t("editForbiddenAction")}
          {...successText}
        />

        <div>
          <SubmitButton>{t("editSubmit")}</SubmitButton>
        </div>
      </Stack>
    </Form>
  );
}
