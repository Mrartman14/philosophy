// src/app/map/page.tsx
import { getMap, MapStatePanel, SemanticMap } from "@/features/semantic-map";
import { getT } from "@/i18n";

export async function generateMetadata() {
  const t = await getT("pages");
  return { title: t("mapTitle") };
}

export default async function MapPage() {
  const result = await getMap();

  return (
    <main className="h-[80vh] w-full">
      {result.ok ? <SemanticMap data={result.map} /> : <MapStatePanel reason={result.reason} />}
    </main>
  );
}
