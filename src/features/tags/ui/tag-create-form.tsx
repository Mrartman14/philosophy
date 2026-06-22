// src/features/tags/ui/tag-create-form.tsx
"use client";
import { useActionState } from "react";

import { Form, FormField, IdempotencyField, Stack, SubmitButton, TextInput } from "@/components/ui";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { createTag } from "../actions";
import type { Tag } from "../types";

const initial: ActionResult<Tag | null> = { success: true, data: null };

export function TagCreateForm() {
  const [state, action] = useActionState(createTag, initial);
  const tTags = useT("tags");
  const tErrors = useT("errors");
  const fieldErrors: Record<string, string> =
    !state.success && state.code === "validation"
      ? state.fieldErrors
      : {};

  return (
    <Form action={action} errors={fieldErrors}>
      <Stack className="max-w-xl">
        <IdempotencyField result={state} />
        <FormField name="name" label={tTags("newTagLabel")} required>
          <TextInput required maxLength={100} placeholder={tTags("namePlaceholder")} />
        </FormField>

        {state.success && state.data && (
          <p className="text-sm text-green-600">{tTags("tagCreated", { name: state.data.name })}</p>
        )}
        {!state.success && state.code === "forbidden" && (
          <p className="text-sm text-red-600">
            {tErrors("forbiddenAction", { action: tTags("createTagAction") })}
          </p>
        )}
        {!state.success && !state.code && (
          <p className="text-sm text-red-600">{state.error}</p>
        )}

        <div>
          <SubmitButton>{tTags("createButton")}</SubmitButton>
        </div>
      </Stack>
    </Form>
  );
}
