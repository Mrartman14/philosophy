"use client";
// src/features/annotations/ui/annotation-create-form.tsx
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import type { AstBlock } from "@/components/ast-editor";
import { LazyAstEditor } from "@/components/ast-editor/lazy-ast-editor";
import { Form, FormFeedback, FormField, IdempotencyField, Stack, SubmitButton } from "@/components/ui";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { createAnnotation } from "../actions";
import type { Annotation, ParentEntityType } from "../types";

import { AnnotationVisibilityField } from "./annotation-visibility-field";

const initial: ActionResult<Annotation | null> = { success: true, data: null };

interface Props {
  parentEntityType: ParentEntityType;
  parentId: string;
}

/**
 * Форма создания аннотации. AST-тело (entityContext="annotation") + выбор
 * видимости (фиксируется навсегда). Должна быть смонтирована внутри
 * <SchemaContextProvider> родителем (AstEditor требует useSchema).
 * Якорь в MVP не задаётся из UI (текстовое выделение — отдельная фича); поле
 * anchor остаётся пустым → бек создаёт аннотацию без привязки.
 */
export function AnnotationCreateForm({ parentEntityType, parentId }: Props) {
  const router = useRouter();
  const t = useT("annotations");
  const [blocks, setBlocks] = useState<AstBlock[]>([]);
  const [state, action] = useActionState(createAnnotation, initial);

  const fieldErrors: Record<string, string> =
    !state.success && state.code === "validation"
      ? state.fieldErrors
      : {};

  useEffect(() => {
    if (state.success && state.data?.id) {
      // Перерисовать страницу со свежим списком.
      router.refresh();
    }
  }, [state, router]);

  return (
    <Form action={action} errors={fieldErrors}>
      <Stack>
        <input type="hidden" name="parent_entity_type" value={parentEntityType} />
        <input type="hidden" name="parent_entity_id" value={parentId} />
        <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />
        <IdempotencyField result={state} />

        <FormField name="blocks" label={t("createBodyLabel")}>
          <LazyAstEditor
            defaultValue={[]}
            entityContext="annotation"
            onChange={(next: AstBlock[]) => { setBlocks(next); }}
            ariaLabel={t("createBodyAriaLabel")}
          />
        </FormField>

        <AnnotationVisibilityField />

        <FormFeedback result={state} forbiddenAction={t("createForbiddenAction")} />

        <div>
          <SubmitButton>{t("createSubmit")}</SubmitButton>
        </div>
      </Stack>
    </Form>
  );
}
