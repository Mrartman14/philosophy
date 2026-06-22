"use client";
import { useActionState } from "react";

import {
  createTypedForm,
  Form,
  Stack,
  SubmitButton,
  TextInput,
  Textarea,
} from "@/components/ui";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { updateLecture } from "../actions";
import type { LectureUpdateFormInput } from "../schemas";
import type { Lecture } from "../types";

import { LectureDeleteButton } from "./lecture-delete-button";
import { LectureVisibilityToggle } from "./lecture-visibility-toggle";

const initial: ActionResult<Lecture | null> = { success: true, data: null };

const { Field, f, errors } = createTypedForm<LectureUpdateFormInput>();

interface Props {
  lecture: Lecture;
  canSetVisibility: boolean;
  canDelete: boolean;
}

export function LectureEditForm({ lecture, canSetVisibility, canDelete }: Props) {
  const tL = useT("lectures");
  const tErrors = useT("errors");
  const [state, action] = useActionState(updateLecture, initial);

  return (
    <div className="flex flex-col gap-6">
      <Form action={action} errors={errors(state)}>
        <Stack className="max-w-xl">
          <input type="hidden" name={f("id")} value={lecture.id} />
          <input type="hidden" name="version" value={String(lecture.version ?? "")} />

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

          {!state.success && state.code === "forbidden" && (
            <p className="text-sm text-red-600">
              {tErrors("forbiddenAction", { action: tL("editForbiddenAction") })}
            </p>
          )}
          {!state.success && !state.code && (
            <p className="text-sm text-red-600">{state.error}</p>
          )}
          {state.success && state.data && (
            <p className="text-sm text-green-600">{tL("savedMessage")}</p>
          )}

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
