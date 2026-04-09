"use client";

import Link from "next/link";
import { useActionState } from "react";

import { login } from "./actions";
import type { ActionResult } from "@/utils/create-action";

interface LoginFormProps {
  /** Куда вернуть пользователя после успешного логина. */
  next?: string;
}

const initialState: ActionResult<void> = { success: false, error: "" };

export const LoginForm: React.FC<LoginFormProps> = ({ next }) => {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4 w-full max-w-sm">
      <h1 className="text-2xl font-bold">Вход</h1>

      {next && <input type="hidden" name="next" value={next} />}

      <label className="flex flex-col gap-1">
        <span className="text-sm text-(--color-description)">Имя пользователя</span>
        <input
          type="text"
          name="username"
          required
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
          autoComplete="current-password"
          className="px-3 py-2 rounded border border-(--color-border) bg-(--color-background) focus:outline-none focus:border-(--color-primary)"
        />
      </label>

      {state.success === false && state.error && (
        <p className="text-sm text-red-500" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="px-4 py-2 rounded bg-(--color-primary) text-(--color-background) font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? "Входим..." : "Войти"}
      </button>

      <p className="text-sm text-(--color-description) text-center">
        Нет аккаунта?{" "}
        <Link
          href={
            next
              ? `/register?next=${encodeURIComponent(next)}`
              : "/register"
          }
          className="text-(--color-primary) hover:underline"
        >
          Зарегистрироваться
        </Link>
      </p>
    </form>
  );
};
