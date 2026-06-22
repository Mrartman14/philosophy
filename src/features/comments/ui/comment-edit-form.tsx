"use client";
// src/features/comments/ui/comment-edit-form.tsx
import { useActionState, useState } from "react";

import type { AstBlock } from "@/components/ast-editor";
import { Button, createTypedForm, Form, FormFeedback, IdempotencyField, Stack, SubmitButton, VersionField } from "@/components/ui";
import { useT } from "@/i18n/client";
import { initialActionState } from "@/utils/action-state";

import { updateCommentBlocks } from "../actions";
import type { CommentBlocksUpdateFormInput } from "../schemas";
import type { Comment } from "../types";

import { LazyAstEditor } from "./lazy-ast-editor";

const initial = initialActionState<Comment | null>(null);

const { Field, f, errors } = createTypedForm<CommentBlocksUpdateFormInput>();

interface Props {
  commentId: string;
  lectureId: string;
  initialBlocks: AstBlock[];
  /** Версия для optimistic-lock (`comment.version`) → hidden → If-Match. */
  version: number | undefined;
}

export function CommentEditForm({ commentId, lectureId, initialBlocks, version }: Props) {
  const t = useT("comments");
  const [open, setOpen] = useState(false);
  const [blocks, setBlocks] = useState<AstBlock[]>(initialBlocks);
  const [state, action] = useActionState(updateCommentBlocks, initial);

  if (!open) {
    return (
      <Button type="button" tone="quiet" onClick={() => { setOpen(true); }}>
        {t("editButton")}
      </Button>
    );
  }

  return (
    <Form action={action} errors={errors(state)}>
      <Stack className="mt-2">
        <input type="hidden" name={f("id")} value={commentId} />
        {/* version — optimistic-lock (`comment.version`) → action читает из FormData
            и шлёт как If-Match, это НЕ body-поле схемы. */}
        <VersionField version={version} />
        <input type="hidden" name={f("blocks")} value={JSON.stringify(blocks)} />
        <IdempotencyField result={state} />
        <Field name="blocks" label={t("editBodyLabel")} required>
          <LazyAstEditor
            defaultValue={initialBlocks}
            entityContext="comment"
            defaultLectureId={lectureId}
            onChange={(next: AstBlock[]) => { setBlocks(next); }}
            ariaLabel={t("editBodyAriaLabel")}
          />
        </Field>
        {state.success && state.data && (
          <p className="text-sm text-(--color-fg-muted)">{t("editSuccess")}</p>
        )}
        <FormFeedback result={state} forbiddenAction={t("editForbiddenAction")} />
        <div className="flex gap-2">
          <SubmitButton>{t("editSubmit")}</SubmitButton>
          <Button type="button" tone="quiet" onClick={() => { setOpen(false); }}>
            {t("editCancel")}
          </Button>
        </div>
      </Stack>
    </Form>
  );
}
