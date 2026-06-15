"use client";
// src/features/comments/ui/comment-reply-form.tsx
import { useActionState, useState } from "react";

import { AstEditor, type AstBlock } from "@/components/ast-editor";
import { Button, Form, FormField, IdempotencyField, Select, SubmitButton } from "@/components/ui";
import type { ActionResult } from "@/utils/create-action";

import { createComment } from "../actions";
import type { Comment, CommentType } from "../types";

import { commentTypeLabel } from "./comment-type-badge";

const initial: ActionResult<Comment | null> = { success: true, data: null };

interface Props {
  lectureId: string;
  parentId: string;
  /** Типы, допустимые как ответ на родителя (schema.allowed_children[parentType]). */
  childTypes: CommentType[];
}

export function CommentReplyForm({ lectureId, parentId, childTypes }: Props) {
  const [open, setOpen] = useState(false);
  const [blocks, setBlocks] = useState<AstBlock[]>([]);
  const [state, action] = useActionState(createComment, initial);
  const fieldErrors: Record<string, string> =
    !state.success && state.code === "validation" ? state.fieldErrors : {};

  if (childTypes.length === 0) return null;
  if (!open) {
    return (
      <Button type="button" variant="ghost" onClick={() => { setOpen(true); }}>
        Ответить
      </Button>
    );
  }

  const options = childTypes.map((t) => ({ value: t, label: commentTypeLabel(t) }));

  return (
    <Form action={action} errors={fieldErrors} className="mt-2 flex flex-col gap-2 border-l border-(--color-border) pl-3">
      <input type="hidden" name="lecture_id" value={lectureId} />
      <input type="hidden" name="parent_id" value={parentId} />
      <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />
      <IdempotencyField result={state} />

      <FormField name="type" label="Тип ответа" required>
        <Select name="type" options={options} defaultValue={childTypes[0] ?? ""} aria-label="Тип ответа" />
      </FormField>

      <FormField name="blocks" label="Текст ответа">
        <AstEditor
          entityContext="comment"
          defaultLectureId={lectureId}
          onChange={(next: AstBlock[]) => { setBlocks(next); }}
          ariaLabel="Текст ответа"
        />
      </FormField>

      {!state.success && state.code === "forbidden" && (
        <p className="text-sm text-red-600">У вас нет прав на ответ.</p>
      )}
      {!state.success && !state.code && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      <div className="flex gap-2">
        <SubmitButton>Ответить</SubmitButton>
        <Button type="button" variant="ghost" onClick={() => { setOpen(false); }}>
          Отмена
        </Button>
      </div>
    </Form>
  );
}
