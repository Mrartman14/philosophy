"use client";
// src/features/comments/ui/comment-reply-form.tsx
import { useActionState, useState } from "react";

import type { AstBlock } from "@/components/ast-editor";
import { Button, Form, FormFeedback, FormField, IdempotencyField, Select, SubmitButton } from "@/components/ui";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { createComment } from "../actions";
import type { Comment, CommentType } from "../types";

import { LazyAstEditor } from "./lazy-ast-editor";

const initial: ActionResult<Comment | null> = { success: true, data: null };

interface Props {
  lectureId: string;
  parentId: string;
  /** Типы, допустимые как ответ на родителя (schema.allowed_children[parentType]). */
  childTypes: CommentType[];
}

export function CommentReplyForm({ lectureId, parentId, childTypes }: Props) {
  const t = useT("comments");
  const [open, setOpen] = useState(false);
  const [blocks, setBlocks] = useState<AstBlock[]>([]);
  const [state, action] = useActionState(createComment, initial);
  const fieldErrors: Record<string, string> =
    !state.success && state.code === "validation" ? state.fieldErrors : {};

  if (childTypes.length === 0) return null;
  if (!open) {
    return (
      <Button type="button" variant="ghost" onClick={() => { setOpen(true); }}>
        {t("replyButton")}
      </Button>
    );
  }

  const options = childTypes.map((type) => ({ value: type, label: t(`type.${type}`) }));

  return (
    <Form action={action} errors={fieldErrors} className="mt-2 flex flex-col gap-2 border-l border-(--color-border) pl-3">
      <input type="hidden" name="lecture_id" value={lectureId} />
      <input type="hidden" name="parent_id" value={parentId} />
      <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />
      <IdempotencyField result={state} />

      <FormField name="type" label={t("replyTypeLabel")} required>
        <Select name="type" options={options} defaultValue={childTypes[0] ?? ""} aria-label={t("replyTypeAriaLabel")} />
      </FormField>

      <FormField name="blocks" label={t("replyBodyLabel")}>
        <LazyAstEditor
          entityContext="comment"
          defaultLectureId={lectureId}
          onChange={(next: AstBlock[]) => { setBlocks(next); }}
          ariaLabel={t("replyBodyAriaLabel")}
        />
      </FormField>

      <FormFeedback result={state} forbiddenAction={t("replyForbiddenAction")} />

      <div className="flex gap-2">
        <SubmitButton>{t("replySubmit")}</SubmitButton>
        <Button type="button" variant="ghost" onClick={() => { setOpen(false); }}>
          {t("replyCancel")}
        </Button>
      </div>
    </Form>
  );
}
