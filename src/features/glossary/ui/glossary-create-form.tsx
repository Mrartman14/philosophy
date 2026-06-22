"use client";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import {
  createTypedForm,
  Form,
  FormFeedback,
  IdempotencyField,
  Stack,
  SubmitButton,
  TextInput,
} from "@/components/ui";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { createTerm } from "../actions";
import type { TermCreateFormInput } from "../schemas";
import type { Term } from "../types";

const initial: ActionResult<Term | null> = { success: true, data: null };

const { Field, errors } = createTypedForm<TermCreateFormInput>();

export function GlossaryCreateForm() {
  const router = useRouter();
  const t = useT("glossary");
  const [state, action] = useActionState(createTerm, initial);

  useEffect(() => {
    if (state.success && state.data?.id) {
      router.push(`/admin/glossary/${state.data.id}/edit`);
    }
  }, [state, router]);

  return (
    <Form action={action} errors={errors(state)}>
      <Stack className="max-w-xl">
        <IdempotencyField result={state} />
        <Field name="title" label={t("titleLabel")} required>
          <TextInput required maxLength={300} placeholder={t("titlePlaceholder")} />
        </Field>

        <FormFeedback result={state} forbiddenAction={t("createTermAction")} />

        <div>
          <SubmitButton>{t("createButton")}</SubmitButton>
        </div>
      </Stack>
    </Form>
  );
}
