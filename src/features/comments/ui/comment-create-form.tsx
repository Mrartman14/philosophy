"use client";
// src/features/comments/ui/comment-create-form.tsx
import { useActionState, useState } from "react";

import type { AstBlock } from "@/components/ast-editor";
import { createTypedForm, Form, FormFeedback, IdempotencyField, Select, Stack, SubmitButton } from "@/components/ui";
import { useT } from "@/i18n/client";
import { initialActionState } from "@/utils/action-state";

import { createComment } from "../actions";
import type { CommentCreateFormInput } from "../schemas";
import type { Comment, CommentType } from "../types";

import { LazyAstEditor } from "./lazy-ast-editor";

const initial = initialActionState<Comment | null>(null);

const { Field, f, errors } = createTypedForm<CommentCreateFormInput>();

interface Props {
  lectureId: string;
  /** Типы, допустимые как корень (schema.allowed_roots). */
  rootTypes: CommentType[];
}

export function CommentCreateForm({ lectureId, rootTypes }: Props) {
  const t = useT("comments");
  const [blocks, setBlocks] = useState<AstBlock[]>([]);
  const [state, action] = useActionState(createComment, initial);

  const options = rootTypes.map((type) => ({ value: type, label: t(`type.${type}`) }));

  return (
    <Form action={action} errors={errors(state)}>
      <Stack>
        {/* lecture_id — path-параметр (action читает его из FormData и шлёт в
            POST /api/lectures/{id}/comments), это НЕ body-поле схемы. Raw-строка
            name здесь КОРРЕКТНА — не «чинить» добавлением в CommentCreateSchema. */}
        <input type="hidden" name="lecture_id" value={lectureId} />
        <input type="hidden" name={f("blocks")} value={JSON.stringify(blocks)} />
        <IdempotencyField result={state} />

        <Field name="type" label={t("createTypeLabel")} required>
          <Select options={options} defaultValue={rootTypes[0] ?? ""} aria-label={t("createTypeAriaLabel")} />
        </Field>

        <Field name="blocks" label={t("createBodyLabel")} required>
          <LazyAstEditor
            entityContext="comment"
            defaultLectureId={lectureId}
            onChange={(next: AstBlock[]) => { setBlocks(next); }}
            ariaLabel={t("createBodyAriaLabel")}
          />
        </Field>

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
