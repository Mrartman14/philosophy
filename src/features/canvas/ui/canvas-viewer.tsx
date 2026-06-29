"use client";
// src/features/canvas/ui/canvas-viewer.tsx
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { FitIcon } from "@/assets/icons/fit-icon";
import { ZoomInIcon } from "@/assets/icons/zoom-in-icon";
import { ZoomOutIcon } from "@/assets/icons/zoom-out-icon";
import { boundingBox, CanvasSceneBody, staticViewBox, type RenderData } from "@/components/canvas-render";
import { Button, IconButton } from "@/components/ui";
import { useT } from "@/i18n/client";

import {
  applyZoomAtPoint, BTN_ZOOM_IN, BTN_ZOOM_OUT, centerViewport, fitViewport,
  screenToWorld, usePanZoom, viewBoxFromViewport, type Viewport,
} from "../editor";
import { makeEntityRefResolver } from "../entity-ref";

interface Props {
  data: RenderData;
  className?: string;
  children?: ReactNode;
}

/** Потолок высоты интерактивного вьюпорта (крупные графы). */
const MAX_INTERACTIVE_H = "70vh";
/** Шаг пана клавишей-стрелкой (экранные px). */
const KEY_PAN = 64;

/**
 * Read-only интерактивный просмотр канваса: pan/zoom поверх SSR-рендера.
 * До замера контейнера — статичная ветка, идентичная CanvasRender (SSR/no-JS
 * фолбэк, без mismatch при гидрации); после — viewBox из стейта через usePanZoom.
 * i18n/ссылки резолвит сам (как редактор). Тело графа мемоизировано — pan/zoom
 * меняет лишь viewBox, не реконсиля дерево узлов (важно для крупных канвасов).
 */
export function CanvasViewer({ data, className, children }: Props) {
  const t = useT("canvas");
  const tCommon = useT("common");
  const resolveEntityRef = useMemo(() => makeEntityRefResolver(t), [t]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [panning, setPanning] = useState(false);
  // Контентная высота статичного рендера — замеряется один раз; задаёт высоту
  // интерактива (с потолком), чтобы мелкий граф / превью ревизии не раздувались,
  // а крупный — не схлопывался. Viewer самосизится: его роняют в произвольные
  // контейнеры (страница, модалка ревизий), высоту из родителя взять нельзя.
  const [naturalHeight, setNaturalHeight] = useState<number | null>(null);

  const hasNodes = data.nodes.length > 0;

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || !hasNodes) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (!r || r.width <= 0 || r.height <= 0) return;
      const s = { width: r.width, height: r.height };
      setSize(s);
      setNaturalHeight((prev) => prev ?? r.height);
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
    onPanningChange: setPanning,
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
    const center = screenToWorld({ x: size.width / 2, y: size.height / 2 }, viewport);
    setViewport(centerViewport(center, size, 1));
  }, [size, viewport]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!size || !viewport) return;
    switch (e.key) {
      case "ArrowLeft": setViewport({ ...viewport, x: viewport.x - KEY_PAN / viewport.zoom }); break;
      case "ArrowRight": setViewport({ ...viewport, x: viewport.x + KEY_PAN / viewport.zoom }); break;
      case "ArrowUp": setViewport({ ...viewport, y: viewport.y - KEY_PAN / viewport.zoom }); break;
      case "ArrowDown": setViewport({ ...viewport, y: viewport.y + KEY_PAN / viewport.zoom }); break;
      case "+": case "=": setViewport(applyZoomAtPoint(viewport, BTN_ZOOM_IN, size.width / 2, size.height / 2)); break;
      case "-": case "_": setViewport(applyZoomAtPoint(viewport, BTN_ZOOM_OUT, size.width / 2, size.height / 2)); break;
      case "0": onFit(); break;
      default: return;
    }
    e.preventDefault();
  }, [size, viewport, onFit]);

  const sceneBody = useMemo(
    () => <CanvasSceneBody data={data} resolveEntityRef={resolveEntityRef} />,
    [data, resolveEntityRef],
  );

  if (!hasNodes) {
    return <p className="text-sm text-(--color-fg-muted)">{tCommon("canvasRender.emptyGraph")}</p>;
  }

  const ariaLabel = tCommon("canvasRender.graphAriaLabel");

  if (!interactive) {
    const sv = staticViewBox(boundingBox(data.nodes));
    return (
      <div ref={containerRef} className={className} style={{ overflow: "auto", maxWidth: "100%" }}>
        <svg viewBox={sv.viewBox} width={sv.width} height={sv.height} role="img" aria-label={ariaLabel} style={{ maxWidth: "100%", height: "auto" }}>
          {sceneBody}
        </svg>
        {children}
      </div>
    );
  }

  const interactiveHeight = naturalHeight !== null ? `min(${naturalHeight}px, ${MAX_INTERACTIVE_H})` : MAX_INTERACTIVE_H;

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      ref={containerRef}
      className={className}
      role="application"
      aria-label={ariaLabel}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      onKeyDown={onKeyDown}
      style={{ position: "relative", overflow: "hidden", touchAction: "none", cursor: panning ? "grabbing" : "grab", height: interactiveHeight }}
    >
      <svg viewBox={viewBoxFromViewport(viewport, size)} width="100%" height="100%" style={{ display: "block" }}>
        {sceneBody}
      </svg>

      <div
        className="absolute bottom-2 end-2 flex items-center gap-1 rounded border border-(--color-border) bg-(--color-surface) p-1"
        style={{ pointerEvents: "auto" }}
      >
        <IconButton type="button" compact aria-label={t("viewer.zoomOut")} title={t("viewer.zoomOut")} onClick={() => { zoomAtCenter(BTN_ZOOM_OUT); }}>
          <span className="inline-flex text-lg"><ZoomOutIcon /></span>
        </IconButton>
        <Button type="button" tone="quiet" compact aria-label={t("viewer.resetZoom")} title={t("viewer.resetZoom")} onClick={onResetZoom}>
          <span className="text-xs tabular-nums">{Math.round(viewport.zoom * 100)}%</span>
        </Button>
        <IconButton type="button" compact aria-label={t("viewer.zoomIn")} title={t("viewer.zoomIn")} onClick={() => { zoomAtCenter(BTN_ZOOM_IN); }}>
          <span className="inline-flex text-lg"><ZoomInIcon /></span>
        </IconButton>
        <IconButton type="button" compact aria-label={t("toolbar.fit")} title={t("toolbar.fit")} onClick={onFit}>
          <span className="inline-flex text-lg"><FitIcon /></span>
        </IconButton>
      </div>
      {children}
    </div>
  );
}
