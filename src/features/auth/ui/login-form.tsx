// src/features/auth/ui/login-form.tsx
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

import { loginAction } from "../actions";
import type { LoginFormInput } from "../schemas";

const initial: ActionResult<undefined> = { success: true, data: undefined };

const { Field, f, errors } = createTypedForm<LoginFormInput>();

interface LoginFormProps {
  next: string;
}

export function LoginForm({ next }: LoginFormProps) {
  const t = useT("auth");
  const [state, action] = useActionState(loginAction, initial);

  const ERROR_TEXT: Record<string, string> = {
    invalid_credentials: t("login.errors.invalid_credentials"),
    account_blocked: t("login.errors.account_blocked"),
    service_unavailable: t("login.errors.service_unavailable"),
  };

  const genericError =
    !state.success && !state.code
      ? ERROR_TEXT[state.error] ?? t("login.fallbackError")
      : null;

  return (
    <Form action={action} errors={errors(state)}>
      <Stack className="max-w-sm">
        <input type="hidden" name={f("next")} value={next} />
        <Field name="username" label={t("login.usernameLabel")} required>
          <TextInput required autoComplete="username" />
        </Field>
        <Field name="password" label={t("login.passwordLabel")} required>
          <TextInput
            type="password"
            required
            autoComplete="current-password"
          />
        </Field>

        {genericError && <p className="text-sm text-red-600">{genericError}</p>}

        <div>
          <SubmitButton>{t("login.submit")}</SubmitButton>
        </div>
      </Stack>
    </Form>
  );
}
