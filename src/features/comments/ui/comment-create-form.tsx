"use client";
// src/features/comments/ui/comment-create-form.tsx
import { useActionState, useState } from "react";
import { Form, FormField, Select, SubmitButton } from "@/components/ui";
import { AstEditor, type AstBlock } from "@/components/ast-editor";
import type { ActionResult } from "@/utils/create-action";
import { createComment } from "../actions";
import { commentTypeLabel } from "./comment-type-badge";
import type { Comment, CommentType } from "../types";

const initial: ActionResult<Comment | null> = { success: true, data: null };

interface Props {
  lectureId: string;
  /** Типы, допустимые как корень (schema.allowed_roots). */
  rootTypes: CommentType[];
}

export function CommentCreateForm({ lectureId, rootTypes }: Props) {
  const [blocks, setBlocks] = useState<AstBlock[]>([]);
  const [state, action] = useActionState(createComment, initial);
  const fieldErrors: Record<string, string> =
    state.success === false && state.code === "validation" ? state.fieldErrors : {};

  const options = rootTypes.map((t) => ({ value: t, label: commentTypeLabel(t) }));

  return (
    <Form action={action} errors={fieldErrors} className="flex flex-col gap-3">
      <input type="hidden" name="lecture_id" value={lectureId} />
      <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />

      <FormField name="type" label="Тип комментария" required>
        <Select name="type" options={options} defaultValue={rootTypes[0] ?? ""} aria-label="Тип комментария" />
      </FormField>

      <FormField name="blocks" label="Текст">
        <AstEditor
          entityContext="comment"
          defaultLectureId={lectureId}
          onChange={(next: AstBlock[]) => setBlocks(next)}
          ariaLabel="Текст комментария"
        />
      </FormField>

      {state.success && state.data && (
        <p className="text-sm text-(--color-description)">Комментарий добавлен.</p>
      )}
      {state.success === false && state.code === "forbidden" && (
        <p className="text-sm text-red-600">У вас нет прав на создание комментария.</p>
      )}
      {state.success === false && !state.code && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      <div>
        <SubmitButton>Отправить</SubmitButton>
      </div>
    </Form>
  );
}
