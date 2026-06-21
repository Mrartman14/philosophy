"use client";
// src/features/comments/ui/comment-create-form.tsx
import { useActionState, useState } from "react";

import type { AstBlock } from "@/components/ast-editor";
import { Form, FormFeedback, FormField, IdempotencyField, Select, Stack, SubmitButton } from "@/components/ui";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { createComment } from "../actions";
import type { Comment, CommentType } from "../types";

import { LazyAstEditor } from "./lazy-ast-editor";

const initial: ActionResult<Comment | null> = { success: true, data: null };

interface Props {
  lectureId: string;
  /** Типы, допустимые как корень (schema.allowed_roots). */
  rootTypes: CommentType[];
}

export function CommentCreateForm({ lectureId, rootTypes }: Props) {
  const t = useT("comments");
  const [blocks, setBlocks] = useState<AstBlock[]>([]);
  const [state, action] = useActionState(createComment, initial);
  const fieldErrors: Record<string, string> =
    !state.success && state.code === "validation" ? state.fieldErrors : {};

  const options = rootTypes.map((type) => ({ value: type, label: t(`type.${type}`) }));

  return (
    <Form action={action} errors={fieldErrors}>
      <Stack>
        <input type="hidden" name="lecture_id" value={lectureId} />
        <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />
        <IdempotencyField result={state} />

        <FormField name="type" label={t("createTypeLabel")} required>
          <Select name="type" options={options} defaultValue={rootTypes[0] ?? ""} aria-label={t("createTypeAriaLabel")} />
        </FormField>

        <FormField name="blocks" label={t("createBodyLabel")}>
          <LazyAstEditor
            entityContext="comment"
            defaultLectureId={lectureId}
            onChange={(next: AstBlock[]) => { setBlocks(next); }}
            ariaLabel={t("createBodyAriaLabel")}
          />
        </FormField>

        {state.success && state.data && (
          <p className="text-sm text-(--color-fg-muted)">{t("createSuccess")}</p>
        )}
        <FormFeedback result={state} forbiddenAction={t("createForbiddenAction")} />

        <div>
          <SubmitButton>{t("createSubmit")}</SubmitButton>
        </div>
      </Stack>
    </Form>
  );
}
