"use client";
// src/features/annotations/ui/annotation-edit-form.tsx
import { useActionState, useEffect, useState } from "react";

import { AstEditor, type AstBlock } from "@/components/ast-editor";
import { Form, FormField, IdempotencyField, SubmitButton } from "@/components/ui";
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
    <Form action={action} errors={fieldErrors} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={annotation.id ?? ""} />
      <input type="hidden" name="version" value={annotation.version ?? ""} />
      <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />
      <IdempotencyField result={state} />

      <FormField name="blocks" label="Текст аннотации">
        <AstEditor
          defaultValue={(annotation.blocks ?? [])}
          entityContext="annotation"
          onChange={(next: AstBlock[]) => { setBlocks(next); }}
          ariaLabel="Текст аннотации"
        />
      </FormField>

      {state.success && state.data && (
        <p className="text-sm text-(--color-fg-muted)">Сохранено.</p>
      )}
      {!state.success && state.code === "forbidden" && (
        <p className="text-sm text-red-600">
          У вас нет прав на изменение аннотации.
        </p>
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
