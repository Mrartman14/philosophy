// src/app/admin/page.tsx
import { getT } from "@/i18n";

export const metadata = { title: "Админ-панель" };

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
