// src/app/map/page.tsx
import { getMap, SemanticMap } from "@/features/semantic-map";
import { getT } from "@/i18n";

export async function generateMetadata() {
  const t = await getT("pages");
  return { title: t("mapTitle") };
}

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
