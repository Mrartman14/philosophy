// src/features/semantic-map/ui/map-state-panel.tsx
// Адаптер: тянет namespace semanticMap и прокидывает label-props в общий SceneStatePanel.
import { SceneStatePanel } from "@/components/scene-3d";
import { getT } from "@/i18n";

export async function MapStatePanel({ reason }: { reason: "building" | "error" }) {
  const t = await getT("semanticMap");
  return <SceneStatePanel reason={reason} buildingText={t("building")} errorText={t("loadError")} />;
}
