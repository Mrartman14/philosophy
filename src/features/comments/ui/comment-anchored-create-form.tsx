"use client";
// src/features/comments/ui/comment-anchored-create-form.tsx
// Форма создания заякоренного комментария из выделения (selection-driven). Тип +
// AST-тело + скрытый anchor (JSON, уже с target_entity_*). На успех закрывает
// модалку (onSuccess) и обновляет страницу (router.refresh) — заякоренный
// комментарий появляется в нижнем треде, подсветка становится доступной.
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import type { AstBlock } from "@/components/ast-editor";
import { createTypedForm, Form, FormFeedback, IdempotencyField, Select, Stack, SubmitButton } from "@/components/ui";
import { useT } from "@/i18n/client";
import { initialActionState } from "@/utils/action-state";

import { createComment } from "../actions";
import type { CommentCreateFormInput } from "../schemas";
import type { Anchor, Comment, CommentType } from "../types";

import { LazyAstEditor } from "./lazy-ast-editor";

const initial = initialActionState<Comment | null>(null);
const { Field, f, errors } = createTypedForm<CommentCreateFormInput>();

interface Props {
  lectureId: string;
  rootTypes: CommentType[];
  anchor: Anchor;
  onSuccess: () => void;
}

export function CommentAnchoredCreateForm({ lectureId, rootTypes, anchor, onSuccess }: Props) {
  const router = useRouter();
  const t = useT("comments");
  const [blocks, setBlocks] = useState<AstBlock[]>([]);
  const [state, action] = useActionState(createComment, initial);

  const options = rootTypes.map((type) => ({ value: type, label: t(`type.${type}`) }));

  useEffect(() => {
    if (state.success && state.data) {
      onSuccess();
      router.refresh();
    }
  }, [state, router, onSuccess]);

  return (
    <Form action={action} errors={errors(state)}>
      <Stack>
        {/* lecture_id — path-параметр (action читает из FormData), не body-поле схемы. */}
        <input type="hidden" name="lecture_id" value={lectureId} />
        <input type="hidden" name={f("blocks")} value={JSON.stringify(blocks)} />
        <input type="hidden" name={f("anchor")} value={JSON.stringify(anchor)} />
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

        <FormFeedback result={state} forbiddenAction={t("createForbiddenAction")} />
        <div>
          <SubmitButton>{t("createSubmit")}</SubmitButton>
        </div>
      </Stack>
    </Form>
  );
}
