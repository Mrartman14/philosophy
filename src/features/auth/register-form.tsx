"use client";

import Link from "next/link";
import { useActionState } from "react";

import { register } from "./actions";
import type { ActionResult } from "@/utils/create-action";

// `register` по сигнатуре принимает `prevState: ActionResult<void>`, но по
// общему соглашению проекта `initialState` у `useActionState` — `null`
// (см. P1-#19). Runtime safe: server action не читает `_prevState`.
type RegisterAction = (
  prevState: ActionResult<void> | null,
  formData: FormData,
) => Promise<ActionResult<void>>;

export const RegisterForm: React.FC = () => {
  const [state, formAction, pending] = useActionState<
    ActionResult<void> | null,
    FormData
  >(register as RegisterAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-4 w-full max-w-sm">
      <h1 className="text-2xl font-bold">Регистрация</h1>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-(--color-description)">Имя пользователя</span>
        <input
          type="text"
          name="username"
          required
          minLength={3}
          autoComplete="username"
          className="px-3 py-2 rounded border border-(--color-border) bg-(--color-background) focus:outline-none focus:border-(--color-primary)"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-(--color-description)">Пароль</span>
        <input
          type="password"
          name="password"
          required
          minLength={6}
          autoComplete="new-password"
          className="px-3 py-2 rounded border border-(--color-border) bg-(--color-background) focus:outline-none focus:border-(--color-primary)"
        />
      </label>

      {state?.success === false && (
        <p className="text-sm text-red-500" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="px-4 py-2 rounded bg-(--color-primary) text-(--color-background) font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? "Регистрируем..." : "Зарегистрироваться"}
      </button>

      <p className="text-sm text-(--color-description) text-center">
        Уже есть аккаунт?{" "}
        <Link href="/login" className="text-(--color-primary) hover:underline">
          Войти
        </Link>
      </p>
    </form>
  );
};
