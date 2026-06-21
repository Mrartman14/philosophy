"use client";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import {
  Form,
  FormField,
  FormFeedback,
  IdempotencyField,
  SubmitButton,
  TextInput,
} from "@/components/ui";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { createTerm } from "../actions";
import type { Term } from "../types";

const initial: ActionResult<Term | null> = { success: true, data: null };

export function GlossaryCreateForm() {
  const router = useRouter();
  const t = useT("glossary");
  const [state, action] = useActionState(createTerm, initial);
  const fieldErrors: Record<string, string> =
    !state.success && state.code === "validation"
      ? state.fieldErrors
      : {};

  useEffect(() => {
    if (state.success && state.data?.id) {
      router.push(`/admin/glossary/${state.data.id}/edit`);
    }
  }, [state, router]);

  return (
    <Form action={action} errors={fieldErrors} className="flex flex-col gap-4 max-w-xl">
      <IdempotencyField result={state} />
      <FormField name="title" label={t("titleLabel")} required>
        <TextInput name="title" required maxLength={300} placeholder={t("titlePlaceholder")} />
      </FormField>

      <FormFeedback result={state} forbiddenAction={t("createTermAction")} />

      <div>
        <SubmitButton>{t("createButton")}</SubmitButton>
      </div>
    </Form>
  );
}
