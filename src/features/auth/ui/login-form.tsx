// src/features/auth/ui/login-form.tsx
"use client";
import { useActionState } from "react";
import {
  Form,
  FormField,
  SubmitButton,
  TextInput,
} from "@/components/ui";
import type { ActionResult } from "@/utils/create-action";
import { loginAction } from "../actions";

const initial: ActionResult<undefined> = { success: true, data: undefined };

const ERROR_TEXT: Record<string, string> = {
  invalid_credentials: "Неверный логин или пароль.",
  account_blocked: "Аккаунт заблокирован.",
  service_unavailable: "Сервис временно недоступен. Попробуйте позже.",
};

interface LoginFormProps {
  next: string;
}

export function LoginForm({ next }: LoginFormProps) {
  const [state, action] = useActionState(loginAction, initial);
  const fieldErrors: Record<string, string> =
    !state.success && state.code === "validation"
      ? state.fieldErrors
      : {};

  const genericError =
    !state.success && !state.code
      ? ERROR_TEXT[state.error] ?? "Не удалось войти."
      : null;

  return (
    <Form action={action} errors={fieldErrors} className="max-w-sm">
      <input type="hidden" name="next" value={next} />
      <FormField name="username" label="Логин" required>
        <TextInput name="username" required autoComplete="username" />
      </FormField>
      <FormField name="password" label="Пароль" required>
        <TextInput
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
      </FormField>

      {genericError && <p className="text-sm text-red-600">{genericError}</p>}

      <div>
        <SubmitButton>Войти</SubmitButton>
      </div>
    </Form>
  );
}
