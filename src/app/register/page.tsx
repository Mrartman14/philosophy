// src/app/register/page.tsx
import { redirect } from "next/navigation";

import { RouterLink } from "@/components/ui";
import { RegisterForm, safeNextPath } from "@/features/auth";
import { getMe } from "@/utils/me";

export const metadata = { title: "Регистрация" };

interface PageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function RegisterPage({ searchParams }: PageProps) {
  const { next: rawNext } = await searchParams;
  const next = safeNextPath(rawNext);

  // Уже залогинен — сразу на target.
  const me = await getMe();
  if (me) redirect(next);

  const loginHref =
    next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`;

  return (
    <div className="flex flex-col items-center gap-6 py-12">
      <h1 className="text-2xl font-semibold">Регистрация</h1>
      <RegisterForm next={next} />
      <p className="text-sm text-(--color-fg-muted)">
        Уже есть аккаунт?{" "}
        <RouterLink href={loginHref} className="underline">
          Войдите
        </RouterLink>
      </p>
    </div>
  );
}
