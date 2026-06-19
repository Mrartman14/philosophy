// src/features/auth/ui/login-form.tsx
"use client";
import { useActionState } from "react";

import {
  Form,
  FormField,
  SubmitButton,
  TextInput,
} from "@/components/ui";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { loginAction } from "../actions";

const initial: ActionResult<undefined> = { success: true, data: undefined };

interface LoginFormProps {
  next: string;
}

export function LoginForm({ next }: LoginFormProps) {
  const t = useT("auth");
  const [state, action] = useActionState(loginAction, initial);
  const fieldErrors: Record<string, string> =
    !state.success && state.code === "validation"
      ? state.fieldErrors
      : {};

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
    <Form action={action} errors={fieldErrors} className="max-w-sm">
      <input type="hidden" name="next" value={next} />
      <FormField name="username" label={t("login.usernameLabel")} required>
        <TextInput name="username" required autoComplete="username" />
      </FormField>
      <FormField name="password" label={t("login.passwordLabel")} required>
        <TextInput
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
      </FormField>

      {genericError && <p className="text-sm text-red-600">{genericError}</p>}

      <div>
        <SubmitButton>{t("login.submit")}</SubmitButton>
      </div>
    </Form>
  );
}
