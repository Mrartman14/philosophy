"use client";
import { useActionState } from "react";

import {
  createTypedForm,
  Form,
  FormFeedback,
  IdempotencyField,
  Stack,
  SubmitButton,
  TextInput,
} from "@/components/ui";
import { useActionRedirect } from "@/hooks/use-action-redirect";
import { useT } from "@/i18n/client";
import { initialActionState } from "@/utils/action-state";

import { createTerm } from "../actions";
import type { TermCreateFormInput } from "../schemas";
import type { Term } from "../types";

const initial = initialActionState<Term | null>(null);

const { Field, errors } = createTypedForm<TermCreateFormInput>();

export function GlossaryCreateForm() {
  const t = useT("glossary");
  const [state, action] = useActionState(createTerm, initial);

  useActionRedirect(state, (data) => `/admin/glossary/${data.id}/edit`);

  return (
    <Form action={action} errors={errors(state)}>
      <Stack className="max-w-xl">
        <IdempotencyField result={state} />
        <Field name="title" label={t("titleLabel")} required>
          <TextInput aria-required maxLength={300} placeholder={t("titlePlaceholder")} />
        </Field>

        <FormFeedback result={state} forbiddenAction={t("createTermAction")} />

        <div>
          <SubmitButton>{t("createButton")}</SubmitButton>
        </div>
      </Stack>
    </Form>
  );
}
