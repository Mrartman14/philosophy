// src/features/auth/ui/register-form.tsx
"use client";
import { useActionState } from "react";
import {
  Form,
  FormField,
  SubmitButton,
  TextInput,
} from "@/components/ui";
import type { ActionResult } from "@/utils/create-action";
import { registerAction } from "../actions";

const initial: ActionResult = { success: true, data: undefined };

const ERROR_TEXT: Record<string, string> = {
  username_taken: "Это имя пользователя уже занято.",
  invalid_input: "Проверьте правильность заполнения полей.",
  too_many_requests: "Слишком много попыток. Попробуйте позже.",
  service_unavailable: "Сервис временно недоступен. Попробуйте позже.",
};

interface RegisterFormProps {
  next: string;
}

export function RegisterForm({ next }: RegisterFormProps) {
  const [state, action] = useActionState(registerAction, initial);
  const fieldErrors: Record<string, string> =
    !state.success && state.code === "validation"
      ? state.fieldErrors
      : {};

  const genericError =
    !state.success && !state.code
      ? ERROR_TEXT[state.error] ?? "Не удалось зарегистрироваться."
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
          autoComplete="new-password"
        />
      </FormField>
      <FormField name="password_confirm" label="Повторите пароль" required>
        <TextInput
          name="password_confirm"
          type="password"
          required
          autoComplete="new-password"
        />
      </FormField>

      {genericError && <p className="text-sm text-red-600">{genericError}</p>}

      <div>
        <SubmitButton>Зарегистрироваться</SubmitButton>
      </div>
    </Form>
  );
}
