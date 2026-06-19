import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { RouterLink } from "@/components/ui";
import { LoginForm, safeNextPath } from "@/features/auth";
import { getT } from "@/i18n";
import { ForcedLogoutCleanup } from "@/services/offline/forced-logout-cleanup";
import { getMe } from "@/utils/me";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("pages");
  return { title: t("loginTitle") };
}

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

  const t = await getT("pages");

  return (
    <div className="flex flex-col items-center gap-6 py-12">
      <h1 className="text-2xl font-semibold">{t("loginHeading")}</h1>
      {blocked === "1" && (
        <>
          <p role="status" className="text-sm text-red-600">
            {t("loginBanned")}
          </p>
          <ForcedLogoutCleanup />
        </>
      )}
      {registered === "1" && (
        <p role="status" className="text-sm text-green-600">
          {t("loginRegistered")}
        </p>
      )}
      <LoginForm next={next} />
      <p className="text-sm text-(--color-fg-muted)">
        {t("loginNoAccount")}{" "}
        <RouterLink href={registerHref} className="underline">
          {t("loginRegisterLink")}
        </RouterLink>
      </p>
    </div>
  );
}
