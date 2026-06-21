"use client";
// src/features/annotations/ui/annotation-edit-form.tsx
import { useActionState, useEffect, useState } from "react";

import type { AstBlock } from "@/components/ast-editor";
import { LazyAstEditor } from "@/components/ast-editor/lazy-ast-editor";
import { Form, FormField, IdempotencyField, Stack, SubmitButton } from "@/components/ui";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { updateAnnotation } from "../actions";
import type { Annotation } from "../types";

const initial: ActionResult<Annotation | null> = { success: true, data: null };

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
  const tErrors = useT("errors");
  const [blocks, setBlocks] = useState<AstBlock[]>(
    (annotation.blocks ?? []),
  );
  const [state, action] = useActionState(updateAnnotation, initial);

  const fieldErrors: Record<string, string> =
    !state.success && state.code === "validation"
      ? state.fieldErrors
      : {};

  useEffect(() => {
    // initial.data === null → срабатывает только после реального сохранения.
    if (state.success && state.data) onSuccess?.();
  }, [state, onSuccess]);

  return (
    <Form action={action} errors={fieldErrors}>
      <Stack>
        <input type="hidden" name="id" value={annotation.id ?? ""} />
        <input type="hidden" name="version" value={annotation.version ?? ""} />
        <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />
        <IdempotencyField result={state} />

        <FormField name="blocks" label={t("editBodyLabel")}>
          <LazyAstEditor
            defaultValue={(annotation.blocks ?? [])}
            entityContext="annotation"
            onChange={(next: AstBlock[]) => { setBlocks(next); }}
            ariaLabel={t("editBodyAriaLabel")}
          />
        </FormField>

        {state.success && state.data && (
          <p className="text-sm text-(--color-fg-muted)">{t("editSuccess")}</p>
        )}
        {!state.success && state.code === "forbidden" && (
          <p className="text-sm text-red-600">
            {tErrors("forbiddenAction", { action: t("editForbiddenAction") })}
          </p>
        )}
        {!state.success && !state.code && (
          <p className="text-sm text-red-600">{state.error}</p>
        )}

        <div>
          <SubmitButton>{t("editSubmit")}</SubmitButton>
        </div>
      </Stack>
    </Form>
  );
}
