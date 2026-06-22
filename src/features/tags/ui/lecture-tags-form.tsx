// src/features/tags/ui/lecture-tags-form.tsx
"use client";
import { useActionState, useState } from "react";

import { Checkbox, Form, FormFeedback, Label, Stack, SubmitButton } from "@/components/ui";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { setLectureTags } from "../actions";
import type { Tag } from "../types";

const initial: ActionResult<Tag[] | null> = { success: true, data: null };

interface Props {
  lectureId: string;
  /** Полный список тегов (из публичного GET /api/tags, до 100). */
  allTags: Tag[];
  /** id тегов, уже назначенных лекции. */
  assignedTagIds: number[];
}

/**
 * Назначение тегов лекции. Чекбоксы — controlled state; в форму уходит
 * hidden input tag_ids=JSON.stringify(selected), потому что parseFormData
 * не поддерживает multi-value поля. Пустой выбор валиден (снять все теги).
 */
export function LectureTagsForm({ lectureId, allTags, assignedTagIds }: Props) {
  const [selected, setSelected] = useState<number[]>(assignedTagIds);
  const [state, action] = useActionState(setLectureTags, initial);
  const tTags = useT("tags");
  const fieldErrors: Record<string, string> =
    !state.success && state.code === "validation"
      ? state.fieldErrors
      : {};

  // exactOptionalPropertyTypes: successText подставляем только при успехе с данными.
  const successText =
    state.success && state.data ? { successText: tTags("tagsSaved") } : {};

  const options = allTags.filter(
    (t): t is Tag & { id: number } => typeof t.id === "number",
  );

  function toggle(id: number, checked: boolean) {
    setSelected((prev) =>
      checked ? [...prev, id] : prev.filter((x) => x !== id),
    );
  }

  if (options.length === 0) {
    return (
      <p className="text-sm text-(--color-fg-muted)">
        {tTags("noTagsHint")}
      </p>
    );
  }

  return (
    <Form action={action} errors={fieldErrors}>
      <Stack>
        <input type="hidden" name="lecture_id" value={lectureId} />
        <input type="hidden" name="tag_ids" value={JSON.stringify(selected)} />

        <ul className="flex flex-wrap gap-x-4 gap-y-2">
          {options.map((tag) => (
            <li key={tag.id} className="flex items-center gap-2">
              <Checkbox
                id={`lecture-tag-${tag.id}`}
                checked={selected.includes(tag.id)}
                onCheckedChange={(checked) => { toggle(tag.id, checked); }}
                aria-label={tag.name}
              />
              <Label htmlFor={`lecture-tag-${tag.id}`}>
                <span className="cursor-pointer">{tag.name}</span>
              </Label>
            </li>
          ))}
        </ul>

        {!state.success && state.code === "validation" ? (
          // Чекбоксы вне <Field>, поэтому ошибки tag_ids/lecture_id рисуем вручную —
          // FormFeedback на validation покажет только _form и потеряет их.
          <p role="alert" className="text-sm text-(--color-danger)">
            {fieldErrors.tag_ids ?? fieldErrors.lecture_id ?? fieldErrors._form}
          </p>
        ) : (
          <FormFeedback
            result={state}
            forbiddenAction={tTags("assignTagsAction")}
            {...successText}
          />
        )}

        <div>
          <SubmitButton>{tTags("saveTags")}</SubmitButton>
        </div>
      </Stack>
    </Form>
  );
}
