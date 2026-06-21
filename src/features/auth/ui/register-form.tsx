// src/features/auth/ui/register-form.tsx
"use client";
import { useActionState } from "react";

import {
  Form,
  FormField,
  Stack,
  SubmitButton,
  TextInput,
} from "@/components/ui";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { registerAction } from "../actions";

const initial: ActionResult<undefined> = { success: true, data: undefined };

interface RegisterFormProps {
  next: string;
}

export function RegisterForm({ next }: RegisterFormProps) {
  const t = useT("auth");
  const [state, action] = useActionState(registerAction, initial);
  const fieldErrors: Record<string, string> =
    !state.success && state.code === "validation"
      ? state.fieldErrors
      : {};

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
    <Form action={action} errors={fieldErrors}>
      <Stack className="max-w-sm">
        <input type="hidden" name="next" value={next} />
        <FormField name="username" label={t("register.usernameLabel")} required>
          <TextInput name="username" required autoComplete="username" />
        </FormField>
        <FormField name="password" label={t("register.passwordLabel")} required>
          <TextInput
            name="password"
            type="password"
            required
            autoComplete="new-password"
          />
        </FormField>
        <FormField name="password_confirm" label={t("register.passwordConfirmLabel")} required>
          <TextInput
            name="password_confirm"
            type="password"
            required
            autoComplete="new-password"
          />
        </FormField>

        {genericError && <p className="text-sm text-red-600">{genericError}</p>}

        <div>
          <SubmitButton>{t("register.submit")}</SubmitButton>
        </div>
      </Stack>
    </Form>
  );
}
