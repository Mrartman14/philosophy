// src/app/me/stats/page.tsx
import { redirect } from "next/navigation";

import {
  ProductionStatsTable,
  ViewStats,
  getHistorySettings,
  getProductionStats,
  getViewStats,
} from "@/features/statistics";
import { getMe } from "@/utils/me";

export const metadata = { title: "Моя статистика" };

export default async function MyStatsPage() {
  const me = await getMe();
  if (!me) redirect("/login?next=/me/stats");

  const [inventory, viewStats, settings] = await Promise.all([
    getProductionStats(),
    getViewStats(),
    getHistorySettings(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-4">
      <h1 className="text-2xl font-bold">Моя статистика</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Что я создал</h2>
        <ProductionStatsTable inventory={inventory} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Мои просмотры</h2>
        <ViewStats
          stats={viewStats}
          trackingEnabled={settings.tracking_enabled ?? false}
        />
      </section>
    </div>
  );
}
