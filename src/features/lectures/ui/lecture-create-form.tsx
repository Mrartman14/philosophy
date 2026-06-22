"use client";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

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
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { createLecture } from "../actions";
import type { LectureCreateFormInput } from "../schemas";
import type { Lecture } from "../types";

const initial: ActionResult<Lecture | null> = { success: true, data: null };

const { Field, errors } = createTypedForm<LectureCreateFormInput>();

export function LectureCreateForm() {
  const tL = useT("lectures");
  const router = useRouter();
  const [state, action] = useActionState(createLecture, initial);

  useEffect(() => {
    if (state.success && state.data) {
      router.push(`/admin/lectures/${state.data.id}/edit`);
    }
  }, [state, router]);

  return (
    <Form action={action} errors={errors(state)}>
      <Stack className="max-w-xl">
        <IdempotencyField result={state} />
        <Field name="title" label={tL("titleLabel")} required>
          <TextInput name="title" required maxLength={200} />
        </Field>

        <Field name="date" label={tL("dateLabel")} required description={tL("dateDescription")}>
          <TextInput name="date" required placeholder="2026-04-27" />
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
