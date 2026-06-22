// src/features/semantic-map/overlay/match-overlay.ts
// Чистый матч оверлея поиска с точками карты.
// Карта после chunk-shift: точка = чанк документа; point.id — id строки эмбеддинга,
// а point.doc — id родительского документа. Хиты поиска несут id ДОКУМЕНТОВ/глоссария,
// поэтому матчим по doc, а в highlightIds кладём point.id (рендерер подсвечивает по нему).
import type { MapOverlay, RenderModel } from "../types";

import { weightedCentroid } from "./weighted-centroid";

export interface OverlayMatch {
  /** point.id совпавших чанков (рендерер подсвечивает точку по её id). */
  highlightIds: Set<string>;
  /** score-взвешенный центроид совпавших точек — маркер «центр результатов». */
  marker: [number, number, number] | null;
  /** число совпавших точек-чанков. */
  count: number;
}

export function matchOverlay(model: RenderModel, overlay: MapOverlay): OverlayMatch {
  // h.id — id документа/глоссария; score документа применяется ко всем его чанкам.
  const score = new Map(overlay.hits.map((h) => [h.id, h.score]));
  const highlightIds = new Set<string>();
  const items: { pos: [number, number, number]; weight: number }[] = [];
  for (let i = 0; i < model.ids.length; i++) {
    const doc = model.docs[i] ?? "";
    const w = score.get(doc);
    if (w === undefined) continue;
    highlightIds.add(model.ids[i] ?? "");
    items.push({
      pos: [
        model.positions[i * 3] ?? 0,
        model.positions[i * 3 + 1] ?? 0,
        model.positions[i * 3 + 2] ?? 0,
      ],
      weight: w,
    });
  }
  return { highlightIds, marker: weightedCentroid(items), count: items.length };
}
