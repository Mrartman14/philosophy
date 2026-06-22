"use client";
// src/features/comments/ui/comment-reply-form.tsx
import { useActionState, useState } from "react";

import type { AstBlock } from "@/components/ast-editor";
import { Button, createTypedForm, Form, FormFeedback, IdempotencyField, Select, Stack, SubmitButton } from "@/components/ui";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { createComment } from "../actions";
import type { CommentCreateFormInput } from "../schemas";
import type { Comment, CommentType } from "../types";

import { LazyAstEditor } from "./lazy-ast-editor";

const initial: ActionResult<Comment | null> = { success: true, data: null };

const { Field, f, errors } = createTypedForm<CommentCreateFormInput>();

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

  if (childTypes.length === 0) return null;
  if (!open) {
    return (
      <Button type="button" tone="quiet" onClick={() => { setOpen(true); }}>
        {t("replyButton")}
      </Button>
    );
  }

  const options = childTypes.map((type) => ({ value: type, label: t(`type.${type}`) }));

  return (
    <Form action={action} errors={errors(state)}>
      <Stack className="mt-2 border-l border-(--color-border) pl-3">
        {/* lecture_id — path-параметр (action читает из FormData → POST
            /api/lectures/{id}/comments), это НЕ body-поле схемы. Raw-строка
            name здесь КОРРЕКТНА — не «чинить» добавлением в CommentCreateSchema. */}
        <input type="hidden" name="lecture_id" value={lectureId} />
        <input type="hidden" name={f("parent_id")} value={parentId} />
        <input type="hidden" name={f("blocks")} value={JSON.stringify(blocks)} />
        <IdempotencyField result={state} />

        <Field name="type" label={t("replyTypeLabel")} required>
          <Select options={options} defaultValue={childTypes[0] ?? ""} aria-label={t("replyTypeAriaLabel")} />
        </Field>

        <Field name="blocks" label={t("replyBodyLabel")} required>
          <LazyAstEditor
            entityContext="comment"
            defaultLectureId={lectureId}
            onChange={(next: AstBlock[]) => { setBlocks(next); }}
            ariaLabel={t("replyBodyAriaLabel")}
          />
        </Field>

        <FormFeedback result={state} forbiddenAction={t("replyForbiddenAction")} />

        <div className="flex gap-2">
          <SubmitButton>{t("replySubmit")}</SubmitButton>
          <Button type="button" tone="quiet" onClick={() => { setOpen(false); }}>
            {t("replyCancel")}
          </Button>
        </div>
      </Stack>
    </Form>
  );
}
