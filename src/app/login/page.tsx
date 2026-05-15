import { redirect } from "next/navigation";

import { LoginForm, safeNextPath } from "@/features/auth";
import { getMe } from "@/utils/me";

export const metadata = { title: "Войти" };

interface PageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { next: rawNext } = await searchParams;
  const next = safeNextPath(rawNext);

  // Уже залогинен — сразу на target.
  const me = await getMe();
  if (me) redirect(next);

  return (
    <div className="flex flex-col items-center gap-6 py-12">
      <h1 className="text-2xl font-semibold">Войти</h1>
      <LoginForm next={next} />
    </div>
  );
}
