// src/app/me/page.tsx
import type { Metadata } from "next";

import { getT } from "@/i18n";
import { requireUserOrRedirect } from "@/utils/me";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("pages");
  return { title: t("meTitle") };
}

export default async function MePage() {
  const me = await requireUserOrRedirect("/me");
  const t = await getT("pages");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-2 p-6">
      <h1 className="text-2xl font-bold">{me.username}</h1>
      <p className="text-sm text-(--color-fg-muted)">{t("meHint")}</p>
    </div>
  );
}
