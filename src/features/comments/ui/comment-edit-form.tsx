"use client";
// src/features/comments/ui/comment-edit-form.tsx
import { useActionState, useState } from "react";

import { AstEditor, type AstBlock } from "@/components/ast-editor";
import { Button, Form, FormField, IdempotencyField, SubmitButton } from "@/components/ui";
import type { ActionResult } from "@/utils/create-action";

import { updateCommentBlocks } from "../actions";
import type { Comment } from "../types";

const initial: ActionResult<Comment | null> = { success: true, data: null };

interface Props {
  commentId: string;
  lectureId: string;
  initialBlocks: AstBlock[];
}

export function CommentEditForm({ commentId, lectureId, initialBlocks }: Props) {
  const [open, setOpen] = useState(false);
  const [blocks, setBlocks] = useState<AstBlock[]>(initialBlocks);
  const [state, action] = useActionState(updateCommentBlocks, initial);
  const fieldErrors: Record<string, string> =
    !state.success && state.code === "validation" ? state.fieldErrors : {};

  if (!open) {
    return (
      <Button type="button" variant="ghost" onClick={() => { setOpen(true); }}>
        Редактировать
      </Button>
    );
  }

  return (
    <Form action={action} errors={fieldErrors} className="mt-2 flex flex-col gap-2">
      <input type="hidden" name="id" value={commentId} />
      <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />
      <IdempotencyField result={state} />
      <FormField name="blocks" label="Текст">
        <AstEditor
          defaultValue={initialBlocks}
          entityContext="comment"
          defaultLectureId={lectureId}
          onChange={(next: AstBlock[]) => { setBlocks(next); }}
          ariaLabel="Редактирование комментария"
        />
      </FormField>
      {state.success && state.data && (
        <p className="text-sm text-(--color-description)">Сохранено.</p>
      )}
      {!state.success && state.code === "forbidden" && (
        <p className="text-sm text-red-600">У вас нет прав на изменение комментария.</p>
      )}
      {!state.success && !state.code && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      <div className="flex gap-2">
        <SubmitButton>Сохранить</SubmitButton>
        <Button type="button" variant="ghost" onClick={() => { setOpen(false); }}>
          Отмена
        </Button>
      </div>
    </Form>
  );
}
