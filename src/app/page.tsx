import type { Metadata } from "next";

import { getT } from "@/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("pages");
  return { title: t("homeTitle") };
}

export default async function HomePage() {
  const t = await getT("pages");
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <h1 className="text-3xl font-bold">{t("homeTitle")}</h1>
      <p className="text-(--color-fg-muted)">
        {t("homeComingSoon")}
      </p>
    </div>
  );
}
