// src/app/me/stats/page.tsx
import {
  ProductionStatsTable,
  ViewStats,
  getHistorySettings,
  getProductionStats,
  getViewStats,
} from "@/features/statistics";
import { getT } from "@/i18n";
import { requireUserOrRedirect } from "@/utils/me";

export async function generateMetadata() {
  const t = await getT("pages");
  return { title: t("myStatsTitle") };
}

export default async function MyStatsPage() {
  await requireUserOrRedirect("/me/stats");

  const [inventory, viewStats, settings] = await Promise.all([
    getProductionStats(),
    getViewStats(),
    getHistorySettings(),
  ]);

  const t = await getT("pages");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-4">
      <h1 className="text-2xl font-bold">{t("myStatsHeading")}</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("myStatsCreated")}</h2>
        <ProductionStatsTable inventory={inventory} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("myStatsViews")}</h2>
        <ViewStats
          stats={viewStats}
          trackingEnabled={settings.tracking_enabled ?? false}
        />
      </section>
    </div>
  );
}
