// src/app/graph/page.tsx
// Публичная (optional-auth) страница графа связности корпуса. Зеркало app/map/page.tsx
// без search-overlay (вне объёма, спека §38): getGraph() → SceneStatePanel при не-ok, иначе Graph.
import { SceneStatePanel, parseView } from "@/components/scene-3d";
import { FullBleed } from "@/components/ui";
import { getGraph, Graph } from "@/features/reference-graph";
import { getT } from "@/i18n";

export async function generateMetadata() {
  const t = await getT("pages");
  return { title: t("graphTitle") };
}

export default async function GraphPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; c?: string }>;
}) {
  const sp = await searchParams;
  const initialView = parseView(sp);
  const result = await getGraph();
  const t = await getT("referenceGraph");
  if (!result.ok) {
    return (
      <FullBleed>
        <div className="h-[80vh] w-full">
          <SceneStatePanel
            reason={result.reason}
            buildingText={t("building")}
            errorText={t("loadError")}
          />
        </div>
      </FullBleed>
    );
  }
  return (
    <FullBleed>
      <div className="h-[80vh] w-full">
        <Graph data={result.graph} initialView={initialView} />
      </div>
    </FullBleed>
  );
}
