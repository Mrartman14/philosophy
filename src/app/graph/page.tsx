// src/app/graph/page.tsx
// Публичная (optional-auth) страница графа связности корпуса. Зеркало app/map/page.tsx
// без search-overlay (вне объёма, спека §38): getGraph() → SceneStatePanel при не-ok, иначе Graph.
import { SceneStatePanel } from "@/components/scene-3d";
import { getGraph, Graph } from "@/features/reference-graph";
import { getT } from "@/i18n";

export async function generateMetadata() {
  const t = await getT("pages");
  return { title: t("graphTitle") };
}

export default async function GraphPage() {
  const result = await getGraph();
  const t = await getT("referenceGraph");
  if (!result.ok) {
    return (
      <main className="h-[80vh] w-full">
        <SceneStatePanel
          reason={result.reason}
          buildingText={t("building")}
          errorText={t("loadError")}
        />
      </main>
    );
  }
  return (
    <main className="h-[80vh] w-full">
      <Graph data={result.graph} />
    </main>
  );
}
