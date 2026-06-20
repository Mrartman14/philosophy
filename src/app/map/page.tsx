// src/app/map/page.tsx
import { getSearchResults } from "@/features/search";
import { getMap, MapStatePanel, SemanticMap, type MapOverlay } from "@/features/semantic-map";
import { getT } from "@/i18n";

export async function generateMetadata() {
  const t = await getT("pages");
  return { title: t("mapTitle") };
}

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim();

  const result = await getMap();
  if (!result.ok) {
    return (
      <main className="h-[80vh] w-full">
        <MapStatePanel reason={result.reason} />
      </main>
    );
  }

  let overlay: MapOverlay | undefined;
  if (q) {
    try {
      const search = await getSearchResults({ q });
      overlay = {
        query: q,
        hits: search.items.flatMap((h) =>
          h.entity_id && h.type ? [{ id: h.entity_id, type: h.type, score: h.score ?? 0 }] : [],
        ),
      };
    } catch {
      overlay = { query: q, hits: [] }; // поиск недоступен — карта без overlay
    }
  }

  return (
    <main className="h-[80vh] w-full">
      <SemanticMap data={result.map} {...(overlay !== undefined ? { overlay } : {})} />
    </main>
  );
}
