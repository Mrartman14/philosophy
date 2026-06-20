// src/features/semantic-map/ui/map-state-panel.tsx
// Server-компонент: состояние карты «строится»/«ошибка» (когда getMap вернул !ok).
import { getT } from "@/i18n";

export async function MapStatePanel({ reason }: { reason: "building" | "error" }) {
  const t = await getT("semanticMap");
  return (
    <div className="flex h-full w-full items-center justify-center p-6 text-center text-sm text-(--color-fg-muted)">
      {t(reason === "building" ? "building" : "loadError")}
    </div>
  );
}
