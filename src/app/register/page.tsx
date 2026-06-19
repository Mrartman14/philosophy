// src/app/register/page.tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { RouterLink } from "@/components/ui";
import { RegisterForm, safeNextPath } from "@/features/auth";
import { getT } from "@/i18n";
import { getMe } from "@/utils/me";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("pages");
  return { title: t("registerTitle") };
}

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

  const t = await getT("pages");

  return (
    <div className="flex flex-col items-center gap-6 py-12">
      <h1 className="text-2xl font-semibold">{t("registerHeading")}</h1>
      <RegisterForm next={next} />
      <p className="text-sm text-(--color-fg-muted)">
        {t("registerHasAccount")}{" "}
        <RouterLink href={loginHref} className="underline">
          {t("registerLoginLink")}
        </RouterLink>
      </p>
    </div>
  );
}
