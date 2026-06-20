"use client";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import {
  Form,
  FormFeedback,
  FormField,
  IdempotencyField,
  Select,
  SubmitButton,
  TextInput,
  Textarea,
} from "@/components/ui";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { createLecture } from "../actions";
import type { Lecture } from "../types";

const initial: ActionResult<Lecture | null> = { success: true, data: null };

export function LectureCreateForm() {
  const tL = useT("lectures");
  const router = useRouter();
  const [state, action] = useActionState(createLecture, initial);
  const fieldErrors: Record<string, string> =
    !state.success && state.code === "validation" ? state.fieldErrors : {};

  useEffect(() => {
    if (state.success && state.data) {
      router.push(`/admin/lectures/${state.data.id}/edit`);
    }
  }, [state, router]);

  return (
    <Form action={action} errors={fieldErrors} className="max-w-xl">
      <IdempotencyField result={state} />
      <FormField name="title" label={tL("titleLabel")} required>
        <TextInput name="title" required maxLength={200} />
      </FormField>

      <FormField name="date" label={tL("dateLabel")} required description={tL("dateDescription")}>
        <TextInput name="date" required placeholder="2026-04-27" />
      </FormField>

      <FormField name="description" label={tL("descriptionLabel")}>
        <Textarea name="description" rows={6} maxLength={5000} />
      </FormField>

      <FormField name="visibility" label={tL("visibilityLabel")}>
        <Select
          name="visibility"
          defaultValue="private"
          options={[
            { value: "private", label: tL("visibilityPrivate") },
            { value: "public", label: tL("visibilityPublic") },
          ]}
        />
      </FormField>

      <FormFeedback result={state} forbiddenAction={tL("createAction")} />

      <div>
        <SubmitButton>{tL("createButton")}</SubmitButton>
      </div>
    </Form>
  );
}
