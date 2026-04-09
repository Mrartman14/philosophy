"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createPublicApiClient } from "@/api/client";
import { createFormAction } from "@/utils/create-action";

/**
 * Server action для логина.
 *
 * Вызывается через `useActionState(login, initialState)` из клиентской формы.
 * Сохраняет JWT в httpOnly cookie `token` и редиректит на главную.
 */
export const login = createFormAction<void>(async (formData: FormData) => {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    throw new Error("Введите имя пользователя и пароль");
  }

  const client = createPublicApiClient();
  const { data, error } = await client.POST("/api/auth/login", {
    body: { username, password },
  });

  if (error || !data?.data?.token) {
    throw new Error("Неверное имя пользователя или пароль");
  }

  const cookieStore = await cookies();
  cookieStore.set("token", data.data.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 часа
    path: "/",
  });

  redirect("/");
});

/**
 * Server action для регистрации. После успеха редиректит на /login.
 */
export const register = createFormAction<void>(async (formData: FormData) => {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    throw new Error("Введите имя пользователя и пароль");
  }

  const client = createPublicApiClient();
  const { error } = await client.POST("/api/auth/register", {
    body: { username, password },
  });

  if (error) {
    throw new Error("Не удалось зарегистрировать пользователя");
  }

  redirect("/login");
});

/**
 * Logout — удаляет cookie с токеном и возвращает пользователя на главную.
 *
 * Не оборачивается в `createFormAction`: ошибок обрабатывать не нужно,
 * форма в хедере просто сабмитит эту функцию.
 */
export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete("token");
  redirect("/");
}
