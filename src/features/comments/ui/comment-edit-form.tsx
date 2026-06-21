"use client";
// src/features/comments/ui/comment-edit-form.tsx
import { useActionState, useState } from "react";

import type { AstBlock } from "@/components/ast-editor";
import { Button, Form, FormFeedback, FormField, IdempotencyField, Stack, SubmitButton } from "@/components/ui";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { updateCommentBlocks } from "../actions";
import type { Comment } from "../types";

import { LazyAstEditor } from "./lazy-ast-editor";

const initial: ActionResult<Comment | null> = { success: true, data: null };

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
  const fieldErrors: Record<string, string> =
    !state.success && state.code === "validation" ? state.fieldErrors : {};

  if (!open) {
    return (
      <Button type="button" tone="quiet" onClick={() => { setOpen(true); }}>
        {t("editButton")}
      </Button>
    );
  }

  return (
    <Form action={action} errors={fieldErrors}>
      <Stack className="mt-2">
        <input type="hidden" name="id" value={commentId} />
        <input type="hidden" name="version" value={version ?? ""} />
        <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />
        <IdempotencyField result={state} />
        <FormField name="blocks" label={t("editBodyLabel")}>
          <LazyAstEditor
            defaultValue={initialBlocks}
            entityContext="comment"
            defaultLectureId={lectureId}
            onChange={(next: AstBlock[]) => { setBlocks(next); }}
            ariaLabel={t("editBodyAriaLabel")}
          />
        </FormField>
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
