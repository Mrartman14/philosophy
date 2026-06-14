"use client";
import { useActionState } from "react";

import {
  Form,
  FormField,
  SubmitButton,
  TextInput,
  Textarea,
} from "@/components/ui";
import type { ActionResult } from "@/utils/create-action";

import { updateLecture } from "../actions";
import type { Lecture } from "../types";

import { LectureDeleteButton } from "./lecture-delete-button";
import { LectureVisibilityToggle } from "./lecture-visibility-toggle";

const initial: ActionResult<Lecture | null> = { success: true, data: null };

interface Props {
  lecture: Lecture;
  canSetVisibility: boolean;
  canDelete: boolean;
}

export function LectureEditForm({ lecture, canSetVisibility, canDelete }: Props) {
  const [state, action] = useActionState(updateLecture, initial);
  const fieldErrors: Record<string, string> =
    !state.success && state.code === "validation" ? state.fieldErrors : {};

  return (
    <div className="flex flex-col gap-6">
      <Form action={action} errors={fieldErrors} className="max-w-xl">
        <input type="hidden" name="id" value={lecture.id} />

        <FormField name="title" label="Название" required>
          <TextInput name="title" required maxLength={200} defaultValue={lecture.title} />
        </FormField>

        <FormField name="date" label="Дата" required description="Формат ГГГГ-ММ-ДД">
          <TextInput name="date" required defaultValue={lecture.date} />
        </FormField>

        <FormField name="description" label="Описание">
          <Textarea
            name="description"
            rows={6}
            maxLength={5000}
            defaultValue={lecture.description}
          />
        </FormField>

        {!state.success && state.code === "forbidden" && (
          <p className="text-sm text-red-600">У вас нет прав на редактирование.</p>
        )}
        {!state.success && !state.code && (
          <p className="text-sm text-red-600">{state.error}</p>
        )}
        {state.success && state.data && (
          <p className="text-sm text-green-600">Сохранено.</p>
        )}

        <div>
          <SubmitButton>Сохранить</SubmitButton>
        </div>
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
