"use client";
import { useActionState } from "react";

import {
  createTypedForm,
  Form,
  FormFeedback,
  Stack,
  SubmitButton,
  TextInput,
  Textarea,
  VersionField,
} from "@/components/ui";
import { useT } from "@/i18n/client";
import { initialActionState } from "@/utils/action-state";

import { updateLecture } from "../actions";
import type { LectureUpdateFormInput } from "../schemas";
import type { Lecture } from "../types";

import { LectureDeleteButton } from "./lecture-delete-button";
import { LectureVisibilityToggle } from "./lecture-visibility-toggle";

const initial = initialActionState<Lecture | null>(null);

const { Field, f, errors } = createTypedForm<LectureUpdateFormInput>();

interface Props {
  lecture: Lecture;
  canSetVisibility: boolean;
  canDelete: boolean;
}

export function LectureEditForm({ lecture, canSetVisibility, canDelete }: Props) {
  const tL = useT("lectures");
  const [state, action] = useActionState(updateLecture, initial);

  // exactOptionalPropertyTypes: successText передаём только при успешном сохранении,
  // иначе свойство опускаем (нельзя передать undefined).
  const successText =
    state.success && state.data ? { successText: tL("savedMessage") } : {};

  return (
    <div className="flex flex-col gap-6">
      <Form action={action} errors={errors(state)}>
        <Stack className="max-w-xl">
          <input type="hidden" name={f("id")} value={lecture.id} />
          <VersionField version={lecture.version} />

          <Field name="title" label={tL("titleLabel")} required>
            <TextInput name="title" required maxLength={200} defaultValue={lecture.title} />
          </Field>

          <Field name="date" label={tL("dateLabel")} required description={tL("dateDescription")}>
            <TextInput name="date" required defaultValue={lecture.date} />
          </Field>

          <Field name="description" label={tL("descriptionLabel")}>
            <Textarea
              name="description"
              rows={6}
              maxLength={5000}
              defaultValue={lecture.description}
            />
          </Field>

          <FormFeedback
            result={state}
            forbiddenAction={tL("editForbiddenAction")}
            {...successText}
          />

          <div>
            <SubmitButton>{tL("saveButton")}</SubmitButton>
          </div>
        </Stack>
      </Form>

      {canSetVisibility && (
        <div className="max-w-xs border-t border-(--color-border) pt-4">
          <LectureVisibilityToggle lecture={lecture} />
        </div>
      )}

      {canDelete && (
        <div className="border-t border-(--color-border) pt-4">
          <LectureDeleteButton lectureId={lecture.id} redirectTo="/admin/lectures" />
        </div>
      )}
    </div>
  );
}
