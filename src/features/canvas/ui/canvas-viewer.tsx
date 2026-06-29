"use client";
// src/features/canvas/ui/canvas-viewer.tsx
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { FitIcon } from "@/assets/icons/fit-icon";
import { ZoomInIcon } from "@/assets/icons/zoom-in-icon";
import { ZoomOutIcon } from "@/assets/icons/zoom-out-icon";
import { boundingBox, CanvasScene, CANVAS_MARGIN, type RenderData } from "@/components/canvas-render";
import { Button, IconButton } from "@/components/ui";
import { useT } from "@/i18n/client";

import { applyZoomAtPoint, centerViewport, fitViewport, usePanZoom, type Viewport } from "../editor";
import { makeEntityRefResolver } from "../entity-ref";

interface Props {
  data: RenderData;
  className?: string;
  children?: ReactNode;
}

// Шаг зума кнопкой тулбара — крупнее одного «щелчка» колеса (комфортнее кликом).
const BTN_ZOOM_IN = 1.4;
const BTN_ZOOM_OUT = 1 / 1.4;

/**
 * Read-only интерактивный просмотр канваса: pan/zoom поверх SSR-рендера.
 * До замера контейнера рендерит статичную ветку, идентичную CanvasRender
 * (SSR/no-JS фолбэк, без mismatch при гидрации); после — управляет viewBox из
 * стейта через общий usePanZoom. i18n/ссылки резолвит сам (как редактор).
 */
export function CanvasViewer({ data, className, children }: Props) {
  const t = useT("canvas");
  const tCommon = useT("common");
  const resolveEntityRef = useMemo(() => makeEntityRefResolver(t), [t]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [viewport, setViewport] = useState<Viewport | null>(null);

  const hasNodes = data.nodes.length > 0;

  // Замер контейнера на клиенте → переход в интерактив; fit при первом замере.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || !hasNodes) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (!r || r.width <= 0 || r.height <= 0) return;
      const s = { width: r.width, height: r.height };
      setSize(s);
      setViewport((prev) => prev ?? fitViewport(boundingBox(data.nodes), s));
    });
    ro.observe(el);
    return () => { ro.disconnect(); };
  }, [data.nodes, hasNodes]);

  const interactive = size !== null && viewport !== null;

  usePanZoom(containerRef, {
    viewport,
    onViewportChange: setViewport,
    enablePanDrag: true,
    disabled: !interactive,
  });

  const zoomAtCenter = useCallback((factor: number) => {
    if (!size || !viewport) return;
    setViewport(applyZoomAtPoint(viewport, factor, size.width / 2, size.height / 2));
  }, [size, viewport]);

  const onFit = useCallback(() => {
    if (!size) return;
    setViewport(fitViewport(boundingBox(data.nodes), size));
  }, [size, data.nodes]);

  const onResetZoom = useCallback(() => {
    if (!size || !viewport) return;
    const center = {
      x: viewport.x + size.width / 2 / viewport.zoom,
      y: viewport.y + size.height / 2 / viewport.zoom,
    };
    setViewport(centerViewport(center, size, 1));
  }, [size, viewport]);

  if (!hasNodes) {
    return <p className="text-sm text-(--color-fg-muted)">{tCommon("canvasRender.emptyGraph")}</p>;
  }

  const bbox = boundingBox(data.nodes);
  const staticW = bbox.maxX - bbox.minX + CANVAS_MARGIN * 2;
  const staticH = bbox.maxY - bbox.minY + CANVAS_MARGIN * 2;
  const staticViewBox = `${bbox.minX - CANVAS_MARGIN} ${bbox.minY - CANVAS_MARGIN} ${staticW} ${staticH}`;

  const viewBox =
    interactive
      ? `${viewport.x} ${viewport.y} ${size.width / viewport.zoom} ${size.height / viewport.zoom}`
      : staticViewBox;

  return (
    <div
      ref={containerRef}
      className={className}
      style={
        interactive
          ? { position: "relative", overflow: "hidden", touchAction: "none", cursor: "grab", height: "min(70vh, 640px)", minHeight: "320px" }
          : { overflow: "auto", maxWidth: "100%" }
      }
    >
      <CanvasScene
        data={data}
        resolveEntityRef={resolveEntityRef}
        viewBox={viewBox}
        width={interactive ? "100%" : staticW}
        height={interactive ? "100%" : staticH}
        ariaLabel={tCommon("canvasRender.graphAriaLabel")}
        svgStyle={interactive ? { display: "block" } : { maxWidth: "100%", height: "auto" }}
      />

      {interactive && (
        <div
          className="absolute bottom-2 end-2 flex items-center gap-1 rounded border border-(--color-border) bg-(--color-surface) p-1"
          style={{ pointerEvents: "auto" }}
        >
          <IconButton type="button" compact aria-label={t("viewer.zoomOut")} onClick={() => { zoomAtCenter(BTN_ZOOM_OUT); }}>
            <span className="inline-flex text-lg"><ZoomOutIcon /></span>
          </IconButton>
          <Button type="button" tone="quiet" compact aria-label={t("viewer.resetZoom")} onClick={onResetZoom}>
            <span className="text-xs tabular-nums">{Math.round(viewport.zoom * 100)}%</span>
          </Button>
          <IconButton type="button" compact aria-label={t("viewer.zoomIn")} onClick={() => { zoomAtCenter(BTN_ZOOM_IN); }}>
            <span className="inline-flex text-lg"><ZoomInIcon /></span>
          </IconButton>
          <IconButton type="button" compact aria-label={t("toolbar.fit")} onClick={onFit}>
            <span className="inline-flex text-lg"><FitIcon /></span>
          </IconButton>
        </div>
      )}
      {children}
    </div>
  );
}
