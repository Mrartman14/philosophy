// src/features/canvas/ui/canvas-detail.tsx
import { canvasDataToRenderData } from "../editor/render-map";
import type { CanvasData } from "../types";

import { CanvasViewer } from "./canvas-viewer";

interface Props {
  data: CanvasData | undefined;
}

/** Read-only визуализация графа канваса (интерактив/ i18n ведёт CanvasViewer).
 *  Единая точка для /canvases/[id] и модалки ревизий. */
export function CanvasDetail({ data }: Props) {
  return (
    <CanvasViewer
      data={canvasDataToRenderData(data)}
      className="rounded border border-(--color-border) bg-(--color-surface) p-2"
    />
  );
}
