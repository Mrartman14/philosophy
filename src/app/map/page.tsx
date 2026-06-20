// src/app/map/page.tsx
import { getMap, SemanticMap } from "@/features/semantic-map";

export const metadata = {
  // i18n: заголовок вынести при интеграции
  title: "Карта смыслов",
};

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ n?: string }>;
}) {
  const sp = await searchParams;
  const parsed = sp.n ? parseInt(sp.n, 10) : NaN;
  const count = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 200000) : undefined;
  const data = await getMap(count);

  return (
    <main className="h-[80vh] w-full">
      <SemanticMap data={data} />
    </main>
  );
}
