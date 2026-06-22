// src/features/auth/ui/register-form.tsx
"use client";
import { useActionState } from "react";

import {
  createTypedForm,
  Form,
  Stack,
  SubmitButton,
  TextInput,
} from "@/components/ui";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { registerAction } from "../actions";
import type { RegisterFormInput } from "../schemas";

const initial: ActionResult<undefined> = { success: true, data: undefined };

const { Field, f, errors } = createTypedForm<RegisterFormInput>();

interface RegisterFormProps {
  next: string;
}

export function RegisterForm({ next }: RegisterFormProps) {
  const t = useT("auth");
  const [state, action] = useActionState(registerAction, initial);

  const ERROR_TEXT: Record<string, string> = {
    username_taken: t("register.errors.username_taken"),
    invalid_input: t("register.errors.invalid_input"),
    too_many_requests: t("register.errors.too_many_requests"),
    service_unavailable: t("register.errors.service_unavailable"),
  };

  const genericError =
    !state.success && !state.code
      ? ERROR_TEXT[state.error] ?? t("register.fallbackError")
      : null;

  return (
    <Form action={action} errors={errors(state)}>
      <Stack className="max-w-sm">
        <input type="hidden" name={f("next")} value={next} />
        <Field name="username" label={t("register.usernameLabel")} required>
          <TextInput required autoComplete="username" />
        </Field>
        <Field name="password" label={t("register.passwordLabel")} required>
          <TextInput
            type="password"
            required
            autoComplete="new-password"
          />
        </Field>
        <Field name="password_confirm" label={t("register.passwordConfirmLabel")} required>
          <TextInput
            type="password"
            required
            autoComplete="new-password"
          />
        </Field>

        {genericError && <p role="alert" className="text-sm text-(--color-danger)">{genericError}</p>}

        <div>
          <SubmitButton>{t("register.submit")}</SubmitButton>
        </div>
      </Stack>
    </Form>
  );
}
