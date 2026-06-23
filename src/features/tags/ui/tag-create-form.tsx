// src/features/tags/ui/tag-create-form.tsx
"use client";
import { useActionState } from "react";

import { createTypedForm, Form, FormFeedback, IdempotencyField, Stack, SubmitButton, TextInput } from "@/components/ui";
import { useT } from "@/i18n/client";
import { initialActionState } from "@/utils/action-state";

import { createTag } from "../actions";
import type { TagCreateFormInput } from "../schemas";
import type { Tag } from "../types";

const initial = initialActionState<Tag | null>(null);

const { Field, errors } = createTypedForm<TagCreateFormInput>();

export function TagCreateForm() {
  const [state, action] = useActionState(createTag, initial);
  const tTags = useT("tags");

  // exactOptionalPropertyTypes: successText подставляем только при успехе с данными.
  const successText =
    state.success && state.data
      ? { successText: tTags("tagCreated", { name: state.data.name }) }
      : {};

  return (
    <Form action={action} errors={errors(state)}>
      <Stack className="max-w-xl">
        <IdempotencyField result={state} />
        <Field name="name" label={tTags("newTagLabel")} required>
          <TextInput aria-required maxLength={100} placeholder={tTags("namePlaceholder")} />
        </Field>

        <FormFeedback
          result={state}
          forbiddenAction={tTags("createTagAction")}
          {...successText}
        />

        <div>
          <SubmitButton>{tTags("createButton")}</SubmitButton>
        </div>
      </Stack>
    </Form>
  );
}
