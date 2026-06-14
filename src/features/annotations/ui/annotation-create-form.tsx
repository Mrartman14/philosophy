"use client";
// src/features/annotations/ui/annotation-create-form.tsx
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { AstEditor, type AstBlock } from "@/components/ast-editor";
import { Form, FormField, SubmitButton } from "@/components/ui";
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
    <Form action={action} errors={fieldErrors} className="flex flex-col gap-3">
      <input type="hidden" name="parent_entity_type" value={parentEntityType} />
      <input type="hidden" name="parent_entity_id" value={parentId} />
      <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />

      <FormField name="blocks" label="Текст аннотации">
        <AstEditor
          defaultValue={[]}
          entityContext="annotation"
          onChange={(next: AstBlock[]) => { setBlocks(next); }}
          ariaLabel="Текст аннотации"
        />
      </FormField>

      <AnnotationVisibilityField />

      {!state.success && state.code === "forbidden" && (
        <p className="text-sm text-red-600">
          У вас нет прав на создание аннотации.
        </p>
      )}
      {!state.success && !state.code && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      <div>
        <SubmitButton>Добавить аннотацию</SubmitButton>
      </div>
    </Form>
  );
}
