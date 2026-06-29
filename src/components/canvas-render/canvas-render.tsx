// src/components/canvas-render/canvas-render.tsx
import { getT } from "@/i18n";

import { CanvasScene, CANVAS_MARGIN } from "./canvas-scene";
import { boundingBox } from "./geometry";
import type { CanvasRenderProps } from "./types";

/**
 * Generic read-only SSR-рендер canvas-графа. Координаты узлов заданы извне
 * (бек уже посчитал layout). Рисует <svg> со статичным viewBox по bounding box;
 * тело графа — общий CanvasScene. Без интерактива (pan/zoom) — внешняя обёртка
 * скроллит при необходимости (overflow:auto). Интерактивный вариант — CanvasViewer.
 */
export async function CanvasRender({ data, resolveEntityRef, emptyText, className, children }: CanvasRenderProps) {
  const t = await getT("common");
  const resolvedEmptyText = emptyText ?? t("canvasRender.emptyGraph");

  if (data.nodes.length === 0) {
    return <p className="text-sm text-(--color-fg-muted)">{resolvedEmptyText}</p>;
  }

  const bbox = boundingBox(data.nodes);
  const vbX = bbox.minX - CANVAS_MARGIN;
  const vbY = bbox.minY - CANVAS_MARGIN;
  const vbW = bbox.maxX - bbox.minX + CANVAS_MARGIN * 2;
  const vbH = bbox.maxY - bbox.minY + CANVAS_MARGIN * 2;

  return (
    <div className={className} style={{ overflow: "auto", maxWidth: "100%" }}>
      <CanvasScene
        data={data}
        resolveEntityRef={resolveEntityRef}
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        width={vbW}
        height={vbH}
        ariaLabel={t("canvasRender.graphAriaLabel")}
        svgStyle={{ maxWidth: "100%", height: "auto" }}
      />
      {children}
    </div>
  );
}
