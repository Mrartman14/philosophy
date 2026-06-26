// src/components/anchor-engine/use-anchor-highlights.ts
// Подсветка через HighlightController: persistentIds держатся в основном канале,
// activeId — в active-канале. enabled=false → всё гасится. Eager-политика
// (аннотации) передаёт persistentIds = все; lazy-политика (комментарии) — [] или
// все (по глобальному тоглу), activeId = hovered/clicked.
import { useEffect } from "react";

import type { HighlightController } from "./highlight-controller";

export function useAnchorHighlights({
  controller,
  ranges,
  persistentIds,
  activeId,
  enabled,
}: {
  controller: HighlightController;
  ranges: Map<string, Range | null>;
  persistentIds: string[];
  activeId: string | null;
  enabled: boolean;
}) {
  // Стабильный ключ набора, чтобы эффект не зависел от идентичности массива.
  const idsKey = persistentIds.join(",");
  useEffect(() => {
    if (!enabled) {
      controller.clear();
      return;
    }
    const persistent = persistentIds
      .map((id) => ranges.get(id) ?? null)
      .filter((r): r is Range => r !== null);
    controller.apply(persistent);
    controller.setActive(activeId ? (ranges.get(activeId) ?? null) : null);
    return () => {
      controller.clear();
    };
    // idsKey покрывает persistentIds по значению.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ranges, enabled, activeId, controller, idsKey]);
}
