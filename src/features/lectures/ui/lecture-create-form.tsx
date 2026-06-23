"use client";
import { useActionState } from "react";

import {
  createTypedForm,
  Form,
  FormFeedback,
  IdempotencyField,
  Select,
  Stack,
  SubmitButton,
  TextInput,
  Textarea,
} from "@/components/ui";
import { useActionRedirect } from "@/hooks/use-action-redirect";
import { useT } from "@/i18n/client";
import { initialActionState } from "@/utils/action-state";

import { createLecture } from "../actions";
import type { LectureCreateFormInput } from "../schemas";
import type { Lecture } from "../types";

const initial = initialActionState<Lecture | null>(null);

const { Field, errors } = createTypedForm<LectureCreateFormInput>();

export function LectureCreateForm() {
  const tL = useT("lectures");
  const [state, action] = useActionState(createLecture, initial);

  useActionRedirect(state, (data) => `/admin/lectures/${data.id}/edit`);

  return (
    <Form action={action} errors={errors(state)}>
      <Stack className="max-w-xl">
        <IdempotencyField result={state} />
        <Field name="title" label={tL("titleLabel")} required>
          <TextInput name="title" aria-required maxLength={200} />
        </Field>

        <Field name="date" label={tL("dateLabel")} required description={tL("dateDescription")}>
          <TextInput name="date" aria-required placeholder="2026-04-27" />
        </Field>

        <Field name="description" label={tL("descriptionLabel")}>
          <Textarea name="description" rows={6} maxLength={5000} />
        </Field>

        <Field name="visibility" label={tL("visibilityLabel")}>
          <Select
            name="visibility"
            defaultValue="private"
            options={[
              { value: "private", label: tL("visibilityPrivate") },
              { value: "public", label: tL("visibilityPublic") },
            ]}
          />
        </Field>

        <FormFeedback result={state} forbiddenAction={tL("createAction")} />

        <div>
          <SubmitButton>{tL("createButton")}</SubmitButton>
        </div>
      </Stack>
    </Form>
  );
}
