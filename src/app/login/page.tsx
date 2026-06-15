import { redirect } from "next/navigation";

import { RouterLink } from "@/components/ui";
import { LoginForm, safeNextPath } from "@/features/auth";
import { ForcedLogoutCleanup } from "@/services/offline/forced-logout-cleanup";
import { getMe } from "@/utils/me";

export const metadata = { title: "Войти" };

interface PageProps {
  searchParams: Promise<{ next?: string; registered?: string; blocked?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { next: rawNext, registered, blocked } = await searchParams;
  const next = safeNextPath(rawNext);

  // Уже залогинен — сразу на target.
  const me = await getMe();
  if (me) redirect(next);

  const registerHref =
    next === "/" ? "/register" : `/register?next=${encodeURIComponent(next)}`;

  return (
    <div className="flex flex-col items-center gap-6 py-12">
      <h1 className="text-2xl font-semibold">Войти</h1>
      {blocked === "1" && (
        <>
          <p role="status" className="text-sm text-red-600">
            Ваш аккаунт заблокирован. Обратитесь в поддержку.
          </p>
          <ForcedLogoutCleanup />
        </>
      )}
      {registered === "1" && (
        <p role="status" className="text-sm text-green-600">
          Регистрация прошла успешно. Войдите с вашим логином и паролем.
        </p>
      )}
      <LoginForm next={next} />
      <p className="text-sm text-(--color-description)">
        Нет аккаунта?{" "}
        <RouterLink href={registerHref} className="underline">
          Зарегистрируйтесь
        </RouterLink>
      </p>
    </div>
  );
}
