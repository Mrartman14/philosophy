// src/components/canvas-render/canvas-render.tsx
import { getT } from "@/i18n";

import { CanvasScene, staticViewBox } from "./canvas-scene";
import { boundingBox } from "./geometry";
import type { CanvasRenderProps } from "./types";

/**
 * Generic read-only SSR-рендер canvas-графа. Координаты узлов заданы извне.
 * Статичный viewBox по bounding box; тело — общий CanvasScene. Интерактив (pan/zoom)
 * — отдельный CanvasViewer.
 */
export async function CanvasRender({ data, resolveEntityRef, emptyText, className, children }: CanvasRenderProps) {
  const t = await getT("common");
  const resolvedEmptyText = emptyText ?? t("canvasRender.emptyGraph");

  if (data.nodes.length === 0) {
    return <p className="text-sm text-(--color-fg-muted)">{resolvedEmptyText}</p>;
  }

  const { viewBox, width, height } = staticViewBox(boundingBox(data.nodes));

  return (
    <div className={className} style={{ overflow: "auto", maxWidth: "100%" }}>
      <CanvasScene
        data={data}
        resolveEntityRef={resolveEntityRef}
        viewBox={viewBox}
        width={width}
        height={height}
        ariaLabel={t("canvasRender.graphAriaLabel")}
        svgStyle={{ maxWidth: "100%", height: "auto" }}
      />
      {children}
    </div>
  );
}
