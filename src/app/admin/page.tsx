// src/app/admin/page.tsx
import type { Metadata } from "next";

import { getT } from "@/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("admin");
  return { title: t("dashboardMetaTitle") };
}

export default async function AdminDashboardPage() {
  const t = await getT("admin");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{t("dashboardTitle")}</h1>
      <p className="text-sm text-(--color-fg-muted)">
        {t("dashboardSubtitle")}
      </p>
    </div>
  );
}
