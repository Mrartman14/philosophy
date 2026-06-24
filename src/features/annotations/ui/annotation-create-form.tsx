"use client";
// src/features/annotations/ui/annotation-create-form.tsx
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import type { AstBlock } from "@/components/ast-editor";
import { LazyAstEditor } from "@/components/ast-editor/lazy-ast-editor";
import { createTypedForm, Form, FormFeedback, IdempotencyField, Stack, SubmitButton } from "@/components/ui";
import { useT } from "@/i18n/client";
import { initialActionState } from "@/utils/action-state";

import { createAnnotation } from "../actions";
import type { AnnotationCreateFormInput } from "../schemas";
import type { Anchor, Annotation, ParentEntityType } from "../types";

import { AnnotationVisibilityField } from "./annotation-visibility-field";

const initial = initialActionState<Annotation | null>(null);

const { Field, f, errors } = createTypedForm<AnnotationCreateFormInput>();

interface Props {
  parentEntityType: ParentEntityType;
  parentId: string;
  /** Опциональный якорь (text-range/media-interval) — скрытое поле. */
  anchor?: Anchor;
  /** Вызывается при успешном создании (напр. закрыть модалку). */
  onSuccess?: () => void;
}

/**
 * Форма создания аннотации. AST-тело (entityContext="annotation") + выбор
 * видимости (фиксируется навсегда). Должна быть смонтирована внутри
 * <SchemaContextProvider> родителем (AstEditor требует useSchema).
 * Форма принимает опциональный `anchor` (из selection-driven вызова —
 * выделения текста/медиа-интервала): когда он задан, прокидывается скрытым
 * полем; без него поле пустое → бек создаёт аннотацию без привязки.
 */
export function AnnotationCreateForm({ parentEntityType, parentId, anchor, onSuccess }: Props) {
  const router = useRouter();
  const t = useT("annotations");
  const [blocks, setBlocks] = useState<AstBlock[]>([]);
  const [state, action] = useActionState(createAnnotation, initial);

  useEffect(() => {
    if (state.success && state.data?.id) {
      // Сначала закрыть модалку (если задан колбэк), затем перерисовать
      // страницу со свежим списком.
      onSuccess?.();
      router.refresh();
    }
  }, [state, router, onSuccess]);

  return (
    <Form action={action} errors={errors(state)}>
      <Stack>
        <input type="hidden" name={f("parent_entity_type")} value={parentEntityType} />
        <input type="hidden" name={f("parent_entity_id")} value={parentId} />
        <input type="hidden" name={f("blocks")} value={JSON.stringify(blocks)} />
        {anchor !== undefined && (
          <input type="hidden" name={f("anchor")} value={JSON.stringify(anchor)} />
        )}
        <IdempotencyField result={state} />

        <Field name="blocks" label={t("createBodyLabel")} required>
          <LazyAstEditor
            defaultValue={[]}
            entityContext="annotation"
            onChange={(next: AstBlock[]) => { setBlocks(next); }}
            ariaLabel={t("createBodyAriaLabel")}
          />
        </Field>

        <AnnotationVisibilityField />

        <FormFeedback result={state} forbiddenAction={t("createForbiddenAction")} />

        <div>
          <SubmitButton>{t("createSubmit")}</SubmitButton>
        </div>
      </Stack>
    </Form>
  );
}
